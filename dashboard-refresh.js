/* dashboard-refresh.js — fetches live data from /api/refresh and applies it.
   On Vercel this hits the serverless function (api/refresh.js) which calls
   Windsor.ai. Locally / in the standalone file there is no backend, so the
   button falls back to a normal reload (handled in the UI). */

(function () {
  window.fetchWindsorData = async function () {
    var res = await fetch('/api/refresh', { headers: { accept: 'application/json' } });
    var payload;
    try { payload = await res.json(); } catch (e) { payload = null; }
    if (!res.ok) {
      var msg = (payload && payload.error) ? payload.error : ('HTTP ' + res.status);
      throw new Error(msg);
    }
    if (!payload || !payload.daily || !payload.daily.length) {
      throw new Error('Resposta sem dados diários.');
    }
    return payload;
  };

  /* Rebuild every global the pages read from, using the same builder as the seed. */
  window.applyWindsorData = function (payload) {
    window.DASHBOARD_DATA = window.buildDashboardData({
      profile: payload.profile,
      daily: payload.daily,
      follows: payload.follows,
      media: payload.media,
    });
    window.MEDIA_DATA = payload.media || [];
    if (payload.audience) window.AUDIENCE_DATA = payload.audience;
    window.LAST_SYNC = payload.syncedAt || new Date().toISOString();
  };
})();
