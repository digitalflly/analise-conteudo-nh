/* dashboard-app.js — Main App shell (v4 - fixed to @priscilariciardi) */

function App() {
  var h = React.createElement;
  var _ver = React.useState(0), dataVersion = _ver[0], setDataVersion = _ver[1];
  var DATA = window.DASHBOARD_DATA;
  var _client = React.useState(DATA.ACCOUNTS[0].id), client = _client[0], setClient = _client[1];
  var CLIENT = client;

  var _page = React.useState('conta'), page = _page[0], setPage = _page[1];
  var _week = React.useState(DATA.DEFAULT_WEEK), weekIso = _week[0], setWeek = _week[1];
  var _month = React.useState(null), month = _month[0], setMonth = _month[1];
  var _refreshing = React.useState(false), refreshing = _refreshing[0], setRefreshing = _refreshing[1];
  var _synced = React.useState(window.DASHBOARD_SEED && window.DASHBOARD_SEED.lastSync || null), syncedAt = _synced[0], setSyncedAt = _synced[1];

  /* Pull fresh data from the Windsor.ai-backed API and rebuild the model. */
  function handleRefresh() {
    if (refreshing) return;
    if (typeof window.fetchWindsorData !== 'function') { window.location.reload(); return; }
    setRefreshing(true);
    window.fetchWindsorData().then(function (payload) {
      window.applyWindsorData(payload);
      var D = window.DASHBOARD_DATA;
      setClient(D.ACCOUNTS[0].id);
      setMonth(null);
      setWeek(D.DEFAULT_WEEK);
      setSyncedAt(payload.syncedAt || new Date().toISOString());
      setDataVersion(function (v) { return v + 1; });
      setRefreshing(false);
    }).catch(function (err) {
      setRefreshing(false);
      window.alert('Não foi possível atualizar os dados.\n\n' + err.message +
        '\n\nVerifique se a variável WINDSOR_API_KEY está configurada no Vercel.');
    });
  }

  /* Apply per-page accent color before rendering */
  setPageAccent(page);

  var dailyData = DATA.getDaily(CLIENT, month, weekIso);
  var aggregated = DATA.aggregateDaily(CLIENT, month, weekIso);
  var followerData = DATA.getFollowerTimeline(CLIENT, month, weekIso);
  var changes = DATA.getWeekComparison(CLIENT);

  var content;
  if (page === 'conta') {
    content = h(PageConta, {
      data: aggregated,
      dailyData: dailyData,
      followerData: followerData,
      changes: changes,
    });
  } else if (page === 'conteudos') {
    content = h(PageConteudos, { client: CLIENT, month: month, weekIso: weekIso });
  } else {
    content = h(PageInsights, { client: CLIENT, month: month, weekIso: weekIso });
  }

  return h('div', { style: {
    maxWidth: 1360, margin: '0 auto',
    padding: '0 clamp(16px, 3vw, 48px) 48px',
    fontFamily: 'var(--font)',
  }},
    h(Header, {
      client: client,
      clients: DATA.ACCOUNTS,
      onClientChange: setClient,
      page: page,
      onPageChange: setPage,
      weekIso: weekIso,
      onWeekChange: setWeek,
      month: month,
      onMonthChange: function(m) { setMonth(m); setWeek(null); },
      weeks: DATA.WEEKS,
      months: DATA.MONTHS,
      onRefresh: handleRefresh,
      refreshing: refreshing,
      syncedAt: syncedAt,
    }),
    h('div', { style: { marginTop: 24 } }, content),
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
