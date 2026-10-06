/* ---------- Chapter: Calendar (day view, month heatmap) ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.chapters = CeoDash.chapters || {};
  var el = CeoDash.core.dom.el;
  var fmt = CeoDash.core.format;

  var K2 = CeoDash.explorer.lgKit;
  var WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function dateKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function realCalScope(data, path) {
    var parent = data.org;
    for (var i = 0; i < path.length; i++) {
      var e = data.byId[path[i].id];
      if (e && (e.level === 'region' || e.level === 'office')) { parent = e; }
    }
    return { parent: parent, children: [], childLevel: null };
  }
  function isoDay(d) { return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate(); }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function parseKey(k) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(k || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function dayRange() {
    var r = CeoDash.data.REAL_DAILY_RANGE || {};
    var today = startOfDay(new Date());
    var lo = parseKey(r.from), hi = parseKey(r.to);
    if (hi && hi > today) { hi = today; }
    return { lo: lo, hi: hi || today };
  }
  function clampDay(d) {
    var r = dayRange();
    if (r.lo && d < r.lo) { return r.lo; }
    if (r.hi && d > r.hi) { return r.hi; }
    return d;
  }
  function outOfRange(d) {
    var r = dayRange();
    return !!((r.lo && d < r.lo) || (r.hi && d > r.hi));
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function longDateLabel(d) { return d.getDate() + ' ' + MONTH_LABELS[d.getMonth()] + ' ' + d.getFullYear(); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function realDayFigures(entity, date) {
    var range = CeoDash.data.REAL_DAILY_RANGE || {};
    var key = date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    var inWindow = !!range.from && key >= range.from && key <= range.to;
    var row = (inWindow && entity && entity.realDaily) ? entity.realDaily[key] : null;
    if (!row || (row[0] === 0 && row[2] === 0)) {
      return { disbursed: 0, received: 0, loans: 0, txns: 0, online: NaN, cash: NaN, inWindow: inWindow, hasActivity: false, activityCount: 0 };
    }
    return { disbursed: row[1], received: row[3], loans: row[0], txns: row[2], online: NaN, cash: NaN,
             inWindow: true, hasActivity: true, activityCount: row[0] + row[2] };
  }

  function dayFigures(entity, date) { return realDayFigures(entity, date); }

  function usualFor(entity, date) {
    var sum = 0, n = 0;
    for (var w = 1; w <= 4; w++) {
      var f = dayFigures(entity, addDays(date, -7 * w));
      if (f.inWindow && f.hasActivity) { sum += f.received; n++; }
    }
    return n ? sum / n : NaN;
  }
  function vsUsual(entity, date, figs) {
    var u = usualFor(entity, date);
    if (fmt.missing(u) || !(u > 0) || !figs.hasActivity) { return ''; }
    var d = figs.received / u - 1;
    return (d >= 0 ? '+' : '') + Math.round(d * 100) + '% vs a usual ' + WEEKDAY_LABELS[date.getDay()];
  }
  function online(r) { return (r.upiAmount || 0) + (r.posAmount || 0) + (r.autoAmount || 0); }

  function buildTodaysAttention(data, date, rows) {
    var items = [];
    var orgFigs = dayFigures(data.org, date);
    if (!orgFigs.inWindow) {
      return [{ role: 'neutral', title: 'No data for this date', detail: 'Daily figures are kept for the current financial year.', districtId: null }];
    }
    var cmp = vsUsual(data.org, date, orgFigs);
    if (cmp) {
      items.push({ role: cmp.charAt(0) === '+' ? 'repay' : 'risk', title: 'Statewide collections ' + cmp,
                   detail: fmt.compactCr(orgFigs.received) + ' from ' + fmt.number(orgFigs.txns) + ' repayments', districtId: null });
    }
    var act = data.regions.map(function (r) { return { r: r, f: dayFigures(r, date) }; }).filter(function (x) { return x.f.hasActivity; });
    var byRecv = act.slice().sort(function (a, b) { return b.f.received - a.f.received; });
    if (byRecv.length && byRecv[0].f.received > 0) {
      items.push({ role: 'repay', title: 'Highest collections — ' + byRecv[0].r.name,
                   detail: fmt.compactCr(byRecv[0].f.received) + ' from ' + fmt.number(byRecv[0].f.txns) + ' repayments', districtId: byRecv[0].r.id });
    }
    var byDisb = act.slice().sort(function (a, b) { return b.f.disbursed - a.f.disbursed; });
    if (byDisb.length && byDisb[0].f.disbursed > 0) {
      items.push({ role: 'loan', title: 'Highest disbursement — ' + byDisb[0].r.name,
                   detail: fmt.compactCr(byDisb[0].f.disbursed) + ' to ' + fmt.number(byDisb[0].f.loans) + ' loans', districtId: byDisb[0].r.id });
    }
    if (rows && rows.length) {
      var cashy = rows.filter(function (r) { return (r.repaid || 0) > 0; }).map(function (r) {
        return { r: r, cash: Math.max(0, r.repaid - online(r)) };
      }).sort(function (a, b) { return b.cash - a.cash; });
      if (cashy.length && cashy[0].cash > 0) {
        var reg = null;
        data.regions.forEach(function (g) { if (g.districtId === cashy[0].r.id || g.id === cashy[0].r.id) { reg = g; } });
        items.push({ role: 'risk', title: 'Most cash collected — ' + (reg ? reg.name : cashy[0].r.name),
                     detail: fmt.compactCr(cashy[0].cash) + ' manual · ' + fmt.percent(cashy[0].cash / cashy[0].r.repaid) + ' of its collections', districtId: reg ? reg.id : null });
      }
    }
    var idle = data.regions.length - act.length;
    if (idle > 0) {
      items.push({ role: 'neutral', title: idle + (idle === 1 ? ' district' : ' districts') + ' with no activity',
                   detail: 'No loan or repayment recorded on ' + longDateLabel(date) + '.', districtId: null });
    }
    if (!items.length) { items.push({ role: 'neutral', title: 'Nothing recorded', detail: 'No loans or repayments on ' + longDateLabel(date) + '.', districtId: null }); }
    return items.slice(0, 5);
  }

  function roleDotStyle(role) {
    if (role === 'neutral') { return { background: '#94A3B8' }; }
    return null;
  }

  function attentionItemEl(item, router) {
    return el('div', {
      className: 'cd-cal-attn-item', role: 'button', tabIndex: '0',
      onClick: function () {
        if (item.districtId) { router.drillInto('region', item.districtId); }
      }
    }, [
      el('span', { className: 'cd-cal-attn-item__dot', 'data-cd-role': item.role === 'neutral' ? undefined : ('bg-' + item.role), style: roleDotStyle(item.role) }),
      el('div', {}, [
        el('div', { className: 'cd-cal-attn-item__title' }, item.title),
        el('div', { className: 'cd-cal-attn-item__detail cd-text-muted' }, item.detail)
      ])
    ]);
  }

  function mixHex(a, b, t) {
    function c(h, i) { return parseInt(h.substr(i, 2), 16); }
    t = Math.max(0, Math.min(1, t));
    return 'rgb(' + Math.round(c(a, 1) + (c(b, 1) - c(a, 1)) * t) + ',' + Math.round(c(a, 3) + (c(b, 3) - c(a, 3)) * t) + ',' +
           Math.round(c(a, 5) + (c(b, 5) - c(a, 5)) * t) + ')';
  }
  var HEAT_LO = '#fde7c4', HEAT_HI = '#9a3412';
  function dayZones(data, date, router) {
    var crumb = [];                       /* nodes opened inside the section */
    var box = el('div', { className: 'cd-dz' });
    var holder = el('div', {});
    var iso = isoDay(date);
    function online(f) { return f.upi + f.pos + f.auto; }
    function card(n, color, root, onOpen) {
      var f = n.fig, on = online(f), cash = Math.max(0, f.repaid - on);
      var active = f.repaid > 0 || f.disbursed > 0;
      var sub = n.kind === 'dgm' || n.kind === 'agm' || n.kind === 'officer'
        ? (function () { var c = { agm: 0, officer: 0, mandal: 0 }; (function walk(x) { if (c[x.kind] !== undefined) { c[x.kind]++; } x.children.forEach(walk); })(n);
            return (n.kind === 'dgm' ? c.agm + ' AGMs \u00b7 ' : '') + (n.kind !== 'officer' ? c.officer + ' managers \u00b7 ' : '') + c.mandal + ' mandals'; })()
        : n.role;
      return el('div', K2.withProps({ className: 'cd-dz-card' + (active ? '' : ' cd-dz-card--idle'), style: { borderTopColor: color } }, K2.onActivate(onOpen)), [
        el('div', { className: 'cd-dz-head' }, [
          el('i', { className: 'cd-dz-dot', style: { backgroundColor: color } }),
          el('div', { className: 'cd-dz-who' }, [el('strong', { title: n.name }, n.name), el('span', { title: sub }, sub)])
        ]),
        active ? el('div', { className: 'cd-dz-big' }, [el('strong', {}, fmt.compactCr(f.repaid)), el('span', {}, ' collected')]) : el('div', { className: 'cd-dz-idle' }, 'No activity on this day'),
        active ? el('div', { className: 'cd-dz-bar' }, [
          el('div', { style: { width: (f.repaid > 0 ? on / f.repaid * 100 : 0) + '%', backgroundColor: '#2563eb' } }),
          el('div', { style: { width: (f.repaid > 0 ? cash / f.repaid * 100 : 0) + '%', backgroundColor: '#b45309' } })
        ]) : null,
        active ? el('div', { className: 'cd-dz-stats' }, [
          el('div', {}, [el('span', {}, 'Repayments'), el('strong', {}, fmt.number(f.txns))]),
          el('div', {}, [el('span', {}, 'Online'), el('strong', { style: { color: '#1d4ed8' } }, f.repaid > 0 ? fmt.percent(on / f.repaid) : '\u2014')]),
          el('div', {}, [el('span', {}, 'Cash'), el('strong', { style: { color: '#b45309' } }, fmt.compactCr(cash))]),
          el('div', {}, [el('span', {}, 'Loans'), el('strong', {}, fmt.number(f.loans) + ' \u00b7 ' + fmt.compactCr(f.disbursed))])
        ]) : null
      ]);
    }
    function draw(root) {
      K2.clearBox(holder);
      var cur = crumb.length ? crumb[crumb.length - 1] : root;
      var kids = cur.children.filter(function (k) { return !(k.id === CeoDash.employees.NONE && !(k.fig.repaid > 0) && !(k.fig.disbursed > 0)); })
        .sort(function (a, b) { return (b.fig.repaid || 0) - (a.fig.repaid || 0); });
      var nav = el('div', { className: 'cd-dz-crumbs' }, [
        el('button', { type: 'button', className: 'cd-rp-crumb' + (crumb.length ? '' : ' cd-rp-crumb--here'), onClick: function () { crumb = []; draw(root); } }, 'All zones')
      ]);
      crumb.forEach(function (n, i) {
        nav.appendChild(el('span', { className: 'cd-rp-crumb-sep' }, '\u203a'));
        nav.appendChild(el('button', { type: 'button', className: 'cd-rp-crumb' + (i === crumb.length - 1 ? ' cd-rp-crumb--here' : ''),
          onClick: function () { crumb = crumb.slice(0, i + 1); draw(root); } }, n.name));
      });
      holder.appendChild(nav);
      var zoneOf = crumb.length ? crumb[0] : null;
      holder.appendChild(el('div', { className: 'cd-dz-grid' }, kids.map(function (k) {
        var color = CeoDash.employees.zoneColor(root, k.kind === 'dgm' ? k : zoneOf);
        return card(k, color, root, function () {
          if (k.kind === 'mandal') { router.goToChapter('calendar', [{ level: 'region', id: k.office.regionId }, { level: 'office', id: k.office.id }]); return; }
          crumb.push(k); draw(root);
        });
      })));
    }
    holder.appendChild(K2.loadingEl('Loading the day by zone...'));
    CeoDash.explorer.call({ action: 'drill', group: 'MANDAL', from: iso, to: isoDay(addDays(date, 1)) }, function (res) {
      K2.clearBox(holder);
      if (!res.ok) { holder.appendChild(CeoDash.explorer.failBox(res.error, function () {})); return; }
      var byKey = {};
      (res.body.rows || []).forEach(function (r) { byKey[r.districtId + '|' + r.id] = r; });
      var root = CeoDash.employees.tree(data, function (o) { return byKey[o.districtId + '|' + o.mandalId]; });
      draw(root);
    });
    box.appendChild(holder);
    return box;
  }

  var CAL_ZONE_COLORS = {
    'North Coastal Zone': '#0284C7', 'Central Godavari Zone': '#DB2777',
    'South Coastal Zone': '#B45309', 'Rayalaseema Zone': '#7C3AED'
  };

  /* Month view (state), day view (state) and the drilled day pages. The date chip sits in the
     page header and opens the month calendar; the chosen day is part of the address
     (#/calendar/day/yyyy-mm-dd) so Back and Forward move between month and day. */
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MAP_MODE = 'collected';
  var DAY_TAB = 'zones';
  var MONEY_COLORS = ['#fdebd3', '#f9c98f', '#f19a52', '#d9622b', '#9a3412'];
  var ONLINE_COLORS = ['#dc2626', '#f97316', '#facc15', '#86efac', '#15803d'];
  var ONLINE_STEPS = [0.8, 0.9, 0.95, 0.98];
  var RANK_COLORS = ['#2563eb', '#15803d', '#ea580c', '#e11d48', '#7c3aed'];
  var NO_DATA_FILL = '#e2e8f0';

  function shortDate(d) { return d.getDate() + ' ' + MONTH_SHORT[d.getMonth()] + ' ' + d.getFullYear(); }
  function fullDate(d) { return DAY_NAMES[d.getDay()] + ', ' + longDateLabel(d); }
  function money(v) { return fmt.compactCr(v).replace('.00 ', ' '); }
  function reps(n) { return fmt.number(n) + (n === 1 ? ' repayment' : ' repayments'); }
  function alive(node) { return document.body.contains(node); }

  /* 1-2-5 break points under the largest value, at most four of them */
  function niceSteps(max) {
    if (!(max > 0)) { return []; }
    var seq = [], p = 1;
    while (p <= max) { seq.push(p, p * 2, p * 5); p *= 10; }
    var top = -1;
    for (var i = 0; i < seq.length; i++) { if (seq[i] <= max * 0.75) { top = i; } }
    var out = [];
    for (var j = Math.max(0, top - 3); j <= top; j++) { out.push(seq[j]); }
    return out;
  }

  function dayRows(group, date, cb) {
    CeoDash.explorer.call({ action: 'drill', group: group, from: isoDay(date), to: isoDay(addDays(date, 1)) }, cb);
  }

  /* Online and total collected for one place on one day, from the server's day rows */
  function entityOnline(entity, date, cb) {
    var group = entity.level === 'office' ? 'MANDAL' : 'DISTRICT';
    dayRows(group, date, function (res) {
      if (!res.ok || res.body.payModes === false) { cb(false); return; }
      var on = 0, all = 0;
      (res.body.rows || []).forEach(function (r) {
        var hit = entity.level === 'org' ||
          (entity.level === 'region' && r.id === entity.districtId) ||
          (entity.level === 'office' && r.districtId === entity.districtId && r.id === entity.mandalId);
        if (hit) { all += r.repaid || 0; on += online(r); }
      });
      cb(all > 0 ? { on: on, all: all } : false);
    });
  }

  function monthSums(entity, y, m, lastDay) {
    var s = { repaid: 0, txns: 0, disbursed: 0, loans: 0, days: 0, covered: true };
    for (var d = 1; d <= lastDay; d++) {
      var f = dayFigures(entity, new Date(y, m, d));
      if (!f.inWindow) { s.covered = false; continue; }
      if (f.hasActivity) { s.repaid += f.received; s.txns += f.txns; s.disbursed += f.disbursed; s.loans += f.loans; s.days++; }
    }
    return s;
  }

  /* figures per district: amounts from the day cube, online share from the server rows */
  function districtFigs(rows, sumFor) {
    var byCode = {}, memo = {};
    (rows || []).forEach(function (r) { byCode[r.id] = r; });
    return function (g) {
      if (memo[g.id]) { return memo[g.id]; }
      var s = sumFor(g), r = byCode[g.districtId];
      memo[g.id] = { repaid: s.repaid, txns: s.txns, loans: s.loans, disbursed: s.disbursed,
                     share: r && r.repaid > 0 ? online(r) / r.repaid : NaN };
      return memo[g.id];
    };
  }

  function kpi(label, value, sub, side) {
    return el('div', { className: 'cd-cv-kpi' }, [
      el('div', { className: 'cd-cv-kpi-text' }, [
        el('div', { className: 'cd-cv-kpi-label' }, label),
        el('div', { className: 'cd-cv-kpi-val' }, value),
        el('div', { className: 'cd-cv-kpi-sub' }, sub)
      ]),
      side
    ]);
  }
  function kpiIcon(glyph, bg) { return el('div', { className: 'cd-cv-kpi-icon', style: { backgroundColor: bg } }, glyph); }
  function trend(cur, prev, text) {
    if (!(prev > 0)) { return el('span', {}, 'no figure for ' + text.replace(/^vs /, '')); }
    var d = cur / prev - 1, up = d >= 0;
    return el('span', { className: up ? 'cd-cv-up' : 'cd-cv-down' }, (up ? '↑ ' : '↓ ') + Math.abs(Math.round(d * 100)) + '% ' + text);
  }
  function donut(share) {
    var r = 22, c = 2 * Math.PI * r, on = fmt.missing(share) ? 0 : Math.max(0, Math.min(1, share));
    var box = el('div', { className: 'cd-cv-donut' });
    box.innerHTML = '<svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true">' +
      '<circle cx="29" cy="29" r="' + r + '" fill="none" stroke="#fed7aa" stroke-width="8"></circle>' +
      '<circle cx="29" cy="29" r="' + r + '" fill="none" stroke="#0284c7" stroke-width="8" stroke-dasharray="' +
      (c * on).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 29 29)"></circle></svg>';
    return box;
  }

  function dayKpis(f, o) {
    var ready = !!(o && o.all > 0);
    var wait = o === null ? 'loading…' : 'not available';
    var cash = ready ? Math.max(0, o.all - o.on) : NaN;
    function share(v) { return ready ? fmt.percent(v / o.all) + ' of collected' : (f.received > 0 ? wait : 'no collections'); }
    return el('div', { className: 'cd-cv-kpis' }, [
      kpi('Collected', money(f.received), reps(f.txns || 0), kpiIcon('💰', '#dcfce7')),
      kpi('Disbursed', money(f.disbursed), fmt.number(f.loans || 0) + ' loans', kpiIcon('🏦', '#fee2e2')),
      kpi('Paid online', ready ? money(o.on) : '—', share(ready ? o.on : 0), kpiIcon('📱', '#dbeafe')),
      kpi('Cash / Manual', ready ? money(cash) : '—', share(cash), kpiIcon('💵', '#ffedd5'))
    ]);
  }

  function districtMap(data, figFor, period, onlineReady, onPick) {
    var MODES = [['collected', 'Collections'], ['txns', 'Repayments'], ['online', 'Online %']];
    if (MAP_MODE === 'online' && !onlineReady) { MAP_MODE = 'collected'; }
    var box = el('div', { className: 'cd-em-map cd-cv-mapsvg' });
    box.innerHTML = global.__AP_SVG_HTML || '';
    var svg = box.querySelector('svg');
    if (svg) { svg.removeAttribute('id'); svg.setAttribute('class', 'cd-em-svg'); }
    var title = el('h3', {});
    var pills = el('div', { className: 'cd-cv-pills' });
    var legend = el('div', { className: 'cd-cv-legend' });
    var info = el('div', { className: 'cd-cv-mapinfo' });
    var paths = box.querySelectorAll('path.dp');

    function value(f) { return MAP_MODE === 'collected' ? f.repaid : MAP_MODE === 'txns' ? f.txns : f.share; }
    function label(v) { return MAP_MODE === 'collected' ? money(v) : MAP_MODE === 'txns' ? fmt.number(v) : fmt.percent(v, 0); }
    function scale() {
      if (MAP_MODE === 'online') { return { steps: ONLINE_STEPS, colors: ONLINE_COLORS }; }
      var max = 0;
      data.regions.forEach(function (g) { var v = value(figFor(g)); if (v > max) { max = v; } });
      var steps = niceSteps(max);
      return { steps: steps, colors: MONEY_COLORS.slice(MONEY_COLORS.length - steps.length - 1) };
    }
    function colorOf(sc, v) {
      if (fmt.missing(v) || (MAP_MODE !== 'online' && !(v > 0))) { return NO_DATA_FILL; }
      var k = 0;
      for (var i = 0; i < sc.steps.length; i++) { if (v >= sc.steps[i]) { k = i + 1; } }
      return sc.colors[k];
    }
    function row(k, v) { return el('div', { className: 'cd-cv-mapinfo-row' }, [el('span', {}, k), el('strong', {}, v)]); }
    function show(g) {
      K2.clearBox(info);
      if (!g) { info.appendChild(el('div', { className: 'cd-cv-hint' }, 'Point at a district to see its figures; click to open it.')); return; }
      var f = figFor(g);
      info.appendChild(el('div', { className: 'cd-cv-mapinfo-title' }, g.name));
      info.appendChild(row('Collected', money(f.repaid)));
      info.appendChild(row('Repayments', fmt.number(f.txns)));
      info.appendChild(row('Online', fmt.missing(f.share) ? '—' : fmt.percent(f.share)));
      info.appendChild(row('Loans', fmt.number(f.loans) + ' · ' + money(f.disbursed)));
    }
    function paint() {
      var sc = scale();
      for (var p = 0; p < paths.length; p++) {
        var g = data.byId[paths[p].getAttribute('data-id')];
        paths[p].setAttribute('fill', g ? colorOf(sc, value(figFor(g))) : NO_DATA_FILL);
      }
      title.textContent = 'Andhra Pradesh - ' + (MAP_MODE === 'collected' ? 'Collections' : MAP_MODE === 'txns' ? 'Repayments' : 'Online share') + ' (' + period + ')';
      K2.clearBox(pills);
      MODES.forEach(function (mm) {
        var off = mm[0] === 'online' && !onlineReady;
        pills.appendChild(el('button', { type: 'button', className: 'cd-cv-pill' + (MAP_MODE === mm[0] ? ' cd-cv-pill--on' : ''),
          disabled: off ? 'disabled' : undefined, title: off ? 'Payment modes are still loading' : undefined,
          onClick: function () { MAP_MODE = mm[0]; paint(); } }, mm[1]));
      });
      K2.clearBox(legend);
      var n = sc.steps.length;
      for (var k = n; k >= 0; k--) {
        var txt = n === 0 ? 'Any activity' : k === n ? '≥ ' + label(sc.steps[n - 1]) : k === 0 ? '< ' + label(sc.steps[0]) : label(sc.steps[k - 1]) + ' – ' + label(sc.steps[k]);
        legend.appendChild(el('div', {}, [el('i', { style: { backgroundColor: sc.colors[k] } }), el('span', {}, txt)]));
      }
      legend.appendChild(el('div', {}, [el('i', { style: { backgroundColor: NO_DATA_FILL } }), el('span', {}, MAP_MODE === 'online' ? 'No data' : 'No activity')]));
    }
    for (var i = 0; i < paths.length; i++) {
      (function (path) {
        var g = data.byId[path.getAttribute('data-id')];
        if (!g) { return; }
        path.addEventListener('mouseover', function () { show(g); }, false);
        path.addEventListener('mouseout', function () { show(null); }, false);
        path.addEventListener('click', function () { onPick(g); }, false);
      })(paths[i]);
    }
    paint();
    show(null);
    return el('div', { className: 'cd-cv-card cd-cv-mapcard' }, [
      el('div', { className: 'cd-cv-cardhead' }, [title, pills]),
      el('div', { className: 'cd-cv-mapbody' }, [box, el('div', { className: 'cd-cv-mapside' }, [legend, info])]),
      el('div', { className: 'cd-cv-hint cd-cv-maphint' }, 'Click a district to open it for this period.')
    ]);
  }

  function topDistricts(data, figFor, period, onPick) {
    var rows = data.regions.map(function (g) { return { g: g, f: figFor(g) }; })
      .filter(function (x) { return x.f.repaid > 0; })
      .sort(function (a, b) { return b.f.repaid - a.f.repaid; });
    var all = false;
    var list = el('div', { className: 'cd-cv-top-list' });
    var more = el('button', { type: 'button', className: 'cd-cv-link' });
    function draw() {
      K2.clearBox(list);
      var max = rows.length ? rows[0].f.repaid : 0;
      if (!rows.length) { list.appendChild(el('div', { className: 'cd-cv-hint' }, 'No collections recorded for ' + period + '.')); }
      (all ? rows : rows.slice(0, 5)).forEach(function (x, i) {
        list.appendChild(el('div', K2.withProps({ className: 'cd-cv-top-row', title: 'Open ' + x.g.name }, K2.onActivate(function () { onPick(x.g); })), [
          el('span', { className: 'cd-cv-top-rank' }, String(i + 1)),
          el('span', { className: 'cd-cv-top-name' }, x.g.name),
          el('span', { className: 'cd-cv-top-bar' }, [el('i', { style: { width: (max > 0 ? Math.max(3, x.f.repaid / max * 100) : 0) + '%', backgroundColor: RANK_COLORS[i % RANK_COLORS.length] } })]),
          el('span', { className: 'cd-cv-top-amt' }, [el('strong', {}, money(x.f.repaid)), el('em', {}, reps(x.f.txns))])
        ]));
      });
      list.className = 'cd-cv-top-list' + (all ? ' cd-cv-scroll' : '');
      more.textContent = all ? 'Show top 5' : 'View all (' + rows.length + ')';
      more.style.display = rows.length > 5 ? '' : 'none';
    }
    more.onclick = function () { all = !all; draw(); };
    draw();
    return el('div', { className: 'cd-cv-card cd-cv-topcard' }, [
      el('div', { className: 'cd-cv-cardhead' }, [el('h3', {}, ['Top districts by collections', el('small', {}, period)]), more]),
      list
    ]);
  }

  function attentionCard(title, list) {
    return el('div', { className: 'cd-cv-card cd-cv-attn' }, [
      el('div', { className: 'cd-cv-cardhead' }, [el('h3', {}, [el('span', { className: 'cd-cv-attn-icon', 'aria-hidden': 'true' }, '!'), title])]),
      list
    ]);
  }

  function dayHead(title, active, onBack, backTitle, tools) {
    return el('div', { className: 'cd-cv-dayhead' }, [
      el('button', { type: 'button', className: 'cd-cv-back', title: backTitle, 'aria-label': backTitle, onClick: onBack }, '←'),
      el('h2', { className: 'cd-cv-daytitle' }, title),
      active === null || active === undefined ? null : el('span', { className: 'cd-cv-badge' + (active ? '' : ' cd-cv-badge--idle') }, active ? '● Active day' : 'No activity'),
      el('div', { className: 'cd-cv-tools' }, tools)
    ]);
  }

  /* one table for district and mandal rows of a day */
  function figTable(firstHeads, items, withLoans) {
    var heads = firstHeads.concat(['Collected', 'Repayments', 'Online', 'Cash']).concat(withLoans ? ['Loans', 'Disbursed'] : []);
    var nFirst = firstHeads.length;
    var thead = el('thead', {}, [el('tr', {}, heads.map(function (h, i) { return el('th', { className: i >= nFirst ? 'n' : '' }, h); }))]);
    var tbody = el('tbody', {}, items.map(function (it) {
      var r = it.r, on = online(r), rep = r.repaid || 0;
      var cells = it.cells.map(function (c) { return el('td', {}, c); }).concat([
        el('td', { className: 'n' }, rep > 0 ? money(rep) : '—'),
        el('td', { className: 'n' }, fmt.number(r.repayTxns || 0)),
        el('td', { className: 'n' }, rep > 0 ? fmt.percent(on / rep) : '—'),
        el('td', { className: 'n' }, rep > 0 ? money(Math.max(0, rep - on)) : '—')
      ]);
      if (withLoans) {
        cells.push(el('td', { className: 'n' }, fmt.number(r.loanCount || 0)));
        cells.push(el('td', { className: 'n' }, (r.disbursed || 0) > 0 ? money(r.disbursed) : '—'));
      }
      return el('tr', K2.withProps({ className: 'cd-cv-click', title: 'Open ' + it.cells[0] }, K2.onActivate(it.go)), cells);
    }));
    return el('div', { className: 'cd-cv-tablewrap' }, [el('table', { className: 'cd-cv-table' }, [thead, tbody])]);
  }

  function districtTable(data, date, router) {
    var box = el('div', {}, [K2.loadingEl('Loading districts...')]);
    dayRows('DISTRICT', date, function (res) {
      K2.clearBox(box);
      if (!res.ok) { box.appendChild(CeoDash.explorer.failBox(res.error, function () {})); return; }
      var byCode = {};
      (res.body.rows || []).forEach(function (r) { byCode[r.id] = r; });
      var list = data.regions.map(function (g) { return { g: g, r: byCode[g.districtId] || {} }; })
        .sort(function (a, b) { return (b.r.repaid || 0) - (a.r.repaid || 0); });
      box.appendChild(figTable(['District'], list.map(function (x) {
        return { cells: [x.g.name], r: x.r, go: function () { router.goToChapter('calendar', [{ level: 'region', id: x.g.id }]); } };
      }), true));
    });
    return box;
  }

  function mandalTable(data, date, router, topBottom) {
    var box = el('div', {}, [K2.loadingEl('Loading mandals...')]);
    var offices = {};
    (data.offices || []).forEach(function (o) { offices[o.districtId + '|' + o.mandalId] = o; });
    function item(x) {
      var reg = data.byId[x.o.regionId];
      return { cells: [x.o.name, reg ? reg.name : ''], r: x.r,
               go: function () { router.goToChapter('calendar', [{ level: 'region', id: x.o.regionId }, { level: 'office', id: x.o.id }]); } };
    }
    dayRows('MANDAL', date, function (res) {
      K2.clearBox(box);
      if (!res.ok) { box.appendChild(CeoDash.explorer.failBox(res.error, function () {})); return; }
      var list = (res.body.rows || []).map(function (r) { return { r: r, o: offices[r.districtId + '|' + r.id] }; })
        .filter(function (x) { return x.o && ((x.r.repaid || 0) > 0 || (x.r.disbursed || 0) > 0); })
        .sort(function (a, b) { return (b.r.repaid || 0) - (a.r.repaid || 0); });
      if (topBottom) {
        var paid = list.filter(function (x) { return x.r.repaid > 0; });
        var low = paid.slice(Math.max(10, paid.length - 10)).reverse();
        box.appendChild(el('div', { className: 'cd-cv-tb' }, [
          el('div', {}, [el('h4', { className: 'cd-cv-h4' }, 'Top 10 mandals by collections'), figTable(['Mandal', 'District'], paid.slice(0, 10).map(item), false)]),
          el('div', {}, [el('h4', { className: 'cd-cv-h4' }, 'Lowest 10 mandals with collections'),
            low.length ? figTable(['Mandal', 'District'], low.map(item), false) : el('div', { className: 'cd-cv-hint' }, 'Fewer than 11 mandals collected on this day.')])
        ]));
        return;
      }
      var q = el('input', { type: 'text', className: 'cd-cv-search', placeholder: 'Search a mandal or district', 'aria-label': 'Search a mandal or district' });
      var holder = el('div', {});
      var limit = 100;
      function draw() {
        var s = String(q.value || '').toLowerCase();
        var shown = list.filter(function (x) {
          if (!s) { return true; }
          var reg = data.byId[x.o.regionId];
          return x.o.name.toLowerCase().indexOf(s) !== -1 || !!(reg && reg.name.toLowerCase().indexOf(s) !== -1);
        });
        K2.clearBox(holder);
        holder.appendChild(el('div', { className: 'cd-cv-count' }, fmt.number(shown.length) + ' mandals with activity' + (shown.length > limit ? ' · first ' + limit + ' shown' : '')));
        holder.appendChild(figTable(['Mandal', 'District'], shown.slice(0, limit).map(item), true));
        if (shown.length > limit) {
          holder.appendChild(el('button', { type: 'button', className: 'cd-cv-link', onClick: function () { limit = shown.length; draw(); } }, 'Show all ' + fmt.number(shown.length)));
        }
      }
      q.onkeyup = draw;
      box.appendChild(q);
      box.appendChild(holder);
      draw();
    });
    return box;
  }

  function calIcon() {
    var s = el('span', { className: 'cd-cv-chip-ic', 'aria-hidden': 'true' });
    s.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
    return s;
  }

  function headerChip(data, entity, state, onDay, onMonth) {
    var slot = document.getElementById('cd-head-slot');
    if (!slot) { return; }
    K2.clearBox(slot);
    slot.appendChild(el('button', { type: 'button', className: 'cd-cv-chip', title: 'Pick a date',
      onClick: function () { openPicker(entity, state.selected, onDay, onMonth); } },
      [calIcon(), el('span', {}, shortDate(state.selected)), el('b', { 'aria-hidden': 'true' }, '▾')]));
  }

  /* the month calendar popup: pick a day, see its figures, open the day or the month */
  function openPicker(entity, start, onDay, onMonth) {
    var ov = K2.overlay('#9a3412', 'cd-cv-pickcard');
    var sel = start, view = new Date(start.getFullYear(), start.getMonth(), 1), token = 0;
    function draw() {
      var y = view.getFullYear(), m = view.getMonth();
      var days = new Date(y, m + 1, 0).getDate(), first = new Date(y, m, 1).getDay();
      var figs = [], max = 0, total = 0;
      for (var d = 1; d <= days; d++) {
        var f = dayFigures(entity, new Date(y, m, d));
        figs.push(f);
        if (f.received > max) { max = f.received; }
        if (f.hasActivity) { total += f.received; }
      }
      ov.setTitle(MONTH_LABELS[m] + ' ' + y, entity.name + ' · ' + money(total) + ' collected in the month · pick a day');
      var r = dayRange(), today = startOfDay(new Date());
      var prevOk = !r.lo || new Date(y, m, 1) > r.lo, nextOk = !r.hi || new Date(y, m + 1, 1) <= r.hi;
      var cells = [];
      WEEKDAY_LABELS.forEach(function (w) { cells.push(el('div', { className: 'cd-cal-hm-wd' }, w)); });
      for (var b = 0; b < first; b++) { cells.push(el('div', { className: 'cd-cal-hm-cell cd-cal-hm-cell--pad' })); }
      figs.forEach(function (f, i) {
        var date = new Date(y, m, i + 1), off = outOfRange(date);
        var t = max > 0 ? Math.sqrt(f.received / max) : 0;
        var bg = off ? '#f8fafc' : !f.hasActivity ? '#eef2f7' : mixHex(HEAT_LO, HEAT_HI, t);
        var dark = !off && f.hasActivity && t > 0.55;
        cells.push(el('button', {
          type: 'button', disabled: off ? 'disabled' : undefined,
          className: 'cd-cal-hm-cell' + (dateKey(date) === dateKey(sel) ? ' cd-cal-hm-cell--sel' : '') + (dark ? ' cd-cal-hm-cell--dark' : '') +
                     (dateKey(date) === dateKey(today) ? ' cd-cv-today' : ''),
          style: { backgroundColor: bg },
          title: longDateLabel(date) + (f.hasActivity ? ': ' + money(f.received) + ' collected' : ': no activity'),
          onClick: function () { sel = date; draw(); }
        }, [el('span', { className: 'cd-cal-hm-n' }, String(i + 1)), f.hasActivity ? el('span', { className: 'cd-cal-hm-v' }, money(f.received)) : null]));
      });
      var sf = dayFigures(entity, sel);
      var onEl = el('strong', {}, sf.received > 0 ? '…' : '—'), cashEl = el('strong', {}, sf.received > 0 ? '…' : '—');
      var body = el('div', { className: 'cd-cv-pick' }, [
        el('div', { className: 'cd-cv-picknav' }, [
          el('button', { type: 'button', className: 'cd-cal-nav-btn cd-cal-nav-btn--light', title: 'Previous month', disabled: prevOk ? undefined : 'disabled',
            onClick: function () { view = new Date(y, m - 1, 1); draw(); } }, '‹'),
          el('button', { type: 'button', className: 'cd-cv-ghost', onClick: function () { sel = clampDay(today); view = new Date(sel.getFullYear(), sel.getMonth(), 1); draw(); } }, 'Today'),
          el('button', { type: 'button', className: 'cd-cal-nav-btn cd-cal-nav-btn--light', title: 'Next month', disabled: nextOk ? undefined : 'disabled',
            onClick: function () { view = new Date(y, m + 1, 1); draw(); } }, '›')
        ]),
        el('div', { className: 'cd-cal-hm-grid' }, cells),
        el('div', { className: 'cd-cal-hm-legend' }, [el('span', {}, 'Less collected'), el('i', {}), el('span', {}, 'More collected'), el('b', {}), el('span', {}, 'No activity')]),
        el('div', { className: 'cd-cv-pickfoot' }, [
          el('div', { className: 'cd-cv-pickday' }, [el('span', {}, fullDate(sel)), el('strong', {}, money(sf.received)), el('span', {}, 'collected')]),
          el('div', {}, [el('span', {}, 'Repayments'), el('strong', {}, fmt.number(sf.txns || 0))]),
          el('div', {}, [el('span', {}, 'Online'), onEl]),
          el('div', {}, [el('span', {}, 'Cash / Manual'), cashEl]),
          el('div', { className: 'cd-cv-pickbtns' }, [
            el('button', { type: 'button', className: 'cd-cv-ghost', onClick: function () { ov.close(); onMonth(sel); } }, 'Month view'),
            el('button', { type: 'button', className: 'cd-cv-go', disabled: outOfRange(sel) ? 'disabled' : undefined, onClick: function () { ov.close(); onDay(sel); } }, 'View this day →')
          ])
        ])
      ]);
      ov.setBody(body);
      var mine = ++token;
      if (sf.received > 0) {
        entityOnline(entity, sel, function (o) {
          if (mine !== token) { return; }
          onEl.textContent = o ? fmt.percent(o.on / o.all) : '—';
          cashEl.textContent = o ? money(Math.max(0, o.all - o.on)) : '—';
        });
      }
    }
    draw();
  }

  function monthView(body, data, state, router, repaint) {
    var y = state.month.getFullYear(), m = state.month.getMonth();
    var r = dayRange(), daysIn = new Date(y, m + 1, 0).getDate(), last = daysIn;
    if (r.hi && r.hi.getFullYear() === y && r.hi.getMonth() === m) { last = r.hi.getDate(); }
    var partial = last < daysIn;
    var pm = new Date(y, m - 1, 1), pDays = new Date(pm.getFullYear(), pm.getMonth() + 1, 0).getDate();
    var cur = monthSums(data.org, y, m, last);
    var prev = monthSums(data.org, pm.getFullYear(), pm.getMonth(), Math.min(last, pDays));
    var prevOk = prev.covered && prev.days > 0;
    var cmpText = 'vs ' + (partial ? '1–' + Math.min(last, pDays) + ' ' : '') + MONTH_SHORT[pm.getMonth()];
    var period = MONTH_LABELS[m] + ' ' + y, periodShort = MONTH_SHORT[m] + ' ' + y;
    var tag = partial ? ' (MTD)' : '';
    var monthFrom = new Date(y, m, 1), monthTo = new Date(y, m, last + 1);
    var canPrev = !r.lo || monthFrom > r.lo, canNext = !r.hi || new Date(y, m + 1, 1) <= r.hi;
    var xl = { kind: 'drill', group: 'DISTRICT', from: isoDay(monthFrom), to: isoDay(monthTo), title: 'Calendar month', label: 'Andhra Pradesh · ' + period };

    function sub(curV, prevV, alt) { return prevOk ? trend(curV, prevV, cmpText) : alt; }
    function onlineCard(o) {
      var ready = !!(o && o.all > 0), share = ready ? o.on / o.all : NaN;
      return kpi('Online collections' + tag, ready ? fmt.percent(share) : '—',
        ready ? 'Cash / Manual ' + fmt.percent(1 - share) : (cur.repaid > 0 ? (o === null ? 'loading…' : 'not available') : 'no collections'), donut(share));
    }
    var onlineSlot = onlineCard(null);
    var kpis = el('div', { className: 'cd-cv-kpis' }, [
      kpi('Collected' + tag, money(cur.repaid), sub(cur.repaid, prev.repaid, fmt.number(cur.days) + ' active days'), kpiIcon('💰', '#dcfce7')),
      kpi('Disbursed' + tag, money(cur.disbursed), sub(cur.disbursed, prev.disbursed, fmt.number(cur.loans) + ' loans'), kpiIcon('🏦', '#fee2e2')),
      kpi('Repayments' + tag, fmt.number(cur.txns), sub(cur.txns, prev.txns, 'payments recorded'), kpiIcon('🧾', '#dbeafe')),
      onlineSlot
    ]);

    body.appendChild(el('div', { className: 'cd-cv-titlebar' }, [
      el('div', {}, [
        el('h2', { className: 'cd-cv-h2' }, period + (partial ? ' · month to date' : '')),
        el('div', { className: 'cd-cv-muted' }, 'Andhra Pradesh' + (cur.covered ? '' : ' · part of this month is outside the daily data') + ' · use the date at the top right to open a single day')
      ]),
      el('div', { className: 'cd-cv-tools' }, [
        el('button', { type: 'button', className: 'cd-cal-nav-btn cd-cal-nav-btn--light', title: 'Previous month', disabled: canPrev ? undefined : 'disabled',
          onClick: function () { state.month = new Date(y, m - 1, 1); repaint(); } }, '‹'),
        el('button', { type: 'button', className: 'cd-cal-nav-btn cd-cal-nav-btn--light', title: 'Next month', disabled: canNext ? undefined : 'disabled',
          onClick: function () { state.month = new Date(y, m + 1, 1); repaint(); } }, '›'),
        CeoDash.explorer.excelButton(function () { CeoDash.explorer.download(xl); }, 'Excel')
      ])
    ]));
    body.appendChild(kpis);

    var mapSlot = el('div', { className: 'cd-cv-mapslot' });
    var topSlot = el('div', {});
    var attnList = el('div', { className: 'cd-cal-attn-list' });
    var sel = state.selected, isToday = dateKey(sel) === dateKey(startOfDay(new Date()));
    function pick(g) { router.goToChapter('calendar', [{ level: 'region', id: g.id }]); }
    function fill(rows) {
      var figFor = districtFigs(rows, function (g) { return monthSums(g, y, m, last); });
      K2.clearBox(mapSlot);
      mapSlot.appendChild(districtMap(data, figFor, periodShort, !!rows, pick));
      K2.clearBox(topSlot);
      topSlot.appendChild(topDistricts(data, figFor, periodShort, pick));
    }
    function fillAttn(rows) {
      K2.clearBox(attnList);
      buildTodaysAttention(data, sel, rows).forEach(function (it) { attnList.appendChild(attentionItemEl(it, router)); });
    }
    fill(null);
    fillAttn(null);
    body.appendChild(el('div', { className: 'cd-cv-row' }, [
      mapSlot,
      el('div', { className: 'cd-cv-side' }, [topSlot, attentionCard(isToday ? 'Today’s Attention' : 'Attention · ' + shortDate(sel), attnList)])
    ]));

    if (cur.repaid > 0) {
      CeoDash.explorer.call({ action: 'drill', group: 'DISTRICT', from: isoDay(monthFrom), to: isoDay(monthTo) }, function (res) {
        if (!alive(kpis)) { return; }
        var ok = res.ok && res.body.payModes !== false;
        var on = 0, all = 0;
        if (ok) { (res.body.rows || []).forEach(function (x) { all += x.repaid || 0; on += online(x); }); fill(res.body.rows || []); }
        var fresh = onlineCard(ok && all > 0 ? { on: on, all: all } : false);
        kpis.replaceChild(fresh, onlineSlot);
        onlineSlot = fresh;
      });
    }
    if (dayFigures(data.org, sel).inWindow) {
      dayRows('DISTRICT', sel, function (res) {
        if (!alive(attnList) || !res.ok || res.body.payModes === false) { return; }
        fillAttn(res.body.rows || []);
      });
    }
  }

  function dayView(body, data, state, router) {
    var date = state.selected, f = dayFigures(data.org, date), cmp = vsUsual(data.org, date, f);
    var isToday = dateKey(date) === dateKey(startOfDay(new Date()));
    var xl = { kind: 'drill', group: 'DISTRICT', from: isoDay(date), to: isoDay(addDays(date, 1)), title: 'Calendar day', label: 'Andhra Pradesh · ' + longDateLabel(date) };
    var kp = el('div', {}, [dayKpis(f, f.received > 0 ? null : false)]);
    var left = el('div', { className: 'cd-cv-dayleft' }, [
      dayHead(fullDate(date), f.hasActivity, function () { router.goToChapter('calendar', []); }, 'Back to the month',
        [CeoDash.explorer.excelButton(function () { CeoDash.explorer.download(xl); }, 'Excel')]),
      el('div', { className: 'cd-cv-daysub' }, 'AP Stree Nidhi · ' + (f.hasActivity
        ? money(f.received) + ' collected in a single day' + (cmp ? ' · ' + cmp : '')
        : (f.inWindow ? 'no loans or repayments recorded on this day' : 'this date is outside the daily data'))),
      kp
    ]);
    var attnList = el('div', { className: 'cd-cal-attn-list' });
    body.appendChild(left);

    var mapSlot = el('div', { className: 'cd-cv-mapslot cd-cv-mapslot--day' });
    var topSlot = el('div', {});
    var tabBar = el('div', { className: 'cd-cv-tabs', role: 'tablist' });
    var tabBody = el('div', { className: 'cd-cv-tabbody' });
    var TABS = [['zones', 'Zones'], ['districts', 'Districts'], ['mandals', 'Mandals'], ['tb', 'Top & Bottom']];
    function showTab() {
      K2.clearBox(tabBar);
      TABS.forEach(function (t) {
        tabBar.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': DAY_TAB === t[0] ? 'true' : 'false',
          className: 'cd-cv-tab' + (DAY_TAB === t[0] ? ' cd-cv-tab--on' : ''), onClick: function () { DAY_TAB = t[0]; showTab(); } }, t[1]));
      });
      K2.clearBox(tabBody);
      if (!f.hasActivity) { tabBody.appendChild(el('div', { className: 'cd-cv-hint' }, 'Nothing was recorded on this day.')); return; }
      if (DAY_TAB === 'zones') { tabBody.appendChild(dayZones(data, date, router)); }
      else if (DAY_TAB === 'districts') { tabBody.appendChild(districtTable(data, date, router)); }
      else { tabBody.appendChild(mandalTable(data, date, router, DAY_TAB === 'tb')); }
    }
    function pick(g) { router.goToChapter('calendar', [{ level: 'region', id: g.id }]); }
    function fill(rows) {
      var figFor = districtFigs(rows, function (g) { var d = dayFigures(g, date); return { repaid: d.received, txns: d.txns, loans: d.loans, disbursed: d.disbursed }; });
      K2.clearBox(mapSlot);
      mapSlot.appendChild(districtMap(data, figFor, shortDate(date), !!rows, pick));
      K2.clearBox(topSlot);
      topSlot.appendChild(topDistricts(data, figFor, shortDate(date), pick));
      K2.clearBox(attnList);
      buildTodaysAttention(data, date, rows).filter(function (it) { return it.role !== 'loan'; }).slice(0, 3)
        .forEach(function (it) { attnList.appendChild(attentionItemEl(it, router)); });
    }
    fill(null);
    showTab();
    body.appendChild(el('div', { className: 'cd-cv-row' }, [mapSlot, el('div', { className: 'cd-cv-side' }, [topSlot,
      attentionCard(isToday ? 'Today’s Attention' : 'Attention · ' + shortDate(date), attnList)])]));
    body.appendChild(el('div', { className: 'cd-cv-row' }, [el('div', { className: 'cd-cv-card cd-cv-tabcard' }, [tabBar, tabBody])]));
    if (f.inWindow && f.received > 0) {
      dayRows('DISTRICT', date, function (res) {
        if (!alive(kp)) { return; }
        var ok = res.ok && res.body.payModes !== false;
        var on = 0, all = 0;
        if (ok) { (res.body.rows || []).forEach(function (x) { all += x.repaid || 0; on += online(x); }); fill(res.body.rows || []); }
        K2.clearBox(kp);
        kp.appendChild(dayKpis(f, ok && all > 0 ? { on: on, all: all } : false));
      });
    }
  }

  /* district, mandal, VO and SHG pages for the chosen day: the level below, ranked */
  var CHILD_OF = {
    district: { group: 'MANDAL', one: 'mandal', many: 'Mandals' },
    mandal: { group: 'VO', one: 'VO', many: 'Village organisations' },
    vo: { group: 'SHG', one: 'SHG', many: 'Self-help groups' },
    shg: { group: 'MEMBER', one: 'woman', many: 'Women' }
  };
  var SCOPE_SORT = 'repaid', SCOPE_VIEW = 'rank';

  function scopeView(body, data, state, router, path) {
    var ex = CeoDash.explorer, sc = ex.scopeOf(data, path), ch = CHILD_OF[sc.level];
    var date = state.selected, iso = isoDay(date), next = isoDay(addDays(date, 1));
    if (!ch) {
      body.appendChild(el('div', { className: 'cd-cv-card' }, [ex.dayPanel(data, path, iso)]));
      return;
    }
    var back = path.length > 1 ? path.slice(0, -1) : [{ level: 'day', id: iso }];
    var upName = path.length > 1 ? (sc.crumbs.length > 1 ? sc.crumbs[sc.crumbs.length - 2].name : 'the previous level') : 'the whole state';
    var ids = { districtId: sc.districtId, mandalId: sc.mandalId, voId: sc.voId, shgId: sc.shgId };
    var xl = { kind: 'drill', group: ch.group, from: iso, to: next, title: 'Calendar day', label: sc.name + ' · ' + longDateLabel(date) };
    for (var k in ids) { if (ids.hasOwnProperty(k) && ids[k]) { xl[k] = ids[k]; } }

    var head = dayHead(fullDate(date), undefined, function () { router.goToChapter('calendar', back); }, 'Back to ' + upName + ' for this day',
      [CeoDash.explorer.excelButton(function () { CeoDash.explorer.download(xl); }, 'Excel')]);
    body.appendChild(head);

    var crumbs = el('div', { className: 'cd-cv-crumbs' }, [
      el('button', { type: 'button', className: 'cd-cv-crumb', onClick: function () { router.goToChapter('calendar', [{ level: 'day', id: iso }]); } }, 'Andhra Pradesh')
    ]);
    sc.crumbs.forEach(function (c, i) {
      crumbs.appendChild(el('span', { className: 'cd-cv-crumb-sep', 'aria-hidden': 'true' }, '›'));
      crumbs.appendChild(i === sc.crumbs.length - 1
        ? el('strong', { className: 'cd-cv-crumb cd-cv-crumb--here' }, c.name)
        : el('button', { type: 'button', className: 'cd-cv-crumb', onClick: function () { router.goToChapter('calendar', path.slice(0, c.depth)); } }, c.name));
    });
    body.appendChild(crumbs);

    var kp = el('div', { className: 'cd-cv-kpis-wait' }, [K2.loadingEl('Loading the day for ' + sc.name + '...')]);
    body.appendChild(kp);

    var listCard = el('div', { className: 'cd-cv-card cd-cv-scopelist' }, [K2.loadingEl('Loading ' + ch.many.toLowerCase() + ' for ' + shortDate(date) + '...')]);
    var hiList = el('div', { className: 'cd-cal-attn-list' }, [K2.loadingEl('Loading...')]);
    var side = el('div', { className: 'cd-cv-side' }, [personCard(data, sc, router), attentionCard('Highlights · ' + shortDate(date), hiList)].filter(Boolean));
    body.appendChild(el('div', { className: 'cd-cv-row' }, [listCard, side]));

    var p = { action: 'drill', group: ch.group, from: iso, to: next };
    for (var k2 in ids) { if (ids.hasOwnProperty(k2) && ids[k2]) { p[k2] = ids[k2]; } }
    CeoDash.explorer.call(p, function (res) {
      if (!alive(listCard)) { return; }
      K2.clearBox(listCard);
      if (!res.ok) { listCard.appendChild(CeoDash.explorer.failBox(res.error, function () { router.goToChapter('calendar', path); })); return; }
      var rows = (res.body.rows || []).map(function (r) {
        var step = childStep(sc, r), nm = r.name || r.id;
        if (sc.level === 'district' && step && data.byId[step.id]) { nm = data.byId[step.id].name; }
        if (sc.level === 'mandal' || sc.level === 'vo') { CeoDash.explorer.NAMES[r.id] = nm; }
        var on = online(r), rep = r.repaid || 0;
        return { r: r, name: K2.titleCase(nm), step: step, repaid: rep, txns: r.repayTxns || 0, loans: r.loanCount || 0,
                 disbursed: r.disbursed || 0, online: on, cash: Math.max(0, rep - on), share: rep > 0 ? on / rep : NaN };
      });
      var t = { received: 0, txns: 0, disbursed: 0, loans: 0, on: 0 };
      rows.forEach(function (x) { t.received += x.repaid; t.txns += x.txns; t.disbursed += x.disbursed; t.loans += x.loans; t.on += x.online; });
      var payOn = res.body.payModes !== false;
      K2.clearBox(kp);
      kp.appendChild(dayKpis(t, payOn && t.received > 0 ? { on: t.on, all: t.received } : false));
      var active = t.received > 0 || t.disbursed > 0;
      head.insertBefore(el('span', { className: 'cd-cv-badge' + (active ? '' : ' cd-cv-badge--idle') }, active ? '● Active day' : 'No activity'), head.lastChild);
      fillHighlights(hiList, rows, ch, router, path);
      listCard.appendChild(scopeList(rows, ch, sc, date, router, path, payOn));
    });
  }

  function childStep(sc, r) {
    if (sc.level === 'district') { return sc.region ? { level: 'office', id: sc.region.id + '-m' + r.id } : null; }
    if (sc.level === 'mandal') { return { level: 'vo', id: r.id }; }
    if (sc.level === 'vo') { return { level: 'shg', id: r.id }; }
    return null;
  }

  function scopeList(rows, ch, sc, date, router, path, payOn) {
    var box = el('div', {});
    var pills = el('div', { className: 'cd-cv-pills' });
    var views = el('div', { className: 'cd-cv-pills' });
    var holder = el('div', {});
    function open(x) { if (x.step) { router.goToChapter('calendar', path.concat([x.step])); } }
    function draw() {
      K2.clearBox(pills);
      [['repaid', 'Collected'], ['txns', 'Repayments'], ['disbursed', 'Loans given']].concat(payOn ? [['cash', 'Cash']] : []).forEach(function (o) {
        pills.appendChild(el('button', { type: 'button', className: 'cd-cv-pill' + (SCOPE_SORT === o[0] ? ' cd-cv-pill--on' : ''),
          onClick: function () { SCOPE_SORT = o[0]; draw(); } }, o[1]));
      });
      K2.clearBox(views);
      [['rank', 'Ranking'], ['table', 'Table']].forEach(function (o) {
        views.appendChild(el('button', { type: 'button', className: 'cd-cv-pill' + (SCOPE_VIEW === o[0] ? ' cd-cv-pill--on' : ''),
          onClick: function () { SCOPE_VIEW = o[0]; draw(); } }, o[1]));
      });
      var key = SCOPE_SORT;
      var list = rows.slice().sort(function (a, b) { return (b[key] || 0) - (a[key] || 0) || (a.name < b.name ? -1 : 1); });
      var shown = list.filter(function (x) { return x.repaid > 0 || x.disbursed > 0; });
      var idle = list.length - shown.length;
      K2.clearBox(holder);
      if (!shown.length) { holder.appendChild(el('div', { className: 'cd-cv-hint' }, 'No collections or loans in any ' + ch.one + ' on this day.')); return; }
      if (SCOPE_VIEW === 'table') {
        holder.appendChild(figTable([ch.one.charAt(0).toUpperCase() + ch.one.slice(1)], shown.map(function (x) {
          return { cells: [x.name], r: x.r, go: function () { open(x); } };
        }), true));
      } else {
        var max = shown[0][key] || 0;
        var lst = el('div', { className: 'cd-cv-top-list cd-cv-scroll cd-cv-scroll--tall' });
        shown.forEach(function (x, i) {
          var v = x[key] || 0;
          var main = key === 'txns' ? reps(v) : money(v);
          var sub = key === 'repaid' ? reps(x.txns) + (payOn && x.repaid > 0 ? ' · ' + fmt.percent(x.share) + ' online' : '')
                  : key === 'disbursed' ? fmt.number(x.loans) + (x.loans === 1 ? ' loan' : ' loans')
                  : key === 'cash' ? (x.repaid > 0 ? fmt.percent(1 - x.share) + ' of ' + money(x.repaid) : '')
                  : money(x.repaid) + ' collected';
          lst.appendChild(el('div', K2.withProps({ className: 'cd-cv-top-row' + (x.step ? '' : ' cd-cv-top-row--plain'), title: x.step ? 'Open ' + x.name : x.name },
            x.step ? K2.onActivate(function () { open(x); }) : {}), [
            el('span', { className: 'cd-cv-top-rank' }, String(i + 1)),
            el('span', { className: 'cd-cv-top-name' }, x.name),
            el('span', { className: 'cd-cv-top-bar' }, [el('i', { style: { width: (max > 0 ? Math.max(3, v / max * 100) : 0) + '%', backgroundColor: key === 'cash' ? '#b45309' : RANK_COLORS[i % RANK_COLORS.length] } })]),
            el('span', { className: 'cd-cv-top-amt' }, [el('strong', {}, main), el('em', {}, sub)])
          ]));
        });
        holder.appendChild(lst);
      }
      if (idle > 0) { holder.appendChild(el('div', { className: 'cd-cv-count cd-cv-count--foot' }, idle + ' ' + (idle === 1 ? ch.one : ch.many.toLowerCase()) + ' with no collections or loans on this day.')); }
    }
    draw();
    box.appendChild(el('div', { className: 'cd-cv-cardhead' }, [
      el('h3', {}, [ch.many + ' of ' + sc.name, el('small', {}, shortDate(date) + (ch.group !== 'MEMBER' ? ' · click one to open it' : ''))]),
      el('div', { className: 'cd-cv-tools' }, [views])
    ]));
    box.appendChild(el('div', { className: 'cd-cv-sortbar' }, [el('span', { className: 'cd-cv-muted' }, 'Rank by'), pills]));
    box.appendChild(holder);
    return box;
  }

  function fillHighlights(list, rows, ch, router, path) {
    K2.clearBox(list);
    var paid = rows.filter(function (x) { return x.repaid > 0; });
    var items = [];
    function item(role, title, detail, x) {
      items.push(el('div', K2.withProps({ className: 'cd-cal-attn-item' }, x && x.step ? K2.onActivate(function () { router.goToChapter('calendar', path.concat([x.step])); }) : {}), [
        el('span', { className: 'cd-cal-attn-item__dot', 'data-cd-role': role === 'neutral' ? undefined : ('bg-' + role), style: role === 'neutral' ? { background: '#64748b' } : null }),
        el('div', {}, [el('div', { className: 'cd-cal-attn-item__title' }, title), el('div', { className: 'cd-cal-attn-item__detail cd-text-muted' }, detail)])
      ]));
    }
    if (paid.length) {
      var top = paid.slice().sort(function (a, b) { return b.repaid - a.repaid; })[0];
      item('repay', 'Highest collections — ' + top.name, money(top.repaid) + ' from ' + reps(top.txns), top);
      var cashy = paid.slice().sort(function (a, b) { return b.cash - a.cash; })[0];
      if (cashy.cash > 0) { item('risk', 'Most cash — ' + cashy.name, money(cashy.cash) + ' manual · ' + fmt.percent(1 - cashy.share) + ' of its collections', cashy); }
    }
    var lent = rows.filter(function (x) { return x.disbursed > 0; }).sort(function (a, b) { return b.disbursed - a.disbursed; });
    if (lent.length) { item('loan', 'Most loans given — ' + lent[0].name, money(lent[0].disbursed) + ' to ' + fmt.number(lent[0].loans) + (lent[0].loans === 1 ? ' loan' : ' loans'), lent[0]); }
    var idle = rows.length - rows.filter(function (x) { return x.repaid > 0 || x.disbursed > 0; }).length;
    if (idle > 0 && ch.group !== 'MEMBER') { item('neutral', idle + ' ' + (idle === 1 ? ch.one : ch.many.toLowerCase()) + ' with no activity', 'No collections or loans recorded on this day.', null); }
    if (!items.length) { item('neutral', 'Nothing recorded', 'No collections or loans on this day.', null); }
    items.forEach(function (n) { list.appendChild(n); });
  }

  function personCard(data, sc, router) {
    var mgr = sc.office ? CeoDash.data.findResponsibleManager(sc.office.id, data) : null;
    var agm = !mgr && sc.region ? CeoDash.data.findResponsibleAgm(sc.region.id, data) : null;
    if (!mgr && !agm) { return null; }
    var name = mgr ? mgr.manager : agm.agm, role = mgr ? 'Manager' : 'AGM', zone = mgr ? mgr.zoneName : agm.zoneName;
    var color = CAL_ZONE_COLORS[zone] || '#0284C7';
    var initials = String(name).split(' ').filter(function (w) { return w && w !== 'Sri' && w !== 'Smt.'; }).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    var districtSlug = sc.region ? sc.region.id : null;
    return el('div', { className: 'cd-cv-card cd-cv-person', style: { borderTopColor: color } }, [
      el('div', { className: 'cd-cv-person-top' }, [
        el('div', { className: 'cd-cal-emp-avatar', style: { background: color } }, initials),
        el('div', {}, [el('div', { className: 'cd-cal-emp-name' }, name), el('div', { className: 'cd-cv-muted' }, role + (zone ? ' · ' + zone : '') + ' · responsible for ' + sc.name)])
      ]),
      el('div', { className: 'cd-cv-links' }, [
        el('button', { type: 'button', className: 'cd-ov-district-link',
          onClick: function () { router.goToChapter('performance-map', mgr ? mgr.path : CeoDash.employees.pathForDistrict(data, districtSlug)); } }, 'Employee performance →'),
        districtSlug ? el('button', { type: 'button', className: 'cd-ov-district-link',
          onClick: function () { CeoDash.core.context.set({ districtId: districtSlug }); router.goToChapter('repayment-journey', sc.office ? [{ level: 'region', id: districtSlug }, { level: 'office', id: sc.office.id }] : [{ level: 'region', id: districtSlug }]); } }, 'Repayments →') : null,
        districtSlug ? el('button', { type: 'button', className: 'cd-ov-district-link',
          onClick: function () { CeoDash.core.context.set({ districtId: districtSlug }); router.goToChapter('loan-journey', sc.office ? [{ level: 'region', id: districtSlug }, { level: 'office', id: sc.office.id }] : [{ level: 'region', id: districtSlug }]); } }, 'Loans given →') : null
      ])
    ]);
  }

  function render(container, appState, data) {
    var router = CeoDash.core.router;
    var path = appState.drillPath || [];
    var dayStep = null;
    if (path.length && path[0].level === 'day') {
      dayStep = parseKey(path[0].id);
      if (dayStep) { CeoDash.core.context.set({ calendarDate: dateKey(clampDay(startOfDay(dayStep))) }); }
      if (path.length > 1 || !dayStep) {
        /* a district picked inside the day view: the date is kept, the address becomes the district's */
        var rest = path.slice(1);
        container.appendChild(K2.loadingEl('Opening...'));
        global.setTimeout(function () { router.replaceRoute('calendar', rest); }, 0);
        return;
      }
    }
    var scopePath = dayStep ? [] : path;
    var saved = parseKey(CeoDash.core.context.get().calendarDate);
    var sel = clampDay(saved || startOfDay(new Date()));
    var state = { selected: sel, month: new Date(sel.getFullYear(), sel.getMonth(), 1) };
    var resolved = data.real ? realCalScope(data, scopePath) : CeoDash.core.hierarchy.resolve(data, scopePath);
    var scope = resolved.parent;
    var entity = scope.realDaily ? scope : data.org;
    var body = el('div', { className: 'cd-cv' });

    function onDay(d) {
      CeoDash.core.context.set({ calendarDate: dateKey(d) });
      router.goToChapter('calendar', scope.level === 'org' ? [{ level: 'day', id: isoDay(d) }] : scopePath);
    }
    function onMonth(d) {
      CeoDash.core.context.set({ calendarDate: dateKey(d) });
      router.goToChapter('calendar', []);
    }
    function repaint() {
      K2.clearBox(body);
      headerChip(data, entity, state, onDay, onMonth);
      if (scope.level === 'org' && !dayStep) { monthView(body, data, state, router, repaint); }
      else if (scope.level === 'org') { dayView(body, data, state, router); }
      else { scopeView(body, data, state, router, scopePath); }
    }
    container.appendChild(el('section', { className: 'cd-chapter cd-chapter--calendar' }, [body]));
    repaint();
  }

  CeoDash.chapters['calendar'] = render;
})(window);

