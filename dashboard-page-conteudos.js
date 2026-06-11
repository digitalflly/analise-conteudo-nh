/* dashboard-page-conteudos.js — Page 2: Dados dos Conteúdos */

function PageConteudos(props) {
  var month = props.month;
  var weekIso = props.weekIso;
  var client = props.client;
  var h = React.createElement;
  var DATA = window.DASHBOARD_DATA;
  var media = (client === DATA.ACCOUNTS[0].id) ? (window.MEDIA_DATA || []) : [];
  var acc = DATA.ACCOUNTS.find(function(a) { return a.id === client; }) || {};
  var followers = acc.followers || 0;

  /* Filter media by month/week */
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

  /* Show 5 most recent */
  var items = filtered.slice(0, 5);

  if (items.length === 0) {
    return h(EmptyState, { message: 'Nenhum conteúdo encontrado para o período selecionado' });
  }

  var typeLabels = { REELS: 'Reel', CAROUSEL_ALBUM: 'Carrossel', IMAGE: 'Imagem', VIDEO: 'Vídeo' };

  function formatDate(ts) {
    var parts = ts.split('T')[0].split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  var cards = items.map(function(m) {
    var engFollowers = followers > 0 ? (m.eng / followers * 100) : 0;

    return h('div', { key: m.id, style: {
      background: COLORS.white, borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(39,21,13,.06)',
      display: 'flex', flexDirection: 'column', width: 240, flex: '0 0 240px',
    }},
      /* Thumbnail — image-slot (user drops cover here) */
      h('div', { style: { position: 'relative', width: '100%', height: 240 } },
        h('image-slot', {
          id: 'media-' + m.id,
          shape: 'rect',
          fit: 'cover',
          placeholder: 'Arraste a capa',
          style: { width: '100%', height: '100%', display: 'block', background: COLORS.cream },
        }),
        h('span', { style: {
          position: 'absolute', top: 10, left: 10, fontSize: 10, fontWeight: 700,
          padding: '3px 8px', borderRadius: 6,
          background: 'rgba(39,21,13,.7)', color: '#fff',
          pointerEvents: 'none',
        }}, typeLabels[m.type] || m.type),
        h('span', { style: {
          position: 'absolute', bottom: 10, right: 10, fontSize: 10, fontWeight: 600,
          padding: '3px 8px', borderRadius: 6,
          background: 'rgba(39,21,13,.7)', color: '#fff',
          pointerEvents: 'none',
        }}, formatDate(m.ts))
      ),

      /* Interaction row (like Instagram) */
      h('div', { style: { display: 'flex', justifyContent: 'space-around', padding: '12px 8px', borderBottom: '1px solid ' + COLORS.cream } },
        h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 } },
          h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: COLORS.espresso, strokeWidth: 2 },
            h('path', { d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' })
          ),
          h('span', { style: { fontSize: 11, fontWeight: 600, color: COLORS.espresso } }, fmtNum(m.likes))
        ),
        h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 } },
          h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: COLORS.espresso, strokeWidth: 2 },
            h('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })
          ),
          h('span', { style: { fontSize: 11, fontWeight: 600, color: COLORS.espresso } }, fmtNum(m.comments))
        ),
        h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 } },
          h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: COLORS.espresso, strokeWidth: 2 },
            h('path', { d: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8' }),
            h('polyline', { points: '16 6 12 2 8 6' }),
            h('line', { x1: 12, y1: 2, x2: 12, y2: 15 })
          ),
          h('span', { style: { fontSize: 11, fontWeight: 600, color: COLORS.espresso } }, fmtNum(m.shares))
        ),
        h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 } },
          h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: COLORS.espresso, strokeWidth: 2 },
            h('path', { d: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' })
          ),
          h('span', { style: { fontSize: 11, fontWeight: 600, color: COLORS.espresso } }, fmtNum(m.saves))
        )
      ),

      /* Metrics */
      h('div', { style: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('span', { style: { fontSize: 11, fontWeight: 500, color: COLORS.mocha } }, 'Visualizações'),
          h('span', { style: { fontSize: 13, fontWeight: 700, color: COLORS.espresso } }, fmtNum(m.views))
        ),
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('span', { style: { fontSize: 11, fontWeight: 500, color: COLORS.mocha } }, 'Alcance'),
          h('span', { style: { fontSize: 13, fontWeight: 700, color: COLORS.espresso } }, fmtNum(m.reach))
        ),
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('span', { style: { fontSize: 11, fontWeight: 500, color: COLORS.mocha } }, '% Eng. seguidor'),
          h('span', { style: { fontSize: 13, fontWeight: 700, color: COLORS.cocoa } }, engFollowers.toFixed(2) + '%')
        )
      )
    );
  });

  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
    h('div', { style: { display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 } }, cards)
  );
}
