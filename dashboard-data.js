/* dashboard-data.js — Windsor.ai-backed data layer
   buildDashboardData(raw) rebuilds the whole computed model from raw inputs,
   so the same code path serves the embedded offline seed AND a live /api/refresh.
   raw = {
     profile: { name, handle, initial, followers },
     daily:   [ { date, views, reach, interactions, taps, shares, likes, comments, saves } ],
     follows: [ { date, net } ],          // net daily follows/unfollows
     media:   [ { ts/timestamp, ... } ],  // optional — used to compute POST_COUNTS
     postCounts: { isoWeek: count }        // optional — used if media not given
   } */
(function () {
  var ACCOUNT_ID = 'main';
  var MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtDM(dateStr) { var p = dateStr.split('-'); return p[2] + '/' + p[1]; }

  function isoWeek(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    var w1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  }

  function generateWeeks(minStr, maxStr) {
    var weeks = [];
    var d = new Date(minStr + 'T12:00:00');
    d.setDate(d.getDate() - (d.getDay() + 6) % 7); /* back to Monday */
    var end = new Date(maxStr + 'T12:00:00');
    var guard = 0;
    while (d <= end && guard++ < 400) {
      var start = new Date(d);
      var sun = new Date(d); sun.setDate(sun.getDate() + 6);
      var iso = isoWeek(fmtISO(start));
      weeks.push({
        iso: iso, year: start.getFullYear(),
        label: 'S' + pad(iso) + ' - ' + fmtDM(fmtISO(start)) + ' a ' + fmtDM(fmtISO(sun)),
        start: fmtISO(start), end: fmtISO(sun),
      });
      d.setDate(d.getDate() + 7);
    }
    return weeks;
  }

  function generateMonths(months) {
    return months.map(function (m) { return { value: m, label: MONTH_NAMES[m - 1] }; });
  }

  function computePostCounts(media) {
    var counts = {};
    (media || []).forEach(function (m) {
      var ts = m.ts || m.timestamp || '';
      var date = String(ts).split('T')[0];
      if (!date) return;
      var w = isoWeek(date);
      counts[w] = (counts[w] || 0) + 1;
    });
    return counts;
  }

  window.buildDashboardData = function (raw) {
    var profile = raw.profile || {};
    var ACCOUNTS = [{
      id: ACCOUNT_ID,
      name: profile.name || '',
      handle: profile.handle || '',
      initial: profile.initial || 'NH',
      followers: profile.followers || 0,
    }];

    /* daily rows, sorted ascending by date */
    var dailyParsed = (raw.daily || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var dailyByAccount = {}; dailyByAccount[ACCOUNT_ID] = dailyParsed;

    var dateSet = {}; dailyParsed.forEach(function (r) { dateSet[r.date] = 1; });
    var minDate = dailyParsed.length ? dailyParsed[0].date : fmtISO(new Date());
    var maxDate = dailyParsed.length ? dailyParsed[dailyParsed.length - 1].date : minDate;

    var WEEKS = generateWeeks(minDate, maxDate);

    var monthsPresent = [];
    dailyParsed.forEach(function (r) {
      var m = parseInt(r.date.split('-')[1], 10);
      if (monthsPresent.indexOf(m) === -1) monthsPresent.push(m);
    });
    monthsPresent.sort(function (a, b) { return a - b; });
    var MONTHS = generateMonths(monthsPresent);

    var POST_COUNTS = raw.postCounts || computePostCounts(raw.media);

    var currentFollowers = profile.followers || 0;
    var FOLLOWER_DAILY = (raw.follows || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var followerTimeline = [];
    if (FOLLOWER_DAILY.length) {
      var cum = currentFollowers;
      var arr = FOLLOWER_DAILY.slice().reverse(); /* newest first */
      var result = [{ date: arr[0].date, followers: cum }];
      for (var i = 1; i < arr.length; i++) {
        cum = cum - (arr[i - 1].net || 0);
        result.push({ date: arr[i].date, followers: cum });
      }
      result.reverse();
      followerTimeline = result;
    }

    function getDaily(accountId, month, weekIso) {
      var rows = dailyByAccount[accountId] || [];
      if (month) rows = rows.filter(function (r) { return parseInt(r.date.split('-')[1], 10) === month; });
      if (weekIso) {
        var wk = WEEKS.find(function (w) { return w.iso === weekIso; });
        if (wk) rows = rows.filter(function (r) { return r.date >= wk.start && r.date <= wk.end; });
      }
      return rows;
    }

    function getFollowerTimeline(accountId, month, weekIso) {
      if (accountId !== ACCOUNT_ID) return [];
      var rows = followerTimeline;
      if (month) rows = rows.filter(function (r) { return parseInt(r.date.split('-')[1], 10) === month; });
      if (weekIso) {
        var wk = WEEKS.find(function (w) { return w.iso === weekIso; });
        if (wk) rows = rows.filter(function (r) { return r.date >= wk.start && r.date <= wk.end; });
      }
      return rows;
    }

    function aggregateDaily(accountId, month, weekIso) {
      var rows = getDaily(accountId, month, weekIso);
      var acc = ACCOUNTS.find(function (a) { return a.id === accountId; });
      var accFollowers = acc ? acc.followers : 0;
      var t = { views:0, reach:0, interactions:0, taps:0, shares:0, likes:0, comments:0, saves:0, followers: accFollowers };
      rows.forEach(function (r) {
        t.views += r.views || 0; t.reach += r.reach || 0; t.interactions += r.interactions || 0;
        t.taps += r.taps || 0; t.shares += r.shares || 0; t.likes += r.likes || 0;
        t.comments += r.comments || 0; t.saves += r.saves || 0;
      });
      t.engRateGeneral = t.reach > 0 ? (t.interactions / t.reach * 100) : 0;
      t.engRateFollowers = accFollowers > 0 ? (t.interactions / accFollowers * 100) : 0;
      var weekIsos = [];
      if (weekIso) { weekIsos = [weekIso]; }
      else {
        WEEKS.forEach(function (w) {
          if (!month || parseInt(w.start.split('-')[1], 10) === month || parseInt(w.end.split('-')[1], 10) === month) weekIsos.push(w.iso);
        });
      }
      t.postCount = 0;
      weekIsos.forEach(function (iso) { t.postCount += POST_COUNTS[iso] || 0; });
      return t;
    }

    /* Default week = last COMPLETE week that has data (end strictly before today). */
    var todayStr = fmtISO(new Date());
    function weekHasData(w) { return dailyParsed.some(function (r) { return r.date >= w.start && r.date <= w.end; }); }
    var DEFAULT_WEEK = null;
    for (var wi = WEEKS.length - 1; wi >= 0; wi--) {
      if (WEEKS[wi].end < todayStr && weekHasData(WEEKS[wi])) { DEFAULT_WEEK = WEEKS[wi].iso; break; }
    }
    if (DEFAULT_WEEK == null) {
      for (var wj = WEEKS.length - 1; wj >= 0; wj--) { if (weekHasData(WEEKS[wj])) { DEFAULT_WEEK = WEEKS[wj].iso; break; } }
    }
    if (DEFAULT_WEEK == null && WEEKS.length) DEFAULT_WEEK = WEEKS[WEEKS.length - 1].iso;

    function getWeekComparison(accountId) {
      var di = WEEKS.findIndex(function (w) { return w.iso === DEFAULT_WEEK; });
      if (di < 1) return null;
      var lastWeek = WEEKS[di], prevWeek = WEEKS[di - 1];
      var last = aggregateDaily(accountId, null, lastWeek.iso);
      var prev = aggregateDaily(accountId, null, prevWeek.iso);
      var changes = {};
      ['views','reach','interactions','taps','shares','likes','comments','saves','postCount'].forEach(function (k) {
        changes[k] = prev[k] > 0 ? ((last[k] - prev[k]) / prev[k] * 100) : 0;
      });
      changes.engRateGeneral = prev.engRateGeneral > 0 ? ((last.engRateGeneral - prev.engRateGeneral) / prev.engRateGeneral * 100) : 0;
      changes.engRateFollowers = prev.engRateFollowers > 0 ? ((last.engRateFollowers - prev.engRateFollowers) / prev.engRateFollowers * 100) : 0;
      if (accountId === ACCOUNT_ID && followerTimeline.length > 0) {
        var lastWkF = (followerTimeline.filter(function (r) { return r.date >= lastWeek.start && r.date <= lastWeek.end; }).slice(-1)[0] || {}).followers;
        var prevWkF = (followerTimeline.filter(function (r) { return r.date >= prevWeek.start && r.date <= prevWeek.end; }).slice(-1)[0] || {}).followers;
        changes.followers = (lastWkF && prevWkF && prevWkF > 0) ? (lastWkF - prevWkF) / prevWkF * 100 : 0;
      } else { changes.followers = 0; }
      return changes;
    }

    return {
      ACCOUNTS: ACCOUNTS, WEEKS: WEEKS, MONTHS: MONTHS, POST_COUNTS: POST_COUNTS,
      DEFAULT_WEEK: DEFAULT_WEEK, minDate: minDate, maxDate: maxDate,
      aggregateDaily: aggregateDaily, getDaily: getDaily, isoWeek: isoWeek,
      getWeekComparison: getWeekComparison, getFollowerTimeline: getFollowerTimeline,
    };
  };

  /* ───── Embedded offline seed (last sync) ───── */
  var DAILY_RAW = [
    ['2026-01-01',7848,2573,63,0,3,46,0,6],
    ['2026-01-02',5242,2803,34,0,1,29,2,0],
    ['2026-01-03',688,218,7,0,0,9,0,0],
    ['2026-01-04',707,227,10,0,2,6,1,0],
    ['2026-01-05',10007,4235,123,0,8,93,7,6],
    ['2026-01-06',8210,5268,153,0,4,95,2,3],
    ['2026-01-07',13557,4734,269,0,27,167,5,23],
    ['2026-01-08',9252,6141,55,0,2,39,2,6],
    ['2026-01-09',7244,1331,51,0,3,42,0,0],
    ['2026-01-10',9862,4142,250,0,22,171,11,23],
    ['2026-01-11',6689,3001,43,0,2,35,1,0],
    ['2026-01-12',7218,3182,123,0,10,97,3,3],
    ['2026-01-13',1868,850,62,0,7,38,1,9],
    ['2026-01-14',664,342,21,0,3,18,0,0],
    ['2026-01-15',746,260,21,0,3,7,0,8],
    ['2026-01-16',632,315,0,0,1,1,0,0],
    ['2026-01-17',1141,270,16,0,4,5,1,2],
    ['2026-01-18',247,148,4,0,1,3,0,0],
    ['2026-01-19',3081,1256,22,0,1,13,3,3],
    ['2026-01-20',626,252,8,0,0,9,1,0],
    ['2026-01-21',425,207,14,0,3,4,0,4],
    ['2026-01-22',336,177,14,0,2,17,1,0],
    ['2026-01-23',285,149,0,0,1,6,0,0],
    ['2026-01-24',4107,1456,137,0,16,86,3,16],
    ['2026-01-25',1345,627,45,0,7,26,0,5],
    ['2026-01-26',22719,4243,414,0,27,245,2,71],
    ['2026-01-27',14545,3345,238,0,8,187,1,19],
    ['2026-01-28',13128,3927,304,0,19,188,43,27],
    ['2026-01-29',7876,2815,144,0,7,86,15,15],
    ['2026-01-30',6741,2772,126,0,3,96,12,10],
    ['2026-01-31',17950,3860,174,0,3,135,2,15],
    ['2026-02-01',7976,2373,105,0,3,70,9,18],
    ['2026-02-02',11393,2427,157,0,11,107,17,5],
    ['2026-02-03',6930,1880,107,0,9,72,8,6],
    ['2026-02-04',4362,1943,30,0,1,19,2,7],
    ['2026-02-05',26300,7742,783,0,34,646,14,54],
    ['2026-02-06',20818,6831,685,0,44,525,11,60],
    ['2026-02-07',9914,3854,244,0,15,175,6,32],
    ['2026-02-08',4227,2115,87,0,7,63,2,8],
    ['2026-02-09',12644,7573,237,1,24,165,2,22],
    ['2026-02-10',22559,9913,563,0,76,305,2,72],
    ['2026-02-11',14529,7007,315,0,45,186,2,28],
    ['2026-02-12',7314,4913,104,0,8,72,1,15],
    ['2026-02-13',6090,3499,74,0,9,46,0,7],
    ['2026-02-14',9107,5122,443,0,49,207,9,129],
    ['2026-02-15',5790,4655,80,0,8,46,4,14],
    ['2026-02-16',2887,1872,55,0,3,35,1,13],
    ['2026-02-17',1237,667,52,0,7,29,1,8],
    ['2026-02-18',33586,10709,228,0,19,137,3,49],
    ['2026-02-19',39964,11644,243,0,32,132,3,36],
    ['2026-02-20',30190,10270,257,0,26,161,6,31],
    ['2026-02-21',22589,10330,113,0,7,68,8,18],
    ['2026-02-22',27700,9772,166,0,14,114,3,16],
    ['2026-02-23',31059,10211,204,0,14,131,1,36],
    ['2026-02-24',24310,9131,181,1,15,111,1,34],
    ['2026-02-25',27574,11648,222,0,14,133,2,46],
    ['2026-02-26',25215,8969,213,0,20,138,2,28],
    ['2026-02-27',21308,7415,168,0,4,135,4,13],
    ['2026-02-28',22613,9127,135,0,13,83,0,25],
    ['2026-03-01',30315,14073,178,0,12,107,7,32],
    ['2026-03-02',34235,11820,183,2,13,107,4,33],
    ['2026-03-03',28338,9684,142,0,10,97,0,18],
    ['2026-03-04',29489,10398,153,3,11,88,0,37],
    ['2026-03-05',28176,10729,111,0,6,61,1,35],
    ['2026-03-06',23143,9458,77,0,4,46,0,23],
    ['2026-03-07',28625,12341,104,1,13,47,0,31],
    ['2026-03-08',25834,10728,65,0,10,27,0,18],
    ['2026-03-09',43190,17957,407,0,53,240,7,51],
    ['2026-03-10',44410,17861,301,0,41,177,4,37],
    ['2026-03-11',33311,14020,220,1,30,117,3,34],
    ['2026-03-12',23218,9720,122,0,14,66,0,27],
    ['2026-03-13',26169,11625,102,0,7,67,0,20],
    ['2026-03-14',26473,12486,137,0,24,60,0,29],
    ['2026-03-15',31634,14508,169,0,18,85,3,43],
    ['2026-03-16',34463,12235,143,1,12,68,4,43],
    ['2026-03-17',35527,12201,175,0,15,113,0,23],
    ['2026-03-18',33164,11354,160,1,13,99,2,26],
    ['2026-03-19',41894,16265,255,0,14,123,0,22],
    ['2026-03-20',38253,14491,922,0,104,367,7,334],
    ['2026-03-21',32988,14715,345,0,36,156,0,113],
    ['2026-03-22',29671,13886,252,0,38,109,1,65],
    ['2026-03-23',44143,18627,495,0,47,199,2,116],
    ['2026-03-24',31396,14626,271,1,32,115,2,70],
    ['2026-03-25',41278,12885,537,0,46,349,1,53],
    ['2026-03-26',37287,14016,403,0,40,233,10,60],
    ['2026-03-27',34177,14796,278,0,29,164,5,47],
    ['2026-03-28',25547,11683,196,1,27,85,7,45],
    ['2026-03-29',28171,13708,183,0,16,101,3,47],
    ['2026-03-30',29983,12786,218,0,30,101,3,54],
    ['2026-03-31',26962,10739,254,0,26,124,5,58],
    ['2026-04-01',28157,11663,279,1,36,135,3,58],
    ['2026-04-02',38563,18311,302,0,32,180,2,45],
    ['2026-04-03',31783,16308,231,0,34,115,2,39],
    ['2026-04-04',53535,36313,462,0,39,281,14,88],
    ['2026-04-05',31575,15731,253,0,35,132,4,41],
    ['2026-04-06',92681,26665,1281,2,54,467,22,63],
    ['2026-04-07',71399,24904,1445,0,139,551,19,342],
    ['2026-04-08',67960,31615,1816,0,283,903,10,321],
    ['2026-04-09',56187,21413,849,1,153,360,14,165],
    ['2026-04-10',39714,15703,387,2,56,158,3,108],
    ['2026-04-11',11132,4588,226,0,29,118,1,44],
    ['2026-04-12',9470,5247,161,0,28,75,0,28],
    ['2026-04-13',39037,14049,403,0,37,215,1,90],
    ['2026-04-14',69379,20843,543,0,33,249,2,100],
    ['2026-04-15',41146,20538,419,1,47,199,12,95],
    ['2026-04-16',33868,15425,315,0,44,149,6,67],
    ['2026-04-17',41907,18102,251,0,24,136,4,58],
    ['2026-04-18',29978,13699,191,0,19,94,1,55],
    ['2026-04-19',26165,13076,127,0,14,50,2,47],
    ['2026-04-20',22405,10157,146,0,17,76,1,34],
    ['2026-04-21',22928,12708,201,0,20,106,2,47],
    ['2026-04-22',32224,13478,316,0,33,177,5,43],
    ['2026-04-23',28738,9491,275,2,17,186,9,33],
    ['2026-04-24',29591,10254,1158,0,178,461,4,322],
    ['2026-04-25',10966,3294,265,0,40,133,1,48],
    ['2026-04-26',29896,3815,2079,0,281,1331,84,97],
    ['2026-04-27',25721,12711,822,0,136,435,17,96],
    ['2026-04-28',33127,14397,813,1,102,397,14,193],
    ['2026-04-29',29875,13680,434,0,51,225,5,99],
    ['2026-04-30',51394,20376,763,1,64,505,21,103],
    ['2026-05-01',22976,11579,275,0,30,155,5,53],
    ['2026-05-02',23449,13237,349,1,29,239,12,31],
    ['2026-05-03',22734,12506,310,1,41,178,1,46],
    ['2026-05-04',25462,13841,306,0,38,173,5,48],
    ['2026-05-05',38637,17746,1281,0,181,472,9,435],
    ['2026-05-06',31208,14746,646,0,110,268,7,148],
    ['2026-05-07',29286,13187,476,0,77,187,5,128],
    ['2026-05-08',23684,10762,656,0,86,373,14,95],
    ['2026-05-09',21504,11551,335,0,56,150,1,69],
    ['2026-05-10',16049,9086,262,0,32,137,0,56],
    ['2026-05-11',19024,10502,256,0,31,137,0,51],
    ['2026-05-12',21519,10468,351,0,56,139,26,72],
    ['2026-05-13',25775,12434,440,1,63,201,4,102],
    ['2026-05-14',33618,15520,470,0,69,223,6,96],
    ['2026-05-15',32697,15203,566,1,101,229,5,125],
    ['2026-05-16',22562,12054,337,0,64,126,0,83],
    ['2026-05-17',36854,17843,491,0,62,229,5,125],
    ['2026-05-18',39196,17420,773,0,103,355,8,200],
    ['2026-05-19',36752,15444,664,0,74,345,3,139],
    ['2026-05-20',37328,16222,541,1,53,314,6,105],
    ['2026-05-21',36385,16327,484,0,44,283,4,98],
    ['2026-05-22',29846,14244,337,1,38,170,5,76],
    ['2026-05-23',24147,13135,218,0,26,120,0,44],
    ['2026-05-24',29630,14356,361,0,37,215,2,66],
    ['2026-05-25',33156,16259,393,0,37,227,0,83],
    ['2026-05-26',45484,18878,620,4,35,433,14,85],
    ['2026-05-27',30722,15448,295,0,31,161,1,69],
    ['2026-05-28',38821,18579,388,0,31,231,1,86],
    ['2026-05-29',33417,17999,259,0,36,120,2,64],
    ['2026-05-30',37626,17439,332,2,36,187,3,56],
    ['2026-05-31',47425,18809,572,1,41,377,3,70],
    ['2026-06-01',52801,23627,647,0,46,355,9,172],
    ['2026-06-02',54180,27171,639,0,87,314,5,144],
    ['2026-06-03',56045,24095,695,2,81,376,6,145],
    ['2026-06-04',47895,23318,442,0,44,266,5,73],
    ['2026-06-05',37565,19355,335,0,37,155,3,99],
    ['2026-06-06',40110,18932,233,0,31,103,0,68],
    ['2026-06-07',42165,21677,306,0,27,167,6,75],
    ['2026-06-08',58469,24960,514,2,81,254,2,87],
    ['2026-06-09',58555,25109,444,0,49,241,7,90],
    ['2026-06-10',55760,26224,408,0,44,237,6,62],
    ['2026-06-11',14633,7738,67,0,5,41,1,14],
  ];
  var DAILY_KEYS = ['date','views','reach','interactions','taps','shares','likes','comments','saves'];
  var dailySeed = DAILY_RAW.map(function (r) { var o = {}; DAILY_KEYS.forEach(function (k, i) { o[k] = r[i]; }); return o; });

  var FOLLOWER_DAILY = [
    ['2026-01-01',81],
    ['2026-01-02',86],
    ['2026-01-03',61],
    ['2026-01-04',68],
    ['2026-01-05',64],
    ['2026-01-06',64],
    ['2026-01-07',52],
    ['2026-01-08',63],
    ['2026-01-09',57],
    ['2026-01-10',54],
    ['2026-01-11',68],
    ['2026-01-12',83],
    ['2026-01-13',61],
    ['2026-01-14',50],
    ['2026-01-15',58],
    ['2026-01-16',45],
    ['2026-01-17',42],
    ['2026-01-18',48],
    ['2026-01-19',62],
    ['2026-01-20',46],
    ['2026-01-21',58],
    ['2026-01-22',49],
    ['2026-01-23',38],
    ['2026-01-24',45],
    ['2026-01-25',65],
    ['2026-01-26',94],
    ['2026-01-27',74],
    ['2026-01-28',51],
    ['2026-01-29',44],
    ['2026-01-30',47],
    ['2026-01-31',48],
    ['2026-02-01',53],
    ['2026-02-02',54],
    ['2026-02-03',55],
    ['2026-02-04',44],
    ['2026-02-05',49],
    ['2026-02-06',45],
    ['2026-02-07',62],
    ['2026-02-08',60],
    ['2026-02-09',53],
    ['2026-02-10',41],
    ['2026-02-11',39],
    ['2026-02-12',48],
    ['2026-02-13',43],
    ['2026-02-14',44],
    ['2026-02-15',62],
    ['2026-02-16',41],
    ['2026-02-17',70],
    ['2026-02-18',103],
    ['2026-02-19',82],
    ['2026-02-20',54],
    ['2026-02-21',69],
    ['2026-02-22',88],
    ['2026-02-23',67],
    ['2026-02-24',71],
    ['2026-02-25',83],
    ['2026-02-26',66],
    ['2026-02-27',44],
    ['2026-02-28',73],
    ['2026-03-01',77],
    ['2026-03-02',70],
    ['2026-03-03',73],
    ['2026-03-04',68],
    ['2026-03-05',55],
    ['2026-03-06',62],
    ['2026-03-07',55],
    ['2026-03-08',57],
    ['2026-03-09',82],
    ['2026-03-10',97],
    ['2026-03-11',287],
    ['2026-03-12',137],
    ['2026-03-13',85],
    ['2026-03-14',83],
    ['2026-03-15',98],
    ['2026-03-16',89],
    ['2026-03-17',80],
    ['2026-03-18',74],
    ['2026-03-19',90],
    ['2026-03-20',117],
    ['2026-03-21',103],
    ['2026-03-22',119],
    ['2026-03-23',115],
    ['2026-03-24',137],
    ['2026-03-25',127],
    ['2026-03-26',103],
    ['2026-03-27',112],
    ['2026-03-28',110],
    ['2026-03-29',126],
    ['2026-03-30',117],
    ['2026-03-31',119],
    ['2026-04-01',99],
    ['2026-04-02',92],
    ['2026-04-03',127],
    ['2026-04-04',223],
    ['2026-04-05',147],
    ['2026-04-06',150],
    ['2026-04-07',147],
    ['2026-04-08',140],
    ['2026-04-09',139],
    ['2026-04-10',137],
    ['2026-04-11',82],
    ['2026-04-12',77],
    ['2026-04-13',78],
    ['2026-04-14',126],
    ['2026-04-15',134],
    ['2026-04-16',109],
    ['2026-04-17',112],
    ['2026-04-18',105],
    ['2026-04-19',84],
    ['2026-04-20',94],
    ['2026-04-21',103],
    ['2026-04-22',100],
    ['2026-04-23',107],
    ['2026-04-24',71],
    ['2026-04-25',67],
    ['2026-04-26',218],
    ['2026-04-27',145],
    ['2026-04-28',128],
    ['2026-04-29',121],
    ['2026-04-30',133],
    ['2026-05-01',109],
    ['2026-05-02',101],
    ['2026-05-03',125],
    ['2026-05-04',128],
    ['2026-05-05',239],
    ['2026-05-06',170],
    ['2026-05-07',95],
    ['2026-05-08',81],
    ['2026-05-09',69],
    ['2026-05-10',95],
    ['2026-05-11',90],
    ['2026-05-12',97],
    ['2026-05-13',107],
    ['2026-05-14',102],
    ['2026-05-15',110],
    ['2026-05-16',99],
    ['2026-05-17',136],
    ['2026-05-18',120],
    ['2026-05-19',115],
    ['2026-05-20',119],
    ['2026-05-21',130],
    ['2026-05-22',121],
    ['2026-05-23',89],
    ['2026-05-24',106],
    ['2026-05-25',126],
    ['2026-05-26',106],
    ['2026-05-27',96],
    ['2026-05-28',94],
    ['2026-05-29',97],
    ['2026-05-30',115],
    ['2026-05-31',131],
    ['2026-06-01',145],
    ['2026-06-02',124],
    ['2026-06-03',127],
    ['2026-06-04',103],
    ['2026-06-05',96],
    ['2026-06-06',94],
    ['2026-06-07',103],
    ['2026-06-08',195],
    ['2026-06-09',124],
    ['2026-06-10',136],
    ['2026-06-11',0],
  ];
  var followsSeed = FOLLOWER_DAILY.map(function (r) { return { date: r[0], net: r[1] }; });

  var POST_COUNTS_SEED = {2:3,3:1,4:1,5:9,6:3,7:4,8:2,11:1,12:1,13:3,14:2,15:4,16:2,17:3,18:7,19:3,20:3,21:4,22:4,23:3,24:2};

  window.DASHBOARD_SEED = {
    profile: { name: 'Nathalia Heringer', handle: '@nathalia.heringer', initial: 'NH', followers: 104034 },
    daily: dailySeed, follows: followsSeed, postCounts: POST_COUNTS_SEED,
    lastSync: '2026-06-11',
  };

  window.DASHBOARD_DATA = window.buildDashboardData(window.DASHBOARD_SEED);
})();
