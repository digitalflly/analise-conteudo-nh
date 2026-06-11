/* dashboard-page-insights.js — Page 3: Insights */

function PageInsights(props) {
  var month = props.month;
  var weekIso = props.weekIso;
  var client = props.client;
  var h = React.createElement;
  var DATA = window.DASHBOARD_DATA;
  var hasData = client === DATA.ACCOUNTS[0].id;
  var AUD = hasData ? window.AUDIENCE_DATA : { gender: [], age: [], cities: [] };
  var media = hasData ? (window.MEDIA_DATA || []) : [];
  var acc = DATA.ACCOUNTS.find(function(a) { return a.id === client; }) || {};
  var followers = acc.followers || 0;

  /* Lock the right column's height to the left (demographics) column so both
     end at the same baseline; the headlines list scrolls inside if needed. */
  var leftRef = React.useRef(null);
  var _rh = React.useState(null), rightH = _rh[0], setRightH = _rh[1];
  React.useLayoutEffect(function() {
    function measure() { if (leftRef.current) setRightH(leftRef.current.offsetHeight); }
    measure();
    var t = setTimeout(measure, 250);
    window.addEventListener('resize', measure);
    return function() { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [month, weekIso, client]);

  /* Filter media */
  var filtered = media.filter(function(m) {
    var d = m.ts.split('T')[0];
    if (month) {
      var mo = parseInt(d.split('-')[1]);
      if (mo !== month) return false;
    }
    if (weekIso) {
      var wk = DATA.WEEKS.find(function(w) { return w.iso === weekIso; });
      if (wk && (d < wk.start || d > wk.end)) return false;
    }
    return true;
  });

  /* Top 5 by reach */
  var topReach = filtered.slice().sort(function(a,b) { return b.reach - a.reach; }).slice(0, 5);
  /* Top 5 by % engagement geral (eng/reach) */
  var topEng = filtered.slice().sort(function(a,b) {
    var ea = a.reach > 0 ? a.eng / a.reach : 0;
    var eb = b.reach > 0 ? b.eng / b.reach : 0;
    return eb - ea;
  }).slice(0, 5);

  /* ── Horizontal bar chart ── */
  function makeBarChart(title, items) {
    return h(ChartCard, { title: title },
      h(ChartCanvas, {
        type: 'bar', height: Math.max(220, items.length * 32 + 40),
        data: {
          labels: items.map(function(i) { return i.label; }),
          datasets: [{
            data: items.map(function(i) { return i.pct; }),
            backgroundColor: COLORS.cocoa + 'cc',
            borderRadius: 6, barThickness: 18,
          }],
        },
        options: {
          indexAxis: 'y',
          scales: {
            x: { ticks: { callback: function(v) { return v + '%'; } }, grid: { color: '#f0ece9' } },
            y: { grid: { display: false } },
          },
          plugins: {
            tooltip: { callbacks: { label: function(ctx) { return ctx.raw + '%'; } } },
          },
        },
      })
    );
  }

  /* ── Content table ── */
  function ContentTable(title, items, metricLabel, metricFn) {
    return h(ChartCard, { title: title, style: { padding: 20, flex: '1.25 1 0', minHeight: 0, overflow: 'hidden' } },
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0, overflowY: 'auto' } },
        items.map(function(m) {
          var d = m.ts.split('T')[0].split('-');
          var date = d[2] + '/' + d[1] + '/' + d[0];
          return h('div', { key: m.id, style: {
            display: 'flex', gap: 12, padding: 12, borderRadius: 10,
            background: COLORS.cream + '60', borderLeft: '3px solid ' + COLORS.cocoa,
          }},
            /* Content */
            h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 } },
                h('span', { style: { fontSize: 10, fontWeight: 600, color: COLORS.mocha } }, date),
                h('span', { style: { fontSize: 11, fontWeight: 700, color: COLORS.cocoa } }, metricLabel + ': ' + metricFn(m))
              ),
              h('p', { style: { fontSize: 11, lineHeight: 1.4, color: COLORS.espresso, margin: 0,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } },
                m.caption || '(sem legenda)'
              ),
              /* Indicators */
              h('div', { style: { display: 'flex', gap: 14, marginTop: 4 } },
                h('span', { style: { fontSize: 10, color: COLORS.mocha, fontWeight: 600 } }, '♥ ' + fmtNum(m.likes)),
                h('span', { style: { fontSize: 10, color: COLORS.mocha, fontWeight: 600 } }, '💬 ' + fmtNum(m.comments)),
                h('span', { style: { fontSize: 10, color: COLORS.mocha, fontWeight: 600 } }, '↗ ' + fmtNum(m.shares)),
                h('span', { style: { fontSize: 10, color: COLORS.mocha, fontWeight: 600 } }, '🔖 ' + fmtNum(m.saves)),
              )
            )
          );
        })
      )
    );
  }

  /* ── 10 Headline Ideas — derived from the selected period's content ── */
  function toHeadline(cap) {
    var t = (cap || '').split('\n')[0];
    var m = t.match(/^[^.!?]*[.!?]/);
    if (m) t = m[0];
    t = t.replace(/["“”]/g, '').trim().replace(/[.…]+$/, '').trim();
    if (t.length > 100) t = t.slice(0, 97).trim() + '…';
    return t;
  }
  /* Evergreen pool to top up to 10 when the period has few posts */
  var HEADLINE_POOL = [
    'Seu filho não é preguiçoso: o que a ciência do neurodesenvolvimento realmente diz',
    'A TCC não está falhando — o cérebro do seu paciente ainda não está pronto para ela',
    'Recurso lúdico só funciona quando você sabe o que está investigando na criança',
    'Filme na sessão não é distração: é o recurso clínico mais subestimado da infância',
    'Flexibilidade cognitiva: por que "birra" quase nunca é birra na primeira infância',
    'Estamos enchendo a agenda das crianças e esvaziando a infância delas',
    'Quando um caso trava, a primeira coisa que eu reviso NÃO é a técnica',
    '5 pré-requisitos do desenvolvimento que precisam existir antes de qualquer técnica',
    'A história de toda criança com TDAH é marcada por mais correções do que reforços',
    'Ansiedade de início precoce: por que tratar antes dos 8 anos muda o prognóstico',
    'Neurodesenvolvimento na primeira infância: a lente que muda a condução do caso',
    'Funções executivas se constroem no cotidiano, não em tarefas isoladas',
    'O que a criança não verbaliza, o brincar revela: como ler o jogo na sessão',
    'Treinamento de pais: por que metade do caso acontece fora do consultório',
    'Referência social: o indicador precoce de desenvolvimento que você pode observar hoje',
  ];
  var headlines = [];
  (function() {
    var seen = {};
    function key(s) { return s.toLowerCase().replace(/[^a-zà-ú0-9 ]/gi, '').replace(/\s+/g, ' ').trim().slice(0, 24); }
    function add(hl) {
      if (!hl) return;
      var k = key(hl);
      if (!seen[k]) { seen[k] = 1; headlines.push(hl); }
    }
    filtered.slice().sort(function(a, b) { return b.eng - a.eng; }).forEach(function(m) {
      add(toHeadline(m.caption));
    });
    /* always fill to 10 distinct ideas */
    HEADLINE_POOL.forEach(function(hl) {
      if (headlines.length < 10) add(hl);
    });
    headlines = headlines.slice(0, 10);
  })();

  var headlinesCard = h(ChartCard, { title: '10 Ideias de Headlines', style: { flex: '1 1 0', minHeight: 0, overflow: 'hidden' } },
    headlines.length === 0
      ? h('p', { style: { fontSize: 13, color: COLORS.mocha, margin: 0 } }, 'Nenhum conteúdo no período selecionado para gerar ideias.')
      : h('ol', { style: { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflowY: 'auto' } },
          headlines.map(function(t, i) {
            return h('li', { key: i, style: { fontSize: 13, color: COLORS.espresso, lineHeight: 1.5 } }, t);
          })
        )
  );

  /* ── Layout ── */
  return h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 20, alignItems: 'start' } },
    /* Left column: demographics (height reference) */
    h('div', { ref: leftRef, style: { display: 'flex', flexDirection: 'column', gap: 16 } },
      makeBarChart('Faixa Etária', AUD.age),
      makeBarChart('Gênero', AUD.gender),
      h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column' } }, makeBarChart('Top Cidades', AUD.cities))
    ),
    /* Right column: tables + headlines, height locked to left column */
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, height: rightH ? rightH : 'auto', overflow: 'hidden' } },
      ContentTable('Top Conteúdos Alcance', topReach, 'Alcance', function(m) { return fmtNum(m.reach); }),
      ContentTable('Top Conteúdos Engajamento', topEng, '% Eng. geral', function(m) {
        return m.reach > 0 ? (m.eng / m.reach * 100).toFixed(2) + '%' : '0%';
      }),
      headlinesCard
    )
  );
}
