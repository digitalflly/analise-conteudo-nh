/* api/refresh.js — Vercel Serverless Function
   Pulls fresh Instagram data from Windsor.ai and normalizes it into the shape
   the dashboard's buildDashboardData() expects. Runs on the server so the
   Windsor API key is never exposed to the browser.

   Required env var:  WINDSOR_API_KEY
   Optional env vars:
     WINDSOR_IG_ACCOUNT_ID  – restrict to one Instagram account id (recommended)
     WINDSOR_DAYS           – days of history to pull (default 180)
     WINDSOR_DATE_FROM      – explicit start date YYYY-MM-DD (overrides WINDSOR_DAYS)
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

async function windsor(fields, params) {
  const key = process.env.WINDSOR_API_KEY;
  const qs = new URLSearchParams(Object.assign({ api_key: key, fields: fields.join(',') }, params || {}));
  const url = BASE + '?' + qs.toString();
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error('Windsor ' + r.status + ' for [' + fields.join(',') + ']: ' + body.slice(0, 300));
  }
  const json = await r.json();
  return Array.isArray(json) ? json : (json.data || []);
}

module.exports = async function handler(req, res) {
  try {
    if (!process.env.WINDSOR_API_KEY) {
      res.status(500).json({ error: 'WINDSOR_API_KEY não configurada nas variáveis de ambiente.' });
      return;
    }

    const accountId = process.env.WINDSOR_IG_ACCOUNT_ID || null;
    const days = parseInt(process.env.WINDSOR_DAYS || '180', 10);
    const today = new Date();
    const from = process.env.WINDSOR_DATE_FROM ||
      iso(new Date(today.getTime() - days * 86400000));
    const to = iso(today);
    const range = { date_from: from, date_to: to };

    /* keep rows for the target account only (when more than one is connected) */
    const keep = (rows) => accountId ? rows.filter((r) => String(r.account_id) === String(accountId)) : rows;

    const [
      profileRows, dailyRows, followRows,
      genderRows, ageRows, cityRows, mediaRows,
    ] = await Promise.all([
      windsor(['account_id', 'account_name', 'user_name', 'followers_count', 'follows_count', 'media_count']),
      windsor(['account_id', 'date', 'views', 'reach', 'total_interactions', 'shares', 'likes', 'comments', 'saves', 'profile_links_taps'], range),
      windsor(['account_id', 'date', 'follows_and_unfollows'], range),
      windsor(['account_id', 'audience_gender_name', 'audience_gender_size']),
      windsor(['account_id', 'audience_age_name', 'audience_age_size']),
      windsor(['account_id', 'city', 'audience_city_size']),
      windsor(['account_id', 'media_id', 'timestamp', 'media_type', 'media_product_type', 'media_caption',
        'media_like_count', 'media_comments_count', 'media_reach', 'media_shares', 'media_saved',
        'media_engagement', 'media_views'], range),
    ]);

    /* ── profile ── */
    const pr = keep(profileRows)[0] || profileRows[0] || {};
    const fullName = pr.account_name || pr.user_name || 'Instagram';
    const handle = pr.user_name ? '@' + String(pr.user_name).replace(/^@/, '') : '';
    const initial = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'IG';
    const profile = {
      name: fullName,
      handle: handle,
      initial: initial,
      followers: nn(pr.followers_count),
    };

    /* ── daily ── (one row per date) */
    const dailyMap = {};
    keep(dailyRows).forEach((r) => {
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
    keep(followRows).forEach((r) => {
      const date = String(r.date).slice(0, 10);
      if (!date || date === 'null') return;
      followMap[date] = (followMap[date] || 0) + num(r.follows_and_unfollows);
    });
    const follows = Object.keys(followMap).sort().map((date) => ({ date, net: Math.round(followMap[date]) }));

    /* ── audience ── */
    const GENDER_LABEL = { F: 'Feminino', M: 'Masculino', U: 'Não informado' };
    function pctList(rows, labelKey, sizeKey, mapLabel, denom) {
      const items = keep(rows)
        .map((r) => ({ label: mapLabel ? (mapLabel[r[labelKey]] || r[labelKey]) : r[labelKey], value: nn(r[sizeKey]) }))
        .filter((x) => x.label != null && x.label !== 'null' && x.value > 0);
      const total = denom || items.reduce((s, x) => s + x.value, 0) || 1;
      items.forEach((x) => { x.pct = +(x.value / total * 100).toFixed(2); });
      return items;
    }
    const gender = pctList(genderRows, 'audience_gender_name', 'audience_gender_size', GENDER_LABEL);
    const ageOrder = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
    const age = pctList(ageRows, 'audience_age_name', 'audience_age_size')
      .sort((a, b) => ageOrder.indexOf(a.label) - ageOrder.indexOf(b.label));
    const cities = pctList(cityRows, 'city', 'audience_city_size', null, profile.followers || null)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((c) => ({ label: String(c.label).replace(/,.*$/, ''), value: c.value, pct: c.pct }));

    /* ── media ── */
    const media = keep(mediaRows)
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
    });
  } catch (err) {
    res.status(502).json({ error: String(err && err.message || err) });
  }
};
