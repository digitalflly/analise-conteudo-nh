/* api/refresh.js — Vercel Serverless Function (Node 18+/20.x)
   Pulls fresh Instagram data from Windsor.ai and normalizes it into the shape
   the dashboard's buildDashboardData() expects. Runs on the server so the
   Windsor API key is never exposed to the browser.

   Required env var:  WINDSOR_API_KEY
   Optional env vars:
     WINDSOR_IG_ACCOUNT_ID  – restrict to one Instagram account id (recommended:
                              17841401155274275). If unset, all IG rows are used.
     WINDSOR_DAYS           – days of history to pull (default 200, covers Jan→today)
     WINDSOR_DATE_FROM      – explicit start date YYYY-MM-DD (overrides WINDSOR_DAYS)

   Debug:  GET /api/refresh?diag=1  → reports which sub-queries succeeded/failed
           and the row counts, WITHOUT throwing. Open this URL directly in the
           browser on your Vercel deployment to see exactly what's wrong.
*/

const BASE = 'https://connectors.windsor.ai/instagram';

function iso(d) {
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function num(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}
function nn(v) { return Math.max(0, Math.round(num(v))); } /* non-negative int */

/* Single Windsor request. Throws on HTTP error (caller decides how to handle). */
async function windsorRaw(fields, params) {
  const key = process.env.WINDSOR_API_KEY;
  const qs = new URLSearchParams(Object.assign({ api_key: key, fields: fields.join(',') }, params || {}));
  const url = BASE + '?' + qs.toString();
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  const text = await r.text();
  if (!r.ok) {
    throw new Error('Windsor ' + r.status + ' [' + fields.join(',') + ']: ' + text.slice(0, 250));
  }
  let json;
  try { json = JSON.parse(text); } catch (e) { throw new Error('Resposta não-JSON da Windsor: ' + text.slice(0, 150)); }
  return Array.isArray(json) ? json : (json.data || []);
}

/* Safe wrapper: never throws — returns { ok, rows, error }. Lets one failing
   sub-query (e.g. audience) NOT take down the whole refresh. */
async function windsorSafe(label, fields, params) {
  try {
    const rows = await windsorRaw(fields, params);
    return { label, ok: true, rows, count: rows.length, error: null };
  } catch (err) {
    return { label, ok: false, rows: [], count: 0, error: String(err && err.message || err) };
  }
}

module.exports = async function handler(req, res) {
  const diag = req.query && (req.query.diag === '1' || req.query.diag === 'true');

  try {
    if (!process.env.WINDSOR_API_KEY) {
      res.status(500).json({
        error: 'WINDSOR_API_KEY não configurada. Adicione em Vercel → Settings → Environment Variables e faça um novo deploy.',
        hint: 'A variável precisa existir no ambiente "Production" (e "Preview" se for testar em branches).',
      });
      return;
    }

    const accountId = process.env.WINDSOR_IG_ACCOUNT_ID || null;
    const days = parseInt(process.env.WINDSOR_DAYS || '200', 10);
    const today = new Date();
    const from = process.env.WINDSOR_DATE_FROM ||
      iso(new Date(today.getTime() - days * 86400000));
    const to = iso(today);
    const range = { date_from: from, date_to: to };

    /* All sub-queries run in parallel but NONE can crash the whole request. */
    const [
      profileR, dailyR, followR,
      genderR, ageR, cityR, mediaR,
    ] = await Promise.all([
      windsorSafe('profile', ['account_id', 'username', 'name', 'followers_count', 'follows_count', 'media_count']),
      windsorSafe('daily', ['account_id', 'date', 'views', 'reach', 'total_interactions', 'shares', 'likes', 'comments', 'saves', 'profile_links_taps'], range),
      windsorSafe('follows', ['account_id', 'date', 'follows_and_unfollows'], range),
      windsorSafe('gender', ['account_id', 'audience_gender_name', 'audience_gender_size']),
      windsorSafe('age', ['account_id', 'audience_age_name', 'audience_age_size']),
      windsorSafe('city', ['account_id', 'city', 'audience_city_size']),
      windsorSafe('media', ['account_id', 'media_id', 'timestamp', 'media_type', 'media_product_type', 'media_caption',
        'media_like_count', 'media_comments_count', 'media_reach', 'media_shares', 'media_saved',
        'media_engagement', 'media_views'], range),
    ]);

    /* Tolerant account filter: only filter when an id is configured AND the
       filter actually leaves rows; otherwise fall back to all rows. */
    const keep = (rows) => {
      if (!accountId) return rows;
      const f = rows.filter((r) => String(r.account_id) === String(accountId));
      return f.length ? f : rows;
    };

    /* ── diagnostics mode: report and return, never throw ── */
    if (diag) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        diagnostic: true,
        env: {
          WINDSOR_API_KEY: 'set',
          WINDSOR_IG_ACCOUNT_ID: accountId || '(não definida — usando todas as contas IG)',
          range: { from, to },
          nodeVersion: process.version,
          fetchAvailable: typeof fetch === 'function',
        },
        queries: [profileR, dailyR, followR, genderR, ageR, cityR, mediaR].map((q) => ({
          query: q.label, ok: q.ok, rows: q.count, error: q.error,
        })),
      });
      return;
    }

    /* The two essentials. If daily failed, surface its real error. */
    if (!dailyR.ok) throw new Error('Falha na consulta diária — ' + dailyR.error);

    /* ── profile ── */
    const pr = keep(profileR.rows)[0] || profileR.rows[0] || {};
    const fullName = pr.name || pr.account_name || 'Instagram';
    const uname = pr.username || pr.user_name || pr.account_name || '';
    const handle = uname ? '@' + String(uname).replace(/^@/, '') : '';
    const initial = String(fullName).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'IG';
    const profile = {
      name: fullName,
      handle: handle,
      initial: initial,
      followers: nn(pr.followers_count),
    };

    /* ── daily ── (one row per date) */
    const dailyMap = {};
    keep(dailyR.rows).forEach((r) => {
      const date = String(r.date).slice(0, 10);
      if (!date || date === 'null') return;
      const o = dailyMap[date] || { date, views: 0, reach: 0, interactions: 0, taps: 0, shares: 0, likes: 0, comments: 0, saves: 0 };
      o.views += nn(r.views);
      o.reach += nn(r.reach);
      o.interactions += nn(r.total_interactions);
      o.taps += nn(r.profile_links_taps);
      o.shares += nn(r.shares);
      o.likes += nn(r.likes);
      o.comments += nn(r.comments);
      o.saves += nn(r.saves);
      dailyMap[date] = o;
    });
    const daily = Object.values(dailyMap).sort((a, b) => (a.date < b.date ? -1 : 1));

    /* ── follower growth (net per day) ── */
    const followMap = {};
    keep(followR.rows).forEach((r) => {
      const date = String(r.date).slice(0, 10);
      if (!date || date === 'null') return;
      followMap[date] = (followMap[date] || 0) + num(r.follows_and_unfollows);
    });
    const follows = Object.keys(followMap).sort().map((date) => ({ date, net: Math.round(followMap[date]) }));

    /* ── audience ── (each independent; empty if its query failed) */
    const GENDER_LABEL = { F: 'Feminino', M: 'Masculino', U: 'Não informado' };
    function pctList(rows, labelKey, sizeKey, mapLabel, denom) {
      const items = keep(rows)
        .map((r) => ({ label: mapLabel ? (mapLabel[r[labelKey]] || r[labelKey]) : r[labelKey], value: nn(r[sizeKey]) }))
        .filter((x) => x.label != null && x.label !== 'null' && x.value > 0);
      const total = denom || items.reduce((s, x) => s + x.value, 0) || 1;
      items.forEach((x) => { x.pct = +(x.value / total * 100).toFixed(2); });
      return items;
    }
    const gender = pctList(genderR.rows, 'audience_gender_name', 'audience_gender_size', GENDER_LABEL);
    const ageOrder = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
    const age = pctList(ageR.rows, 'audience_age_name', 'audience_age_size')
      .sort((a, b) => ageOrder.indexOf(a.label) - ageOrder.indexOf(b.label));
    const cities = pctList(cityR.rows, 'city', 'audience_city_size', null, profile.followers || null)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((c) => ({ label: String(c.label).replace(/,.*$/, ''), value: c.value, pct: c.pct }));

    /* ── media ── */
    const media = keep(mediaR.rows)
      .filter((r) => r.media_id)
      .map((r) => ({
        id: String(r.media_id),
        type: r.media_product_type === 'REELS' ? 'REELS' : (r.media_type || 'IMAGE'),
        ts: String(r.timestamp || '').replace('+0000', '').replace(/Z$/, ''),
        likes: nn(r.media_like_count),
        comments: nn(r.media_comments_count),
        shares: nn(r.media_shares),
        saves: nn(r.media_saved),
        views: nn(r.media_views),
        reach: nn(r.media_reach),
        eng: nn(r.media_engagement) || (nn(r.media_like_count) + nn(r.media_comments_count) + nn(r.media_shares) + nn(r.media_saved)),
        caption: String(r.media_caption || '').slice(0, 240),
      }))
      .sort((a, b) => (a.ts < b.ts ? -1 : 1));

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      profile, daily, follows,
      audience: { gender, age, cities },
      media,
      syncedAt: new Date().toISOString(),
      range: { from, to },
      /* surface non-fatal warnings so the UI/console can show partial-data notices */
      warnings: [profileR, followR, genderR, ageR, cityR, mediaR]
        .filter((q) => !q.ok)
        .map((q) => q.label + ': ' + q.error),
    });
  } catch (err) {
    res.status(502).json({ error: String(err && err.message || err) });
  }
};
