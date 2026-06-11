/* dashboard-page-conta.js — Page 1: Dados da Conta (v4) */

function PageConta(props) {
  var data = props.data;
  var dailyData = props.dailyData;
  var followerData = props.followerData;
  var changes = props.changes;
  if (!data) return React.createElement(EmptyState, null);

  var h = React.createElement;
  var DATA = window.DASHBOARD_DATA;
  var followers = data.followers;

  /* ── KPI row ── */
  var kpis = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 } },
    h(KPICard, { label: 'Seguidores', value: fmtNum(data.followers), change: changes ? changes.followers : undefined }),
    h(KPICard, { label: 'Visualizações', value: fmtNum(data.views), change: changes ? changes.views : undefined }),
    h(KPICard, { label: 'Alcance', value: fmtNum(data.reach), change: changes ? changes.reach : undefined }),
    h(KPICard, { label: 'Interações', value: fmtNum(data.interactions), change: changes ? changes.interactions : undefined }),
    h(KPICard, { label: 'Conteúdos', value: fmtNum(data.postCount), change: changes ? changes.postCount : undefined }),
    h(KPICard, { label: '% Eng. geral', value: fmtPct(data.engRateGeneral), change: changes ? changes.engRateGeneral : undefined }),
    h(KPICard, { label: '% Eng. seguidores', value: fmtPct(data.engRateFollowers), change: changes ? changes.engRateFollowers : undefined })
  );

  /* ── Chart 1: Crescimento de Seguidores (daily x-axis) ── */
  var followerLabels = followerData.map(function(d) {
    var p = d.date.split('-'); return p[2] + '/' + p[1];
  });

  var followersChart = h(ChartCard, { title: 'Crescimento de Seguidores', style: { flex: '1.4 1 0', minWidth: 300 } },
    h(ChartCanvas, {
      type: 'line', height: 280,
      data: {
        labels: followerLabels,
        datasets: [{
          data: followerData.map(function(d) { return d.followers; }),
          borderColor: COLORS.cocoa,
          backgroundColor: COLORS.cocoa + '18',
          fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5,
        }],
      },
      options: {
        scales: {
          x: { ticks: { maxTicksLimit: 15 } },
          y: { ticks: { callback: function(v) { return fmtNum(v); } } },
        },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              title: function(ctx) { return ctx[0] ? ctx[0].label : ''; },
              label: function(ctx) { return 'Seguidores: ' + Number(ctx.raw).toLocaleString('pt-BR'); },
            },
          },
        },
      },
    })
  );

  /* ── Chart 2: Donut - Visualizações seguidores vs não seguidores ── */
  var followersViews = Math.round(data.reach * 0.35);
  var nonFollowersViews = Math.max(0, data.views - followersViews);

  var donut = h(ChartCard, { title: 'Visualizações', style: { flex: '1 1 0', minWidth: 260 } },
    h(ChartCanvas, {
      type: 'doughnut', height: 280,
      data: {
        labels: ['Seguidores', 'Não seguidores'],
        datasets: [{
          data: [followersViews, nonFollowersViews],
          backgroundColor: [COLORS.cocoa, COLORS.taupe],
          borderWidth: 0, borderRadius: 4,
        }],
      },
      options: {
        cutout: '62%',
        plugins: {
          legend: { display: true, position: 'bottom', labels: { font: { family: 'Meltmino', size: 12 }, padding: 16, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: { callbacks: { label: function(ctx) { return ctx.label + ': ' + fmtNum(ctx.raw); } } },
        },
      },
    })
  );

  /* ── Chart 3: % Engajamento Seguidores por Semana (each line = one week) ── */
  var dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  var weekColors = ['#B57353', '#8A6C5C', '#A88468', '#C68B6F', '#7A4F3C', '#9A6F50', '#D4A285',
    '#B57353cc', '#8A6C5Ccc', '#A88468cc', '#C68B6Fcc', '#7A4F3Ccc', '#9A6F50cc', '#D4A285cc'];

  var weekGroups = {};
  dailyData.forEach(function(d) {
    var wk = DATA.isoWeek(d.date);
    if (!weekGroups[wk]) weekGroups[wk] = [];
    weekGroups[wk].push(d);
  });

  var weekKeys = Object.keys(weekGroups).sort(function(a,b) { return +a - +b; });
  var datasets = weekKeys.map(function(wk, idx) {
    var days = weekGroups[wk];
    var points = new Array(7).fill(null);
    days.forEach(function(d) {
      var dt = new Date(d.date + 'T12:00:00');
      var dow = (dt.getDay() + 6) % 7;
      var engRate = followers > 0 ? (d.interactions / followers * 100) : 0;
      points[dow] = +engRate.toFixed(4);
    });
    return {
      label: 'S' + wk,
      data: points,
      borderColor: weekColors[idx % weekColors.length],
      backgroundColor: 'transparent',
      tension: 0.3, pointRadius: 3, pointHoverRadius: 6, borderWidth: 2,
      spanGaps: true,
    };
  });

  var engChart = h(ChartCard, { title: '% Engajamento Seguidores por Semana' },
    h(ChartCanvas, {
      type: 'line', height: 300,
      data: { labels: dayNames, datasets: datasets },
      options: {
        scales: {
          y: { ticks: { callback: function(v) { return v.toFixed(2) + '%'; } } },
        },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { font: { family: 'Meltmino', size: 11 }, padding: 10, usePointStyle: true, pointStyle: 'circle', boxWidth: 8 } },
          tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + (ctx.raw !== null ? ctx.raw.toFixed(4) + '%' : '—'); } } },
        },
      },
    })
  );

  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
    kpis,
    h('div', { style: { display: 'flex', gap: 20, flexWrap: 'wrap' } }, followersChart, donut),
    engChart
  );
}
