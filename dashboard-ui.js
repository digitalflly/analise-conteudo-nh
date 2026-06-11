/* dashboard-ui.js — Shared UI components (v3) */

var COLORS = {
  espresso: '#5F4133',  /* text */
  taupe:    '#EBD4C0',  /* dividers / borders */
  mocha:    '#8A6C5C',  /* muted text */
  cocoa:    '#B57353',  /* page accent — overridden per page */
  cream:    '#FFF2E8',  /* background */
  white:    '#F8E3D2',  /* KPI / card background */
  green:    '#5b8c5a',
  red:      '#a64a3d',
};

/* Page accents — set page-specific accents here */
var PAGE_ACCENTS = {
  conta:     '#B57353',
  conteudos: '#376447',
  insights:  '#A3A983',
};
function setPageAccent(page) {
  if (PAGE_ACCENTS[page]) COLORS.cocoa = PAGE_ACCENTS[page];
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return Math.round(n).toLocaleString('pt-BR');
}
function fmtPct(n) { return n.toFixed(2) + '%'; }
function fmtChange(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }

function deepMerge(t, s) {
  Object.keys(s).forEach(function (k) {
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && t[k] && typeof t[k] === 'object') {
      deepMerge(t[k], s[k]);
    } else { t[k] = s[k]; }
  });
  return t;
}

/* ───── Header ───── */
function Header(props) {
  var page = props.page, onPageChange = props.onPageChange;
  var weekIso = props.weekIso, onWeekChange = props.onWeekChange;
  var month = props.month, onMonthChange = props.onMonthChange;
  var weeks = props.weeks, months = props.months;
  var client = props.client, clients = props.clients || [], onClientChange = props.onClientChange;
  var onRefresh = props.onRefresh, refreshing = props.refreshing, syncedAt = props.syncedAt;
  var current = clients.find(function(c) { return c.id === client; }) || clients[0] || { name: '', handle: '', initial: '' };

  var syncedLabel = '';
  if (syncedAt) {
    if (String(syncedAt).indexOf('T') === -1) {
      var dp = String(syncedAt).split('-');
      syncedLabel = dp.length === 3 ? ('Atualizado ' + dp[2] + '/' + dp[1]) : ('Atualizado ' + syncedAt);
    } else {
      var sd = new Date(syncedAt);
      syncedLabel = isNaN(sd) ? '' : ('Atualizado ' + sd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
        ' às ' + sd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }
  }

  var navBtn = function(active) {
    return {
      padding: '9px 20px', borderRadius: 10,
      border: active ? 'none' : '1px solid ' + COLORS.taupe,
      background: active ? COLORS.cocoa : 'transparent',
      color: active ? '#fff' : COLORS.espresso,
      fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
      cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap',
    };
  };
  var sel = {
    padding: '8px 14px', borderRadius: 10, border: '1px solid ' + COLORS.taupe,
    background: COLORS.white, color: COLORS.espresso,
    fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500, cursor: 'pointer', outline: 'none',
  };
  var pages = [['conta','Dados da Conta'],['conteudos','Dados dos Conteúdos'],['insights','Insights']];

  var filteredWeeks = month ? weeks.filter(function(w) {
    return parseInt(w.start.split('-')[1]) === month || parseInt(w.end.split('-')[1]) === month;
  }) : weeks;

  return React.createElement('header', { style: { padding: '20px 0 0', display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 } },
      React.createElement('h1', { style: { fontFamily: 'var(--font-title)', fontSize: 40, fontWeight: 400, color: COLORS.espresso, letterSpacing: '-.01em', margin: 0, lineHeight: 1 } }, 'Análise de Conteúdo'),
      React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        syncedLabel && React.createElement('span', { style: { fontSize: 11, fontWeight: 600, color: COLORS.mocha, whiteSpace: 'nowrap', marginRight: 2 } }, syncedLabel),
        React.createElement('button', {
          title: refreshing ? 'Atualizando…' : 'Atualizar dados',
          aria_label: 'Atualizar dados',
          disabled: !!refreshing,
          onClick: function() { if (onRefresh) { onRefresh(); } else { window.location.reload(); } },
          style: {
            width: 38, height: 38, borderRadius: 10,
            border: '1px solid ' + COLORS.taupe,
            background: 'transparent', color: COLORS.espresso,
            cursor: refreshing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, transition: 'all .2s', opacity: refreshing ? 0.65 : 1,
          },
          onMouseEnter: function(e) { if (!refreshing) e.currentTarget.style.background = COLORS.cream; },
          onMouseLeave: function(e) { e.currentTarget.style.background = 'transparent'; },
        },
          React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round',
            style: refreshing ? { animation: 'om-spin 0.8s linear infinite', transformOrigin: '50% 50%' } : null },
            React.createElement('polyline', { points: '23 4 23 10 17 10' }),
            React.createElement('polyline', { points: '1 20 1 14 7 14' }),
            React.createElement('path', { d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' })
          )
        ),
        pages.map(function(p) {
          return React.createElement('button', { key: p[0], style: navBtn(page === p[0]), onClick: function() { onPageChange(p[0]); } }, p[1]);
        })
      )
    ),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' } },
        React.createElement('div', { style: { width: 36, height: 36, borderRadius: '50%', background: COLORS.cocoa, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 } }, current.initial || 'NH'),
        React.createElement('span', { style: { fontWeight: 600, fontSize: 14, color: COLORS.espresso } }, (current.name || '') + ' ' + (current.handle || ''))
      ),
      React.createElement('select', { style: sel, value: month || '',
        onChange: function(e) { onMonthChange(e.target.value ? +e.target.value : null); },
      },
        React.createElement('option', { value: '' }, 'Todos os meses'),
        months.map(function(m) { return React.createElement('option', { key: m.value, value: m.value }, m.label); })
      ),
      React.createElement('select', { style: Object.assign({}, sel, { minWidth: 220 }), value: weekIso || '',
        onChange: function(e) { onWeekChange(e.target.value ? +e.target.value : null); },
      },
        React.createElement('option', { value: '' }, 'Todas as semanas'),
        filteredWeeks.map(function(w) { return React.createElement('option', { key: w.iso, value: w.iso }, w.label); })
      ),
    )
  );
}

/* ───── KPI Card (110px height + change indicator) ───── */
function KPICard(props) {
  var changeColor = props.change !== undefined ? (props.change >= 0 ? COLORS.green : COLORS.red) : COLORS.mocha;
  return React.createElement('div', { style: {
    background: COLORS.white, borderRadius: 16, padding: '16px 20px',
    boxShadow: '0 1px 4px rgba(39,21,13,.06)',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    minWidth: 0, height: 110,
  }},
    React.createElement('span', { style: { fontSize: 11, fontWeight: 600, color: COLORS.mocha, textTransform: 'uppercase', letterSpacing: '.08em' } }, props.label),
    React.createElement('span', { style: { fontSize: 26, fontWeight: 700, color: COLORS.espresso, letterSpacing: '-.02em' } }, props.value),
    React.createElement('span', { style: { fontSize: 11, fontWeight: 600, color: changeColor } },
      props.change !== undefined ? (props.change >= 0 ? '▲ +' : '▼ -') + Math.abs(props.change).toFixed(1) + '%' : props.sub || ''
    )
  );
}

/* ───── Chart Card ───── */
function ChartCard(props) {
  return React.createElement('div', { style: Object.assign({
    background: COLORS.white, borderRadius: 16, padding: 24,
    boxShadow: '0 1px 4px rgba(39,21,13,.06)',
    display: 'flex', flexDirection: 'column', gap: 16,
  }, props.style || {}) },
    props.title && React.createElement('h3', { style: { fontSize: 13, fontWeight: 600, color: COLORS.mocha, textTransform: 'uppercase', letterSpacing: '.08em', margin: 0 } }, props.title),
    props.children
  );
}

/* ───── Chart.js wrapper ───── */
function ChartCanvas(props) {
  var ref = React.useRef(null);
  var chartRef = React.useRef(null);
  var dataKey = JSON.stringify(props.data);

  React.useEffect(function() {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (!ref.current) return;
    var defaults = {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: COLORS.espresso, titleFont: { family: 'Meltmino', size: 12 }, bodyFont: { family: 'Meltmino', size: 12 }, padding: 10, cornerRadius: 8, displayColors: false } },
    };
    if (props.type !== 'doughnut' && props.type !== 'pie') {
      defaults.scales = {
        x: { grid: { display: false }, ticks: { font: { family: 'Meltmino', size: 11 }, color: COLORS.mocha } },
        y: { grid: { color: '#EBD4C0' }, ticks: { font: { family: 'Meltmino', size: 11 }, color: COLORS.mocha }, border: { display: false } },
      };
    }
    var merged = props.options ? deepMerge(defaults, props.options) : defaults;
    chartRef.current = new Chart(ref.current, { type: props.type, data: props.data, options: merged });
    return function () { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [props.type, dataKey]);

  return React.createElement('div', { style: { height: props.height || 260, position: 'relative' } },
    React.createElement('canvas', { ref: ref })
  );
}

function EmptyState(props) {
  return React.createElement('div', { style: { padding: 48, textAlign: 'center', color: COLORS.taupe, fontSize: 14, fontWeight: 500 } }, props && props.message || 'Sem dados para o período selecionado');
}
