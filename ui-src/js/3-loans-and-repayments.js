/* ---------- Chapter: Loans Given ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  var ex = CeoDash.explorer;
  var el = CeoDash.core.dom.el;
  var fmt = CeoDash.core.format;
  var NAMES = ex.NAMES;
  var ONE_CRORE = 10000000;

  var CHILD = {
    state:    { group: 'DISTRICT', level: 'region', one: 'District', many: 'Districts' },
    district: { group: 'MANDAL',   level: 'office', one: 'Mandal',   many: 'Mandals' },
    mandal:   { group: 'VO',       level: 'vo',     one: 'VO',       many: 'VOs' },
    vo:       { group: 'SHG',      level: 'shg',    one: 'SHG',      many: 'SHGs' },
    shg:      { group: 'MEMBER',   level: 'member', one: 'Woman',    many: 'Women' }
  };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var GREEN = '#15803d', AMBER = '#a16207';
  var PROJECT_THEMES = [
    { color: '#15803d', bg: '#dcfce7' }, { color: '#0d9488', bg: '#ccfbf1' }, { color: '#0284c7', bg: '#e0f2fe' },
    { color: '#2563eb', bg: '#dbeafe' }, { color: '#c026d3', bg: '#fae8ff' }
  ];
  var ACTIVITY_COLORS = ['#0d9488', '#1e3a8a', '#b45309', '#0284c7', '#e11d48'];
  var SOCIAL = [
    { id: 'OC', badge: 'OC', name: 'OC', color: '#ea580c' },
    { id: 'BC', badge: 'BC', name: 'BC', color: '#15803d' },
    { id: 'SC', badge: 'SC', name: 'SC', color: '#a16207' },
    { id: 'ST', badge: 'ST', name: 'ST', color: '#c026d3' },
    { id: 'MINORITY', badge: 'MIN', name: 'Minority', color: '#0e7490' }
  ];
  var ICONS = {
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    disbursed: '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    borrowers: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    active: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    closed: '<circle cx="12" cy="12" r="10"/><polyline points="8 12.5 11 15.5 16 9"/>'
  };

  function has(v) { return v !== null && v !== undefined; }
  function clearBox(box) { while (box.firstChild) { box.removeChild(box.firstChild); } }
  function titleCase(s) {
    s = String(s === null || s === undefined ? '' : s).replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ').toLowerCase();
    return s.replace(/(^|[ \/(\-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }
  function catLabel(c) { var u = String(c || '').replace(/^\s+|\s+$/g, '').toUpperCase(); return u === 'OC' || u === 'BC' || u === 'SC' || u === 'ST' ? u : titleCase(c); }
  function dateLabel(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : '—';
  }
  function svgIcon(name) {
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>';
  }
  function note(text, warn) { return el('div', { className: 'cd-ex-note' + (warn ? ' cd-ex-note--warn' : '') }, text); }
  function loadingEl(text) {
    return el('div', { className: 'cd-ex-loading', role: 'status' }, [el('span', { className: 'cd-ex-spinner', 'aria-hidden': 'true' }), text || 'Loading...']);
  }
  function onActivate(fn) {
    return { role: 'button', tabIndex: '0', onClick: fn,
             onKeydown: function (evt) { if (evt.keyCode === 13 || evt.keyCode === 32) { fn(); } } };
  }
  function withProps(base, extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) { base[k] = extra[k]; } } return base; }

  function load(list, build, text) {
    var box = el('div', { className: 'cd-ex-slot' });
    function run() {
      var results = [], left = list.length, shown = false;
      function finish() {
        clearBox(box);
        var c, failed = null;
        for (var f = 0; f < results.length; f++) { if (results[f] && !results[f].ok) { failed = results[f]; break; } }
        if (failed) { c = ex.failBox(failed.error, run); }
        else {
          try { c = build(results); } catch (e) {
            c = note('Could not show this section.', true);
            if (global.console) { global.console.error(e); }
          }
        }
        if (c) { box.appendChild(c); }
      }
      list.forEach(function (p, i) {
        ex.call(p, function (res) { results[i] = res; left--; if (left === 0) { shown = true; finish(); } });
      });
      if (!shown) { clearBox(box); box.appendChild(loadingEl(text)); }
    }
    run();
    return box;
  }

  /* starts `list` only after `first` (a call the page makes anyway) has answered,
     so SNBSAP runs one large query at a time; skipped if the page was left meanwhile */
  function loadAfter(first, list, build, text) {
    var box = el('div', { className: 'cd-ex-slot' }, [loadingEl(text)]);
    ex.call(first, function () {
      if (box.parentNode && !document.body.contains(box)) { return; }
      clearBox(box);
      box.appendChild(load(list, build, text));
    });
    return box;
  }

  function rowsOf(res) { return res && res.ok ? (res.body.rows || []) : null; }

  function fyRange(sy) { return { from: sy + '-04-01', to: (sy + 1) + '-04-01' }; }

  /* full year, one quarter (1-4) or one month (yyyy-MM) of FY sy */
  function periodOf(data, sy) {
    var ctx = ex.getCtx(data);
    if (ctx.fy !== sy) { return { type: 'fy' }; }
    if (ctx.type === 'q' && +ctx.value >= 1 && +ctx.value <= 4) { return { type: 'q', value: +ctx.value }; }
    if (ctx.type === 'm' && /^\d{4}-\d{2}$/.test(String(ctx.value))) {
      var y = +String(ctx.value).substr(0, 4), mo = +String(ctx.value).substr(5, 2);
      if ((mo >= 4 ? y : y - 1) === sy) { return { type: 'm', value: String(ctx.value) }; }
    }
    return { type: 'fy' };
  }
  function periodRange(sy, per) {
    if (per.type === 'q') { var s0 = ex.addMonths(sy + '-04', (per.value - 1) * 3); return { from: s0 + '-01', to: ex.addMonths(s0, 3) + '-01' }; }
    if (per.type === 'm') { return { from: per.value + '-01', to: ex.addMonths(per.value, 1) + '-01' }; }
    return fyRange(sy);
  }
  function quarterMonths(q) { var a = (q - 1) * 3 + 3; return MONTHS[a % 12] + '\u2013' + MONTHS[(a + 2) % 12]; }
  function periodLabel(sy, per) {
    if (per.type === 'q') { return 'Q' + per.value + ' FY ' + ex.fyLabel(sy) + ' (' + quarterMonths(per.value) + ')'; }
    if (per.type === 'm') { return MONTHS[+per.value.substr(5, 2) - 1] + ' ' + per.value.substr(0, 4); }
    return 'FY ' + ex.fyLabel(sy);
  }
  /* share of the FY target that belongs to the period */
  function periodShare(per) { return per.type === 'q' ? 0.25 : per.type === 'm' ? 1 / 12 : 1; }

  function params(scope, rng, group, project) {
    return { action: 'drill', group: group, from: rng.from, to: rng.to, districtId: scope.districtId, mandalId: scope.mandalId,
             voId: scope.voId, shgId: scope.shgId, project: project || null };
  }

  function navIdOf(data, scope, group, r) {
    if (group === 'DISTRICT') {
      for (var i = 0; i < data.regions.length; i++) { if (data.regions[i].districtId === r.id) { return data.regions[i].id; } }
      return null;
    }
    if (group === 'MANDAL') { return scope.region ? scope.region.id + '-m' + r.id : null; }
    return r.id;
  }

  function remember(group, rows) {
    if (group === 'VO' || group === 'SHG' || group === 'MEMBER') { rows.forEach(function (r) { NAMES[r.id] = r.name; }); }
  }

  function sum(rows) {
    var t = { loans: 0, disbursed: 0, open: 0, closed: 0, openAmount: 0, borrowers: 0, target: 0,
              hasBorrowers: rows.length > 0, hasOpenAmount: rows.length > 0, hasTarget: false };
    rows.forEach(function (r) {
      t.loans += r.loanCount || 0; t.disbursed += r.disbursed || 0; t.open += r.openLoans || 0; t.closed += r.closedLoans || 0;
      if (has(r.openAmount)) { t.openAmount += r.openAmount; } else { t.hasOpenAmount = false; }
      if (has(r.borrowers)) { t.borrowers += r.borrowers; } else { t.hasBorrowers = false; }
      if (has(r.targetCr)) { t.target += r.targetCr * ONE_CRORE; t.hasTarget = true; }
    });
    t.closedAmount = t.hasOpenAmount ? Math.max(0, t.disbursed - t.openAmount) : NaN;
    return t;
  }

  function overlay(color, cardClass) {
    var back = el('div', { className: 'cd-lg-ov', role: 'dialog', 'aria-modal': 'true' });
    var titleEl = el('div', { className: 'cd-lg-title' });
    var subEl = el('div', { className: 'cd-lg-sub' });
    var closeBtn = el('button', { type: 'button', className: 'cd-lg-close', 'aria-label': 'Close' }, '✕');
    var head = el('div', { className: 'cd-lg-head', style: { backgroundColor: color || '#9d482b' } }, [el('div', {}, [titleEl, subEl]), closeBtn]);
    var body = el('div', { className: 'cd-lg-body' });
    var card = el('div', { className: 'cd-lg-card' + (cardClass ? ' ' + cardClass : '') }, [head, body]);
    back.appendChild(card);
    function onKey(e) { if (e.keyCode === 27) { close(); } }
    function close() {
      if (unreg) { unreg(); }
      global.document.removeEventListener('keydown', onKey, false);
      if (back.parentNode) { back.parentNode.removeChild(back); }
    }
    var unreg = CeoDash.core.overlays.add(close);
    back.addEventListener('click', function (e) { if (e.target === back) { close(); } }, false);
    closeBtn.addEventListener('click', close, false);
    global.document.addEventListener('keydown', onKey, false);
    global.document.body.appendChild(back);
    return {
      close: close,
      setTitle: function (t, s) { titleEl.textContent = t || ''; subEl.textContent = s || ''; },
      setBody: function (node) { clearBox(body); if (node) { body.appendChild(node); } }
    };
  }

  function Page(data, scope, appState, sy, chapter, title) {
    this.data = data; this.scope = scope; this.path = appState.drillPath || []; this.sy = sy;
    this.chapter = chapter || 'loan-journey'; this.title = title || 'Loans Given';
    this.period = periodOf(data, sy);
    this.partial = this.period.type !== 'fy';
    this.rng = periodRange(sy, this.period);
    this.fyName = ex.fyLabel(sy);
    this.periodName = periodLabel(sy, this.period);
  }

  Page.prototype.where = function () { return this.scope.level === 'state' ? 'Andhra Pradesh' : this.scope.name; };

  Page.prototype.go = function (path) { CeoDash.core.router.goToChapter(this.chapter, path); };

  Page.prototype.header = function () {
    var self = this, ctx = ex.getCtx(this.data);
    var names = ['Andhra Pradesh'];
    this.scope.crumbs.forEach(function (c) { names.push(c.name); });
    var fySel = el('select', { className: 'cd-loan-filter-select', 'aria-label': 'Financial year',
      onChange: function (e) { ex.setCtx({ exFy: +e.target.value, exPeriod: 'fy', exValue: null }); } },
      ctx.fys.map(function (sy) { return el('option', { value: String(sy), selected: sy === self.sy ? 'selected' : undefined }, 'FY ' + ex.fyLabel(sy)); }));
    fySel.value = String(this.sy);
    return el('div', { className: 'cd-loan-header-bar' }, [
      el('div', { className: 'cd-loan-header-info' }, [
        el('h1', { className: 'cd-loan-page-title' }, this.title),
        el('p', { className: 'cd-loan-page-desc' }, (this.chapter === 'repayment-journey' ? '' : names.join(' › ') + ' - ') + this.periodName)
      ]),
      el('div', { className: 'cd-lg-period-pick' }, [
        el('div', { className: 'cd-loan-filter-field cd-lg-fy' }, [el('label', { className: 'cd-loan-filter-label' }, 'Financial year'), fySel]),
        el('div', { className: 'cd-loan-filter-field cd-lg-fy' }, [el('label', { className: 'cd-loan-filter-label' }, 'Period'), this.periodSelect()]),
        el('div', { className: 'cd-loan-filter-field cd-lg-fy cd-xls-field' }, [el('label', { className: 'cd-loan-filter-label' }, '\u00a0'),
          ex.excelButton(function () { self.excel(); })])
      ])
    ]);
  };

  Page.prototype.excel = function () {
    var ch = CHILD[this.scope.level];
    var p = params(this.scope, this.rng, ch.group);
    p.kind = 'drill';
    p.title = this.title;
    p.label = this.where() + ' \u00b7 ' + ch.many + ' \u00b7 ' + this.periodName;
    ex.download(p);
  };

  Page.prototype.periodSelect = function () {
    var self = this, sy = this.sy, have = {};
    (this.data.periods || []).forEach(function (m) { have[m] = true; });
    var opts = [el('option', { value: 'fy' }, 'Full year')];
    for (var q = 1; q <= 4; q++) {
      var first = ex.addMonths(sy + '-04', (q - 1) * 3);
      if (have[first]) { opts.push(el('option', { value: 'q' + q }, 'Q' + q + ' \u00b7 ' + quarterMonths(q))); }
    }
    for (var i = 0; i < 12; i++) {
      var ym = ex.addMonths(sy + '-04', i);
      if (have[ym]) { opts.push(el('option', { value: 'm' + ym }, MONTHS[+ym.substr(5, 2) - 1] + ' ' + ym.substr(0, 4))); }
    }
    var sel = el('select', { className: 'cd-loan-filter-select', 'aria-label': 'Period', onChange: function (e) {
      var v = e.target.value;
      if (v.charAt(0) === 'q') { ex.setCtx({ exFy: sy, exPeriod: 'q', exValue: +v.substr(1) }); }
      else if (v.charAt(0) === 'm' && v.length > 1) { ex.setCtx({ exFy: sy, exPeriod: 'm', exValue: v.substr(1) }); }
      else { ex.setCtx({ exFy: sy, exPeriod: 'fy', exValue: null }); }
    } }, opts);
    sel.value = this.period.type === 'q' ? 'q' + this.period.value : this.period.type === 'm' ? 'm' + this.period.value : 'fy';
    return sel;
  };

  Page.prototype.filters = function () {
    var self = this, scope = this.scope, data = this.data;
    function mk(d, m, v, s) {
      var p = [];
      if (d) { p.push({ level: 'region', id: d }); }
      if (d && m) { p.push({ level: 'office', id: m }); }
      if (d && m && v) { p.push({ level: 'vo', id: v }); }
      if (d && m && v && s) { p.push({ level: 'shg', id: s }); }
      return p;
    }
    var cur = { d: scope.region ? scope.region.id : '', m: scope.office ? scope.office.id : '', v: scope.voId || '', s: scope.shgId || '' };

    function field(label, value, opts, disabled, onChange) {
      var select = el('select', { className: 'cd-loan-filter-select', disabled: disabled ? 'disabled' : undefined,
                                  onChange: function (e) { onChange(e.target.value); } });
      function fill(list) {
        clearBox(select);
        select.appendChild(el('option', { value: '' }, 'All ' + label + 's'));
        list.forEach(function (o) { select.appendChild(el('option', { value: o.id }, o.name)); });
        select.value = value || '';
      }
      fill(opts);
      return { box: el('div', { className: 'cd-loan-filter-field' }, [el('label', { className: 'cd-loan-filter-label' }, label), select]), fill: fill, select: select };
    }

    var districts = data.regions.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; })
                      .map(function (r) { return { id: r.id, name: r.name }; });
    var mandals = scope.region ? (scope.region.officeIds || []).map(function (id) { return data.byId[id]; })
                      .filter(Boolean).sort(function (a, b) { return a.name < b.name ? -1 : 1; })
                      .map(function (o) { return { id: o.id, name: o.name }; }) : [];
    var fD = field('District', cur.d, districts, false, function (v) { self.go(mk(v, '', '', '')); });
    var fM = field('Mandal', cur.m, mandals, !cur.d, function (v) { self.go(mk(cur.d, v, '', '')); });
    var fV = field('VO', cur.v, cur.v ? [{ id: cur.v, name: NAMES[cur.v] || cur.v }] : [], !cur.m, function (v) { self.go(mk(cur.d, cur.m, v, '')); });
    var fS = field('SHG', cur.s, cur.s ? [{ id: cur.s, name: NAMES[cur.s] || cur.s }] : [], !cur.v, function (v) { self.go(mk(cur.d, cur.m, cur.v, v)); });

    var chipText = {};
    function lazy(f, group, p) {
      ex.call(p, function (res) {
        var rows = rowsOf(res); if (!rows) { return; }
        remember(group, rows);
        for (var id in chipText) { if (chipText.hasOwnProperty(id) && NAMES[id]) { chipText[id].nodeValue = NAMES[id]; } }
        f.fill(rows.slice().sort(function (a, b) { return String(a.name) < String(b.name) ? -1 : 1; })
                   .map(function (r) { return { id: r.id, name: r.name }; }));
      });
    }
    if (cur.m) { lazy(fV, 'VO', params({ districtId: scope.districtId, mandalId: scope.mandalId }, this.rng, 'VO')); }
    if (cur.v) { lazy(fS, 'SHG', params({ districtId: scope.districtId, mandalId: scope.mandalId, voId: scope.voId }, this.rng, 'SHG')); }

    var chips = scope.crumbs.map(function (c) {
      var t = global.document.createTextNode(c.name);
      if (c.level === 'vo' || c.level === 'shg') { chipText[c.id] = t; }
      return el('button', { type: 'button', className: 'cd-lg-chip', title: 'Remove this filter',
                            onClick: function () { CeoDash.core.router.drillToDepth(c.depth - 1); } }, [t, el('span', { className: 'cd-lg-chip-x', 'aria-hidden': 'true' }, '✕')]);
    });
    return el('div', { className: 'cd-lg-filters cd-surface' }, [
      el('div', { className: 'cd-loan-filters-inline' }, [fD.box, fM.box, fV.box, fS.box]),
      chips.length ? el('div', { className: 'cd-lg-chips' }, [el('span', { className: 'cd-ex-chain-k' }, 'Showing:')].concat(chips)) : null
    ]);
  };

  Page.prototype.kpis = function () {
    var self = this, scope = this.scope, ch = CHILD[scope.level];
    var fyR = fyRange(this.sy), share = periodShare(this.period), partial = this.partial;
    var calls = [params(scope, this.rng, ch.group)];
    if (scope.level === 'mandal') { calls.push(params({ districtId: scope.districtId }, fyR, 'MANDAL')); }
    else if (partial && (scope.level === 'state' || scope.level === 'district')) { calls.push(params(scope, fyR, ch.group)); }
    return load(calls, function (rs) {
      var rows = rowsOf(rs[0]);
      if (!rows) { return note('Could not load the figures: ' + rs[0].error, true); }
      remember(ch.group, rows);
      var t = sum(rows), target = NaN;
      if (scope.level === 'mandal') {
        var sib = rowsOf(rs[1]) || [];
        for (var i = 0; i < sib.length; i++) { if (sib[i].id === scope.mandalId && has(sib[i].targetCr)) { target = sib[i].targetCr * ONE_CRORE * share; } }
      } else if (scope.level === 'state' || scope.level === 'district') {
        var ft = partial ? sum(rowsOf(rs[1]) || []) : t;
        target = ft.hasTarget ? ft.target * share : NaN;
      }
      var showTarget = scope.level === 'state' || scope.level === 'district' || scope.level === 'mandal';
      var ach = target > 0 ? t.disbursed / target : NaN;
      var defs = [];
      if (showTarget) { defs.push({ key: 'target', label: partial ? 'Target (pro-rated)' : 'Total Target', value: fmt.compactCr(target), color: '#15803d', icon: 'target',
                                    sub: partial ? 'share of the FY target' : null }); }
      defs.push({ key: 'disbursed', label: 'Total Disbursed', color: '#1d4ed8', icon: 'disbursed', value: fmt.compactCr(t.disbursed),
                  sub: fmt.missing(ach) ? null : fmt.percent(ach) + ' of target' });
      defs.push({ key: 'loans', label: 'Total Loans', value: fmt.number(t.loans), color: '#7c3aed', icon: 'disbursed',
                  sub: t.loans > 0 ? 'avg ' + fmt.compactCr(t.disbursed / t.loans) + ' per loan' : null });
      defs.push({ key: 'borrowers', label: 'Women Borrowers', value: fmt.number(t.hasBorrowers ? t.borrowers : NaN), color: '#0284c7', icon: 'borrowers' });
      defs.push({ key: 'open', label: 'Active Loans', value: fmt.number(t.open), color: GREEN, icon: 'active' });
      defs.push({ key: 'closed', label: 'Closed Loans', value: fmt.number(t.closed), color: AMBER, icon: 'closed' });
      var odHere = scope.level === 'state' ? self.data.org.metrics.od : scope.level === 'district' && scope.region ? scope.region.metrics.od
                 : scope.level === 'mandal' && scope.office ? scope.office.metrics.od : null;
      if (odHere) {
        defs.push({ key: 'overdue', label: 'Overdue', value: fmt.compactCr(odHere.amount), color: '#dc2626', icon: 'closed', plain: true,
                    sub: fmt.number(odHere.loans) + ' loans behind' });
      }
      return el('div', { className: 'cd-loan-kpi-row cd-lg-kpis' + (defs.length === 4 ? ' cd-lg-kpis--4' : defs.length === 6 ? ' cd-lg-kpis--6' : defs.length === 7 ? ' cd-lg-kpis--7' : '') }, defs.map(function (k) {
        var card = el('div', withProps({ className: 'cd-loan-kpi-chevron' }, k.plain ? {} : onActivate(function () {
          self.split({ metric: k.key, title: k.label, color: k.color });
        })), [
          el('div', { className: 'cd-loan-kpi-chevron__body' }, [
            el('div', { className: 'cd-loan-kpi-chevron__label' }, k.label),
            el('div', { className: 'cd-loan-kpi-chevron__value', style: { color: k.color } }, k.value),
            k.sub ? el('div', { className: 'cd-lg-kpi-sub' }, k.sub) : null
          ]),
          el('div', { className: 'cd-loan-kpi-chevron__arrow', style: { backgroundColor: k.color } })
        ]);
        card.querySelector('.cd-loan-kpi-chevron__arrow').innerHTML = svgIcon(k.icon);
        return card;
      }));
    }, 'Loading figures...');
  };

  Page.prototype.status = function () {
    var self = this, scope = this.scope, ch = CHILD[scope.level];
    var head = el('div', { className: 'cd-loan-section-head' }, [el('div', {}, [
      el('h2', {}, 'Loan Status'),
      el('p', { className: 'cd-text-muted' }, 'Loans given in ' + this.periodName + ', by what has happened to them since. Click a panel to see where they are.')
    ])]);
    var body = load([params(scope, this.rng, ch.group)], function (rs) {
      var rows = rowsOf(rs[0]);
      if (!rows) { return note('Could not load the loan status: ' + rs[0].error, true); }
      var t = sum(rows);
      function panel(kind, label, count, amount, color, bg, caption) {
        return el('div', withProps({ className: 'cd-status-card-ring cd-lg-status cd-lg-status--' + kind, style: { borderColor: color, backgroundColor: bg } },
          onActivate(function () { self.split({ metric: kind, title: label + ' loans', color: color }); })), [
          el('div', { className: 'cd-lg-status-top' }, [
            el('span', { className: 'cd-status-pill-badge', style: { color: color, borderColor: color, backgroundColor: '#ffffff' } }, fmt.number(count)),
            el('div', {}, [el('div', { className: 'cd-status-title', style: { color: color } }, label),
                           el('div', { className: 'cd-status-sub' }, caption)])
          ]),
          el('div', { className: 'cd-lg-status-amt', style: { color: color } }, [fmt.compactCr(amount), el('span', { className: 'cd-lg-status-amt-k' }, ' given')])
        ]);
      }
      return el('div', { className: 'cd-loan-status-grid' }, [
        panel('open', 'ACTIVE', t.open, t.hasOpenAmount ? t.openAmount : NaN, GREEN, '#f0fdf4', 'still being repaid'),
        panel('closed', 'CLOSED', t.closed, t.closedAmount, AMBER, '#fefce8', 'fully repaid')
      ]);
    }, 'Loading loan status...');
    return el('div', { className: 'cd-loan-section' }, [head, body]);
  };

  function statLines(r) {
    return [fmt.number(r.loanCount) + ' loans' + (has(r.borrowers) ? ' · ' + fmt.number(r.borrowers) + ' women' : ''),
            el('br', {}), fmt.number(r.openLoans) + ' active · ' + fmt.number(r.closedLoans) + ' closed'];
  }

  function totalOf(rows) { var t = 0; rows.forEach(function (r) { t += r.disbursed || 0; }); return t; }

  function projectCard(r, idx, total, onClick) {
    var th = PROJECT_THEMES[idx % PROJECT_THEMES.length];
    return el('div', withProps({ className: 'cd-project-card', style: { borderColor: th.color } }, onActivate(onClick)), [
      el('div', { className: 'cd-project-arrow', style: { borderLeftColor: th.color } }),
      el('div', { className: 'cd-project-pill', style: { backgroundColor: th.bg, color: th.color } }, fmt.percent(total > 0 ? r.disbursed / total : NaN)),
      el('div', { className: 'cd-project-title' }, r.name || ('Project ' + r.id)),
      el('div', { className: 'cd-project-amount', style: { color: th.color } }, fmt.compactCr(r.disbursed)),
      el('div', { className: 'cd-project-stats' }, statLines(r))
    ]);
  }

  function activityName(r) { return r.id === '' || !r.name ? 'Not recorded' : titleCase(r.name); }

  function activityCard(r, idx, total, onClick) {
    var color = ACTIVITY_COLORS[idx % ACTIVITY_COLORS.length];
    return el('div', withProps({ className: 'cd-activity-card' }, onActivate(onClick)), [
      el('div', { className: 'cd-activity-ribbon', style: { backgroundColor: color } }, fmt.percent(total > 0 ? r.disbursed / total : NaN)),
      el('div', { className: 'cd-activity-dot', style: { backgroundColor: color } }),
      el('div', { className: 'cd-activity-title' }, activityName(r)),
      el('div', { className: 'cd-activity-amount', style: { color: color } }, fmt.compactCr(r.disbursed)),
      el('div', { className: 'cd-activity-stats' }, statLines(r))
    ]);
  }

  function socialCard(def, r, total, onClick) {
    return el('div', withProps({ className: 'cd-social-chevron-wrapper', style: { backgroundColor: def.color } }, onActivate(onClick)), [
      el('div', { className: 'cd-social-badge-circle', style: { backgroundColor: def.color, fontSize: def.badge.length > 2 ? '12px' : '15px' } }, def.badge),
      el('div', { className: 'cd-social-chevron-inner' }, [
        el('div', { className: 'cd-social-content-row' }, [
          el('div', { className: 'cd-social-amount-text', style: { color: def.color } }, fmt.compactCr(r.disbursed)),
          el('div', { className: 'cd-social-share-text', style: { color: def.color } }, fmt.percent(total > 0 ? r.disbursed / total : NaN))
        ]),
        el('div', { className: 'cd-social-detail-stats' }, statLines(r))
      ])
    ]);
  }

  Page.prototype.cardsSection = function (title, desc, group, gridClass, limit, makeCard, allTitle) {
    var self = this, holder = el('span', {});
    var head = el('div', { className: 'cd-loan-section-head' }, [el('div', {}, [el('h2', {}, title), el('p', { className: 'cd-text-muted' }, desc)]), holder]);
    if (group === 'PURPOSE' && this.partial && (this.scope.level === 'state' || this.scope.level === 'district')) {
      return el('div', { className: 'cd-loan-section' }, [head, note('Activity-wise figures are kept for the full financial year at state and district level. Choose "Full year", or open a mandal to see them for ' + this.periodName + '.')]);
    }
    var body = load([params(this.scope, this.rng, group)], function (rs) {
      var rows = rowsOf(rs[0]);
      if (!rows) { return note('Could not load this section: ' + rs[0].error, true); }
      rows = rows.filter(function (r) { return (r.loanCount || 0) > 0; }).sort(function (a, b) { return b.disbursed - a.disbursed; });
      if (!rows.length) { return el('p', { className: 'cd-text-muted' }, 'No loans were given here in ' + self.periodName + '.'); }
      var total = totalOf(rows);
      if (rows.length > limit) {
        holder.appendChild(el('button', { type: 'button', className: 'cd-btn-view-all', onClick: function () {
          var ov = overlay('#9d482b');
          ov.setTitle(allTitle, '' + self.periodName + ' · ' + rows.length + ' in all · click any card');
          ov.setBody(el('div', { className: gridClass }, rows.map(function (r, i) { return makeCard(r, i, total, function () { self.cardClick(group, r, i); }); })));
        } }, 'View All (' + rows.length + ')'));
      }
      return el('div', { className: gridClass }, rows.slice(0, limit).map(function (r, i) { return makeCard(r, i, total, function () { self.cardClick(group, r, i); }); }));
    }, 'Loading...');
    return el('div', { className: 'cd-loan-section' }, [head, body]);
  };

  Page.prototype.social = function () {
    var self = this;
    var head = el('div', { className: 'cd-loan-section-head' }, [el('div', {}, [
      el('h2', {}, 'Social Status-Wise Loans'), el('p', { className: 'cd-text-muted' }, 'Who is benefiting, by social category of the woman (OC / BC / SC / ST / Minority)')])]);
    var body = load([params(this.scope, this.rng, 'CATEGORY')], function (rs) {
      var rows = rowsOf(rs[0]);
      if (!rows) { return note('Could not load this section: ' + rs[0].error, true); }
      var by = {}, total = 0;
      rows.forEach(function (r) { by[String(r.id).toUpperCase()] = r; });
      SOCIAL.forEach(function (d) { if (by[d.id]) { total += by[d.id].disbursed || 0; } });
      var empty = { loanCount: 0, disbursed: 0, openLoans: 0, closedLoans: 0, borrowers: null };
      return el('div', { className: 'cd-social-grid cd-social-grid--5' }, SOCIAL.map(function (d) {
        var r = by[d.id] || empty;
        return socialCard(d, r, total, function () { self.cardClick('CATEGORY', withProps(withProps({}, r), { name: d.name, color: d.color })); });
      }));
    }, 'Loading...');
    return el('div', { className: 'cd-loan-section' }, [head, body]);
  };

  Page.prototype.cardClick = function (group, r, idx) {
    if (group === 'PROJECT') {
      this.split({ metric: 'disbursed', title: r.name || ('Project ' + r.id), color: PROJECT_THEMES[idx % PROJECT_THEMES.length].color, project: { type: r.id, name: r.name } });
    } else if (group === 'PURPOSE') {
      this.single({ title: activityName(r), color: ACTIVITY_COLORS[idx % ACTIVITY_COLORS.length], row: r, kind: 'activity' });
    } else {
      this.single({ title: r.name + ' women', color: r.color, row: r, kind: 'social' });
    }
  };

  var METRIC = {
    target:    { head: 'Target' },
    disbursed: { head: 'Disbursed' },
    loans:     { head: 'Loans given' },
    borrowers: { head: 'Women borrowers' },
    open:      { head: 'Active loans' },
    closed:    { head: 'Closed loans' }
  };

  function metricValue(r, metric) {
    switch (metric) {
      case 'target': return has(r.targetCr) ? r.targetCr * ONE_CRORE : 0;
      case 'borrowers': return r.borrowers || 0;
      case 'open': return r.openLoans || 0;
      case 'closed': return r.closedLoans || 0;
      case 'loans': return r.loanCount || 0;
      default: return r.disbursed || 0;
    }
  }

  function bigFigure(r, metric) {
    switch (metric) {
      case 'target': return fmt.compactCr(metricValue(r, 'target'));
      case 'borrowers': return fmt.number(r.borrowers);
      case 'open': case 'closed': case 'loans': return fmt.number(metricValue(r, metric));
      default: return fmt.compactCr(r.disbursed);
    }
  }

  function smallLine(r, metric) {
    var closedAmt = has(r.openAmount) ? Math.max(0, (r.disbursed || 0) - r.openAmount) : NaN;
    switch (metric) {
      case 'target':
        return has(r.targetCr) && r.targetCr > 0 ? 'Given ' + fmt.compactCr(r.disbursed) + ' · ' + fmt.percent(r.disbursed / (r.targetCr * ONE_CRORE)) + ' of target' : 'Given ' + fmt.compactCr(r.disbursed);
      case 'borrowers': return fmt.number(r.loanCount) + ' loans · ' + fmt.compactCr(r.disbursed);
      case 'open': return fmt.compactCr(has(r.openAmount) ? r.openAmount : NaN) + ' still being repaid';
      case 'closed': return fmt.compactCr(closedAmt) + ' fully repaid';
      default: return fmt.number(r.loanCount) + ' loans · ' + fmt.number(r.openLoans) + ' active · ' + fmt.number(r.closedLoans) + ' closed';
    }
  }

  function subOf(data, scope, group, r, navId) {
    if (group === 'DISTRICT') {
      var reg = navId ? data.byId[navId] : null;
      return reg ? 'AGM: ' + ex.districtAgm(data, reg) : '';
    }
    if (group === 'MANDAL') {
      var off = navId ? data.byId[navId] : null;
      return off && off.officer ? (off.officer.userId ? ex.roleLabel(off.officer.role) + ': ' + off.officer.name : 'No officer mapped') : '';
    }
    if (group === 'MEMBER') { return ''; }
    return has(r.activeMembers) ? fmt.number(r.activeMembers) + ' active members' : '';
  }

  Page.prototype.split = function (cfg) {
    var self = this, scope = this.scope, data = this.data, ch = CHILD[scope.level], metric = cfg.metric;
    var ov = overlay(cfg.color);
    var sub = this.where() + ' · ' + this.periodName + (cfg.project ? ' · ' + cfg.project.name : '');
    ov.setTitle(cfg.title, sub);
    if (metric === 'target' && scope.level !== 'state' && scope.level !== 'district') {
      ov.setBody(note('Targets are set for a mandal as a whole and are not split below it.'));
      return;
    }
    ov.setBody(loadingEl('Loading the split by ' + ch.one.toLowerCase() + '...'));
    ex.call(params(scope, this.rng, ch.group, cfg.project ? cfg.project.type : null), function (res) {
      var rows = rowsOf(res);
      if (!rows) { ov.setBody(note('Could not load: ' + res.error, true)); return; }
      remember(ch.group, rows);
      var list = rows.filter(function (r) {
        return metric === 'open' || metric === 'closed' || metric === 'borrowers' || metric === 'target' ? metricValue(r, metric) > 0 : (r.loanCount || 0) > 0;
      }).sort(function (a, b) { return metricValue(b, metric) - metricValue(a, metric); });
      var t = sum(list), max = list.length ? metricValue(list[0], metric) : 0;
      var totalText = metric === 'target' ? fmt.compactCr(t.target) : metric === 'borrowers' ? fmt.number(t.hasBorrowers ? t.borrowers : NaN)
                    : metric === 'open' ? fmt.number(t.open) : metric === 'closed' ? fmt.number(t.closed)
                    : metric === 'loans' ? fmt.number(t.loans) : fmt.compactCr(t.disbursed);
      var summary = el('div', { className: 'cd-lg-sum' }, [
        el('div', { className: 'cd-lg-sum-fig', style: { color: cfg.color } }, totalText),
        el('div', { className: 'cd-lg-sum-k' }, METRIC[metric].head + ' in ' + self.where() + ' · by ' + ch.one.toLowerCase() + ' · ' + list.length + ' ' + (list.length === 1 ? ch.one : ch.many).toLowerCase())
      ]);
      var items = list.map(function (r, i) {
        var navId = navIdOf(data, scope, ch.group, r);
        var canOpen = ch.group === 'MEMBER' || !!navId;
        var open = function () {
          if (ch.group === 'MEMBER') { self.member(r.id, r.name); return; }
          ov.close();
          self.go(self.path.concat([{ level: ch.level, id: navId }]));
        };
        var s = subOf(data, scope, ch.group, r, navId);
        var pct = max > 0 ? Math.round(metricValue(r, metric) / max * 100) : 0;
        return el('div', withProps({ className: 'cd-lg-row' + (canOpen ? '' : ' cd-lg-row--off') }, canOpen ? onActivate(open) : {}), [
          el('div', { className: 'cd-lg-row-rank' }, String(i + 1)),
          el('div', { className: 'cd-lg-row-main' }, [
            el('div', { className: 'cd-lg-row-name' }, ch.group === 'MEMBER' ? titleCase(r.name) : (r.name || r.id)),
            s ? el('div', { className: 'cd-ex-sub' }, s) : null,
            el('div', { className: 'cd-lg-bar' }, [el('div', { className: 'cd-lg-bar-fill', style: { width: pct + '%', backgroundColor: cfg.color } })])
          ]),
          el('div', { className: 'cd-lg-row-fig' }, [
            el('div', { className: 'cd-lg-row-big', style: { color: cfg.color } }, bigFigure(r, metric)),
            el('div', { className: 'cd-lg-row-small' }, smallLine(r, metric))
          ]),
          el('div', { className: 'cd-lg-row-chev', 'aria-hidden': 'true' }, canOpen ? '›' : '')
        ]);
      });
      ov.setBody(el('div', {}, [
        summary,
        el('p', { className: 'cd-ex-sub cd-lg-hint' }, ch.group === 'MEMBER' ? 'Click a woman to see every loan and repayment.' : 'Click a row to open it on the page.'),
        items.length ? el('div', { className: 'cd-lg-list' }, items) : el('p', { className: 'cd-text-muted' }, 'Nothing to show here for ' + self.periodName + '.')
      ]));
    });
  };

  Page.prototype.single = function (cfg) {
    var r = cfg.row, ov = overlay(cfg.color);
    ov.setTitle(cfg.title, this.where() + ' · ' + this.periodName);
    function tile(label, value) { return el('div', { className: 'cd-lg-tile' }, [el('div', { className: 'cd-lg-tile-k' }, label), el('div', { className: 'cd-lg-tile-v' }, value)]); }
    var closedAmt = has(r.openAmount) ? Math.max(0, (r.disbursed || 0) - r.openAmount) : NaN;
    ov.setBody(el('div', {}, [
      el('div', { className: 'cd-lg-sum' }, [el('div', { className: 'cd-lg-sum-fig', style: { color: cfg.color } }, fmt.compactCr(r.disbursed)),
        el('div', { className: 'cd-lg-sum-k' }, 'given as ' + cfg.title + ' in ' + this.where())]),
      el('div', { className: 'cd-lg-tiles' }, [
        tile('Loans', fmt.number(r.loanCount)), tile('Women', fmt.number(has(r.borrowers) ? r.borrowers : NaN)),
        tile('Active loans', fmt.number(r.openLoans)), tile('Closed loans', fmt.number(r.closedLoans)),
        tile('Still being repaid', fmt.compactCr(has(r.openAmount) ? r.openAmount : NaN)), tile('Fully repaid', fmt.compactCr(closedAmt))
      ]),
      note('The split of this ' + (cfg.kind === 'social' ? 'social category' : 'activity') + ' by ' + (CHILD[this.scope.level].one.toLowerCase()) + ' is not available yet. Use the filters above to move to a district, mandal, VO or SHG: every card then shows that place only.')
    ]));
  };

  Page.prototype.shgBlock = function () {
    var self = this, scope = this.scope;
    var info = load([{ action: 'shg', shgId: scope.shgId }], function (rs) {
      if (!rs[0].ok) { return note('Could not load the SHG details: ' + rs[0].error, true); }
      var g = rs[0].body.shg;
      if (!g) { return note('This SHG is not active in SNBSAP.'); }
      NAMES[scope.shgId] = g.name || NAMES[scope.shgId];
      var facts = [];
      function add(k, v) { if (v !== null && v !== undefined && String(v) !== '' && String(v) !== '0') { facts.push([k, v]); } }
      add('Village organisation', titleCase(g.voName));
      add('Registered', g.registered ? dateLabel(g.registered) : '');
      add('Members', has(g.members) ? fmt.number(g.members) : '');
      add('Social category', catLabel(g.category));
      add('Village', titleCase(g.village));
      add('Well-being', titleCase(g.wellbeing));
      add('Grade', g.grade);
      add('Bank', [titleCase(g.bank), titleCase(g.branch)].filter(Boolean).join(', '));
      if (String(g.disabled).toUpperCase() === 'Y') { add('Disabled members', 'Yes'); }
      if (String(g.minority).toUpperCase() === 'Y') { add('Minority', 'Yes'); }
      add('Contact', g.mobileLast4 ? 'XXXXXX' + g.mobileLast4 : '');
      return el('div', { className: 'cd-lg-shg cd-surface' }, [
        el('div', { className: 'cd-lg-shg-name' }, [el('span', { className: 'cd-lg-shg-ic', 'aria-hidden': 'true' }, 'SHG'), titleCase(g.name || scope.name)]),
        el('div', { className: 'cd-lg-facts' }, facts.map(function (f) {
          return el('div', { className: 'cd-lg-fact' }, [el('div', { className: 'cd-lg-fact-k' }, f[0]), el('div', { className: 'cd-lg-fact-v' }, f[1])]);
        }))
      ]);
    }, 'Loading the SHG...');
    var women = load([params(scope, this.rng, 'MEMBER')], function (rs) {
      var rows = rowsOf(rs[0]);
      if (!rows) { return note('Could not load the women: ' + rs[0].error, true); }
      remember('MEMBER', rows);
      rows = rows.slice().sort(function (a, b) { return (b.disbursed || 0) - (a.disbursed || 0) || (a.name < b.name ? -1 : 1); });
      return el('div', { className: 'cd-lg-section' }, [
        el('div', { className: 'cd-loan-section-head' }, [el('div', {}, [el('h2', {}, 'Women of this SHG'),
          el('p', { className: 'cd-text-muted' }, rows.length + ' active members · loans given in ' + self.periodName + ' · click a woman for her full record')])]),
        el('div', { className: 'cd-lg-members' }, rows.map(function (r) {
          var nm = titleCase(r.name);
          return el('div', withProps({ className: 'cd-lg-mcard' }, onActivate(function () { self.member(r.id, r.name); })), [
            el('div', { className: 'cd-lg-avatar', 'aria-hidden': 'true' }, nm.charAt(0) || '?'),
            el('div', { className: 'cd-lg-mcard-main' }, [
              el('div', { className: 'cd-lg-mcard-name' }, nm || r.id),
              el('div', { className: 'cd-ex-sub' }, (r.loanCount || 0) > 0
                ? fmt.number(r.loanCount) + (r.loanCount === 1 ? ' loan' : ' loans') + ' · ' + fmt.compactCr(r.disbursed) + ' · ' + fmt.number(r.openLoans) + ' active'
                : 'No loan this year')
            ]),
            el('div', { className: 'cd-lg-row-chev', 'aria-hidden': 'true' }, '›')
          ]);
        }))
      ]);
    }, 'Loading the women of this SHG...');
    return el('div', {}, [info, women]);
  };

  Page.prototype.member = function (memberId, nameHint) {
    var self = this, ov = overlay('#7c3aed');
    ov.setTitle(titleCase(nameHint) || 'Member', 'Loading...');
    ov.setBody(loadingEl('Loading every loan and repayment of this woman...'));
    ex.call({ action: 'member', memberId: memberId }, function (res) {
      if (!res.ok) { ov.setTitle(titleCase(nameHint) || 'Member', ''); ov.setBody(note('Could not load this woman: ' + res.error, true)); return; }
      var m = res.body.member;
      if (!m) { ov.setBody(note('This woman is not an active member in SNBSAP.')); return; }
      var full = titleCase((m.name || '') + ' ' + (m.surname || ''));
      ov.setTitle(full, 'Member ID ' + m.id);
      ov.setBody(self.memberBody(m, res.body.loans || []));
    });
  };

  var MARITAL = { M: 'Married', U: 'Unmarried', W: 'Widow', D: 'Divorced', S: 'Separated' };

  Page.prototype.memberBody = function (m, loans) {
    var scope = this.scope, d = this.data;
    var where = scope.crumbs.map(function (c) { return c.name; }).reverse().join(' › ');
    var grid = [];
    function add(k, v) { if (v !== null && v !== undefined && String(v).replace(/\s/g, '') !== '') { grid.push([k, v]); } }
    add('Father / husband', titleCase(m.fatherHusband));
    add('Born', m.birthYear > 1900 ? m.birthYear : '');
    add('Marital status', MARITAL[String(m.marital).toUpperCase()] || titleCase(m.marital));
    add('Education', titleCase(m.education));
    add('Well-being', titleCase(m.wellbeing));
    add('Village', titleCase(m.village));
    if (String(m.disabled).toUpperCase() === 'Y') { add('Disabled', 'Yes'); }
    add('Mobile', m.mobileLast4 ? 'XXXXXX' + m.mobileLast4 : '');
    var since = /^\d{4}/.test(m.registered || '') ? m.registered.substr(0, 4) : '';

    var o = scope.office && scope.office.officer;
    var resp = o ? el('div', { className: 'cd-lg-resp' }, [
      el('span', { className: 'cd-ex-chain-k' }, 'Responsible:'),
      el('strong', {}, o.userId ? o.name + ' (' + ex.roleLabel(o.role) + ')' : 'No officer mapped'), el('span', { className: 'cd-ex-crumb-sep' }, '→'),
      el('span', {}, 'AGM ' + (o.agmName || '—')), el('span', { className: 'cd-ex-crumb-sep' }, '→'),
      el('span', {}, 'DGM ' + (o.dgmName || '—'))]) : null;

    var all = loans.slice().sort(function (a, b) {
      var ao = String(a.status).toUpperCase() === 'OPEN' ? 0 : 1, bo = String(b.status).toUpperCase() === 'OPEN' ? 0 : 1;
      return ao - bo || (String(b.issuedDate) < String(a.issuedDate) ? -1 : 1);
    });
    var cards = all.map(function (l) {
      var isOpen = String(l.status).toUpperCase() === 'OPEN';
      var reps = (l.repayments || []).slice().reverse();
      var table = el('div', { className: 'cd-ex-table-wrap cd-ex-table-wrap--short', style: { display: 'none' } }, [el('table', { className: 'cd-ex-table cd-ex-table--tx' }, [
        el('thead', {}, [el('tr', {}, ['Date', 'Amount', 'Paid by', 'Status', 'Processing'].map(function (h) { return el('th', {}, h); }))]),
        el('tbody', {}, reps.map(function (x) {
          return el('tr', {}, [el('td', {}, dateLabel(x.date)), el('td', { className: 'cd-num' }, fmt.rupees(x.amount)),
            el('td', {}, ({ UPI: 'UPI', POS: 'POS (Paytm)', AUTO: 'Auto-debit', MANUAL: 'Manual' })[x.mode] || '—'),
            el('td', {}, x.status ? titleCase(x.status) : '—'), el('td', {}, x.processed === 'Y' ? 'Processed' : x.processed === 'N' ? 'Pending' : '—')]);
        }))
      ])]);
      var toggle = reps.length ? el('button', { type: 'button', className: 'cd-lg-link' }, 'Show ' + reps.length + (reps.length === 1 ? ' repayment' : ' repayments')) : el('span', { className: 'cd-text-muted' }, 'No repayments yet');
      if (reps.length) {
        toggle.addEventListener('click', function () {
          var show = table.style.display === 'none';
          table.style.display = show ? '' : 'none';
          toggle.textContent = (show ? 'Hide ' : 'Show ') + reps.length + (reps.length === 1 ? ' repayment' : ' repayments');
        }, false);
      }
      return el('div', { className: 'cd-lg-loan ' + (isOpen ? 'cd-lg-loan--open' : 'cd-lg-loan--closed') }, [
        el('div', { className: 'cd-lg-loan-head' }, [
          el('div', { className: 'cd-lg-loan-chips' }, [
            el('span', { className: 'cd-lg-tag cd-lg-tag--proj' }, l.projectName || ('Project ' + l.projectType)),
            l.purpose ? el('span', { className: 'cd-lg-tag cd-lg-tag--act' }, titleCase(l.purpose)) : null]),
          el('span', { className: 'cd-lg-state ' + (isOpen ? 'cd-lg-state--open' : 'cd-lg-state--closed') }, isOpen ? 'ACTIVE' : 'CLOSED')
        ]),
        el('div', { className: 'cd-lg-loan-amt' }, fmt.rupees(l.amount)),
        el('div', { className: 'cd-lg-loan-facts' }, [
          el('span', {}, 'Issued ' + dateLabel(l.issuedDate)),
          el('span', {}, 'Repaid ' + fmt.rupees(l.repaid) + ' (incl. interest)'),
          el('span', {}, fmt.number(l.repayTxns) + (l.repayTxns === 1 ? ' repayment' : ' repayments'))
        ]),
        CeoDash.core.arrearsLine(l),
        toggle, table
      ]);
    });
    var openN = 0; loans.forEach(function (l) { if (String(l.status).toUpperCase() === 'OPEN') { openN++; } });
    return el('div', {}, [
      el('div', { className: 'cd-lg-mhead' }, [
        el('div', { className: 'cd-lg-avatar cd-lg-avatar--big', 'aria-hidden': 'true' }, titleCase(m.name).charAt(0) || '?'),
        el('div', {}, [
          el('div', { className: 'cd-lg-mchips' }, [
            m.category ? el('span', { className: 'cd-lg-tag cd-lg-tag--cat' }, catLabel(m.category)) : null,
            since ? el('span', { className: 'cd-lg-tag' }, 'Member since ' + since) : null]),
          el('div', { className: 'cd-ex-sub' }, where)
        ])
      ]),
      grid.length ? el('div', { className: 'cd-lg-facts cd-lg-facts--m' }, grid.map(function (f) {
        return el('div', { className: 'cd-lg-fact' }, [el('div', { className: 'cd-lg-fact-k' }, f[0]), el('div', { className: 'cd-lg-fact-v' }, f[1])]);
      })) : null,
      resp,
      el('h3', { className: 'cd-lg-loans-h' }, loans.length ? 'Loans (' + loans.length + ') · ' + openN + ' active' : 'Loans'),
      cards.length ? el('div', {}, cards) : el('p', { className: 'cd-text-muted' }, 'This woman has not taken a loan.')
    ]);
  };

  function render(container, appState, data) {
    var scope = ex.scopeOf(data, appState.drillPath);
    if (scope.level === 'member') { ex.chapters['member-profile'](container, appState, data); return; }
    var ctx = ex.getCtx(data);
    var page = new Page(data, scope, appState, ctx.fy);
    var parts = [
      page.header(),
      page.filters(),
      page.kpis(),
      scope.level === 'shg' ? page.shgBlock() : null,
      scope.level === 'shg' ? page.shgHistory() : null,
      page.levelList(),
      page.status(),
      scope.level === 'shg' ? null : page.cardsSection('Project-wise Loans', 'Loans by the project (scheme) under which they were given', 'PROJECT', 'cd-project-grid cd-lg-grid6', 6, projectCard, 'All projects'),
      scope.level === 'shg' ? null : page.cardsSection('Activity-Wise Loans', 'Loans by the activity (purpose) the money was taken for', 'PURPOSE', 'cd-activity-grid cd-lg-grid6', 6, activityCard, 'All activities'),
      scope.level === 'shg' ? null : page.social()
    ].filter(Boolean);
    container.appendChild(el('section', { className: 'cd-chapter cd-chapter--loan-journey cd-chapter--lg' }, parts));
  }

  ex.chapters['loan-journey'] = render;

  /* Top SHGs of a mandal (the server returns the 100 with the highest collections, each with its VO) */
  var SHG_SORT = 'repaid';
  /* Loans Given: the level below, ranked, so every level opens the next one without the filters */
  var LG_SORT = 'disbursed';
  Page.prototype.levelList = function () {
    var self = this, scope = this.scope, data = this.data, ch = CHILD[scope.level];
    if (!ch || scope.level === 'shg' || scope.level === 'member') { return null; }
    return load([params(scope, this.rng, ch.group)], function (rs) {
      var rows = rowsOf(rs[0]);
      if (!rows) { return note('Could not load the ' + ch.many.toLowerCase() + ': ' + rs[0].error, true); }
      remember(ch.group, rows);
      var list = rows.map(function (r) {
        var navId = navIdOf(data, scope, ch.group, r), ent = navId && data.byId[navId];
        if (ent && ent.metrics && ent.metrics.od) { r.od = ent.metrics.od; } else if (!r.od) { r.od = null; }
        return { r: r, navId: navId, name: ent ? ent.name : titleCase(r.name || r.id), sub: subOf(data, scope, ch.group, r, navId),
                 disbursed: r.disbursed || 0, loans: r.loanCount || 0, women: has(r.borrowers) ? r.borrowers : 0, active: r.openLoans || 0,
                 odAmt: r.od ? r.od.amount : 0, odLoans: r.od ? r.od.loans : 0, odOpen: r.od ? r.od.open : 0,
                 odRate: r.od && r.od.open > 0 ? r.od.loans / r.od.open : 0, hasOd: !!r.od };
      }).filter(function (x) { return x.loans > 0; });
      var anyOd = list.some(function (x) { return x.hasOd; });
      var pills = el('div', { className: 'cd-cv-pills' });
      var holder = el('div', {});
      var all = false;
      var more = el('button', { type: 'button', className: 'cd-cv-link' });
      function draw() {
        clearBox(pills);
        [['disbursed', 'Amount given'], ['loans', 'Number of loans'], ['women', 'Women'], ['active', 'Active loans']].concat(anyOd ? [['odAmt', 'Overdue amount'], ['odRate', 'Overdue %']] : []).forEach(function (o) {
          pills.appendChild(el('button', { type: 'button', className: 'cd-cv-pill' + (LG_SORT === o[0] ? ' cd-cv-pill--on' : ''),
            onClick: function () { LG_SORT = o[0]; draw(); } }, o[1]));
        });
        var key = LG_SORT;
        var sorted = list.slice().sort(function (a, b) { return b[key] - a[key] || (a.name < b.name ? -1 : 1); });
        var max = sorted.length ? sorted[0][key] : 0;
        clearBox(holder);
        var box = el('div', { className: 'cd-cv-top-list' + (all ? ' cd-cv-scroll cd-cv-scroll--tall' : '') });
        (all ? sorted : sorted.slice(0, 10)).forEach(function (x, i) {
          var main = key === 'disbursed' ? fmt.compactCr(x.disbursed)
                   : key === 'odAmt' ? fmt.compactCr(x.odAmt) + ' overdue'
                   : key === 'odRate' ? fmt.percent(x.odRate, 1) + ' behind'
                   : fmt.number(x[key]) + (key === 'loans' ? ' loans' : key === 'women' ? ' women' : ' active');
          var sub = key === 'disbursed' ? fmt.number(x.loans) + (x.loans === 1 ? ' loan' : ' loans') + ' · ' + fmt.number(x.active) + ' active'
                  : key === 'odAmt' ? fmt.number(x.odLoans) + ' of ' + fmt.number(x.odOpen) + ' open loans behind'
                  : key === 'odRate' ? fmt.compactCr(x.odAmt) + ' overdue · ' + fmt.number(x.odLoans) + ' loans'
                  : fmt.compactCr(x.disbursed) + ' given';
          box.appendChild(el('div', withProps({ className: 'cd-cv-top-row cd-rp-rank-row', title: x.navId ? 'Open ' + x.name : x.name },
            x.navId ? onActivate(function () { self.go(self.path.concat([{ level: ch.level, id: x.navId }])); }) : {}), [
            el('span', { className: 'cd-cv-top-rank' }, String(i + 1)),
            el('span', { className: 'cd-rp-rank-who' }, [el('strong', {}, x.name), x.sub ? el('em', {}, x.sub) : null]),
            el('span', { className: 'cd-cv-top-bar' }, [el('i', { style: { width: (max > 0 ? Math.max(3, x[key] / max * 100) : 0) + '%', backgroundColor: key === 'odAmt' || key === 'odRate' ? '#dc2626' : '#15803d' } })]),
            el('span', { className: 'cd-cv-top-amt' }, [el('strong', {}, main), el('em', {}, sub)])
          ]));
        });
        holder.appendChild(sorted.length ? box : note('No loans given here in ' + self.periodName + '.'));
        more.textContent = all ? 'Show top 10' : 'View all (' + sorted.length + ')';
        more.style.display = sorted.length > 10 ? '' : 'none';
      }
      more.onclick = function () { all = !all; draw(); };
      draw();
      return el('div', { className: 'cd-cv-card cd-lg-levelcard' }, [
        el('div', { className: 'cd-cv-cardhead' }, [
          el('h3', {}, [ch.many + ' of ' + self.where(), el('small', {}, self.periodName + ' · click one to open it')]),
          more
        ]),
        el('div', { className: 'cd-cv-sortbar' }, [el('span', { className: 'cd-cv-muted' }, 'Rank by'), pills]),
        holder
      ]);
    }, 'Loading ' + ch.many.toLowerCase() + '...');
  };

  Page.prototype.topShgs = function () {
    var self = this, scope = this.scope;
    if (scope.level !== 'mandal') { return null; }
    var pills = el('div', { className: 'cd-ex-pills' });
    var holder = el('div', {});
    var head = el('div', { className: 'cd-loan-section-head' }, [
      el('div', {}, [el('h2', {}, 'Top SHGs in ' + scope.name),
                     el('p', { className: 'cd-text-muted' }, 'Leading SHGs of the mandal in ' + this.periodName + ' (from the 100 with the highest collections). Click an SHG to open it.')]),
      pills
    ]);
    var body = loadAfter(params(scope, this.rng, CHILD[scope.level].group), [params({ districtId: scope.districtId, mandalId: scope.mandalId }, this.rng, 'SHG')], function (rs) {
      var rows = rowsOf(rs[0]);
      if (!rows) { return note('Could not load the SHGs: ' + rs[0].error, true); }
      rows = rows.filter(function (r) { return (r.repaid || 0) > 0 || (r.loanCount || 0) > 0; });
      if (!rows.length) { return note('No SHG activity here in ' + self.periodName + '.'); }
      function draw() {
        var key = SHG_SORT, list = rows.slice().sort(function (a, b) { return (b[key] || 0) - (a[key] || 0); }).slice(0, 15);
        clearBox(pills);
        [['repaid', 'By collections'], ['disbursed', 'By loans given'], ['loanCount', 'By number of loans']].forEach(function (o) {
          pills.appendChild(el('button', { type: 'button', className: 'cd-toggle-btn' + (SHG_SORT === o[0] ? ' cd-ex-on' : ''),
                                           onClick: function () { SHG_SORT = o[0]; draw(); } }, o[1]));
        });
        pills.appendChild(ex.excelButton(function () {
          var xp = params({ districtId: scope.districtId, mandalId: scope.mandalId }, self.rng, 'SHG');
          xp.kind = 'drill'; xp.title = 'Top SHGs'; xp.label = scope.name + ' \u00b7 top 100 SHGs by collections \u00b7 ' + self.periodName;
          ex.download(xp);
        }, 'Excel'));
        clearBox(holder);
        holder.appendChild(el('div', { className: 'cd-ex-table-wrap' }, [el('table', { className: 'cd-ex-table' }, [
          el('thead', {}, [el('tr', {}, ['#', 'SHG', 'Women', 'Loans', 'Loans given', 'Repayments', 'Collected', 'Paid online'].map(function (h) { return el('th', {}, h); }))]),
          el('tbody', {}, list.map(function (r, i) {
            var on = (r.upiAmount || 0) + (r.posAmount || 0) + (r.autoAmount || 0);
            NAMES[r.id] = r.name;
            return el('tr', withProps({ className: 'cd-ex-row' }, onActivate(function () {
              if (!r.parentId) { return; }
              self.go((self.path || []).concat([{ level: 'vo', id: r.parentId }, { level: 'shg', id: r.id }]));
            })), [
              el('td', { className: 'cd-ex-rank' }, String(i + 1)),
              el('td', {}, [el('div', { className: 'cd-ex-name' }, titleCase(r.name || r.id)),
                            el('div', { className: 'cd-ex-sub' }, (NAMES[r.parentId] ? (/^vo/i.test(NAMES[r.parentId]) ? '' : 'VO ') + titleCase(NAMES[r.parentId]) + ' · ' : '') + 'SHG ID ' + r.id)]),
              el('td', { className: 'cd-num' }, fmt.number(r.activeMembers)),
              el('td', { className: 'cd-num' }, fmt.number(r.loanCount)),
              el('td', { className: 'cd-num' }, fmt.compactCr(r.disbursed)),
              el('td', { className: 'cd-num' }, fmt.number(r.repayTxns)),
              el('td', { className: 'cd-num' }, fmt.compactCr(r.repaid)),
              el('td', { className: 'cd-num' }, r.repaid > 0 ? fmt.percent(on / r.repaid) : '—')
            ]);
          }))
        ])]));
        return holder;
      }
      return draw();
    }, 'Loading the SHGs...');
    return el('div', { className: 'cd-loan-section cd-lg-topshg' }, [head, body]);
  };

  /* An SHG over the last two financial years, summed from its members */
  Page.prototype.shgHistory = function () {
    var self = this, scope = this.scope;
    if (scope.level !== 'shg') { return null; }
    var years = [this.sy, this.sy - 1];
    var body = load(years.map(function (y) { return params(scope, fyRange(y), 'MEMBER'); }), function (rs) {
      var sums = rs.map(function (res) {
        var t = { loans: 0, disbursed: 0, repaid: 0, txns: 0, online: 0, borrowers: 0, payers: 0 };
        (rowsOf(res) || []).forEach(function (r) {
          t.loans += r.loanCount || 0; t.disbursed += r.disbursed || 0; t.repaid += r.repaid || 0; t.txns += r.repayTxns || 0;
          t.online += (r.upiAmount || 0) + (r.posAmount || 0) + (r.autoAmount || 0);
          if ((r.loanCount || 0) > 0) { t.borrowers++; }
          if ((r.repaid || 0) > 0) { t.payers++; }
        });
        return t;
      });
      var rowsDef = [
        ['Loans given', function (t) { return fmt.number(t.loans); }],
        ['Amount given', function (t) { return fmt.compactCr(t.disbursed); }],
        ['Women who borrowed', function (t) { return fmt.number(t.borrowers); }],
        ['Repayments', function (t) { return fmt.number(t.txns); }],
        ['Amount collected', function (t) { return fmt.compactCr(t.repaid); }],
        ['Women who repaid', function (t) { return fmt.number(t.payers); }],
        ['Paid online', function (t) { return t.repaid > 0 ? fmt.percent(t.online / t.repaid) : '—'; }]
      ];
      return el('div', { className: 'cd-ex-table-wrap' }, [el('table', { className: 'cd-ex-table' }, [
        el('thead', {}, [el('tr', {}, [el('th', {}, ''), el('th', {}, 'FY ' + ex.fyLabel(years[0])), el('th', {}, 'FY ' + ex.fyLabel(years[1]))])]),
        el('tbody', {}, rowsDef.map(function (d) {
          return el('tr', {}, [el('td', {}, d[0]), el('td', { className: 'cd-num' }, d[1](sums[0])), el('td', { className: 'cd-num' }, d[1](sums[1]))]);
        }))
      ])]);
    }, 'Loading the SHG history...');
    return el('div', { className: 'cd-loan-section' }, [
      el('div', { className: 'cd-loan-section-head' }, [el('div', {}, [el('h2', {}, 'SHG history'),
        el('p', { className: 'cd-text-muted' }, 'This SHG over the last two financial years (all of its active members).')])]),
      body
    ]);
  };

  ex.lgKit = { Page: Page, CHILD: CHILD, load: load, params: params, rowsOf: rowsOf, note: note, loadingEl: loadingEl,
               onActivate: onActivate, withProps: withProps, remember: remember, navIdOf: navIdOf, subOf: subOf,
               has: has, titleCase: titleCase, clearBox: clearBox, catLabel: catLabel, overlay: overlay };
})(window);
/* ---------- Chapter: Repayments and collections ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  var ex = CeoDash.explorer, K = ex.lgKit;
  var el = CeoDash.core.dom.el;
  var fmt = CeoDash.core.format;

  var CHANNELS = [
    { key: 'upi',    label: 'UPI',         role: 'online', color: '#2563eb', hint: 'phone payment', icon: '\uD83D\uDCF1' },
    { key: 'pos',    label: 'POS (Paytm)', role: 'pos',    color: '#0d9488', hint: 'card / Paytm machine', icon: '\uD83D\uDCB3' },
    { key: 'auto',   label: 'Auto-debit',  role: 'bank',   color: '#7c3aed', hint: 'from the SHG bank account', icon: '\uD83C\uDFE6' },
    { key: 'manual', label: 'Manual',      role: 'cash',   color: '#b45309', hint: 'cash / bank / other', icon: '\uD83D\uDCB5' }
  ];
  var RIBBON = ['#15803d', '#0f766e', '#0284c7', '#2563eb', '#4338ca', '#6d28d9', '#0369a1', '#7e22ce'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function tally(rows) {
    var t = { repaid: 0, txns: 0, payers: 0, hasPayers: rows.length > 0,
              upi: 0, pos: 0, auto: 0, upiTxns: 0, posTxns: 0, autoTxns: 0, loans: 0, disbursed: 0 };
    rows.forEach(function (r) {
      t.repaid += r.repaid || 0; t.txns += r.repayTxns || 0;
      t.loans += r.loanCount || 0; t.disbursed += r.disbursed || 0;
      if (K.has(r.payers)) { t.payers += r.payers; } else { t.hasPayers = false; }
      t.upi += r.upiAmount || 0; t.pos += r.posAmount || 0; t.auto += r.autoAmount || 0;
      t.upiTxns += r.upiTxns || 0; t.posTxns += r.posTxns || 0; t.autoTxns += r.autoTxns || 0;
    });
    t.online = t.upi + t.pos + t.auto;
    t.manual = Math.max(0, t.repaid - t.online);
    t.manualTxns = Math.max(0, t.txns - t.upiTxns - t.posTxns - t.autoTxns);
    return t;
  }
  function online(r) { return (r.upiAmount || 0) + (r.posAmount || 0) + (r.autoAmount || 0); }
  function onlineShare(r) { return r.repaid > 0 ? online(r) / r.repaid : NaN; }
  function manualOf(r) { return Math.max(0, (r.repaid || 0) - online(r)); }
  function pct(v) { return fmt.missing(v) ? '—' : fmt.percent(v); }
  var SCOPE_CASH = NaN;
  function band(share) {
    if (fmt.missing(share)) { return 'no-data'; }
    if (!(SCOPE_CASH > 0)) { return share >= 0.95 ? 'healthy' : share >= 0.9 ? 'watch' : share >= 0.8 ? 'attention' : 'critical'; }
    var r = (1 - share) / SCOPE_CASH;
    return r <= 0.75 ? 'healthy' : r <= 1.05 ? 'watch' : r <= 1.5 ? 'attention' : 'critical';
  }

  function RepayPage(data, scope, appState, sy, payOn) {
    K.Page.call(this, data, scope, appState, sy, 'repayment-journey', 'Repayments & Collections');
    this.payOn = payOn;
  }
  RepayPage.prototype = K.Page.prototype;

  function entities(page, rows) {
    var scope = page.scope, data = page.data, ch = K.CHILD[scope.level];
    if (scope.level === 'shg') { return []; }
    return rows.map(function (r) {
      var navId = K.navIdOf(data, scope, ch.group, r);
      var ent = navId && data.byId[navId];
      if (ent && ent.metrics && ent.metrics.od) { r.od = ent.metrics.od; } else if (!r.od) { r.od = null; }
      return { id: r.id, navId: navId, row: r,
               name: ent ? ent.name : (ch.group === 'DISTRICT' || ch.group === 'MANDAL' ? K.titleCase(r.name) : K.titleCase(r.name || r.id)),
               sub: K.subOf(data, scope, ch.group, r, navId),
               performanceState: band(onlineShare(r)) };
    }).filter(function (e) { return (e.row.repaid || 0) > 0 || (e.row.repayTxns || 0) > 0; });
  }

  function open(page, e) {
    if (!e.navId) { return; }
    page.go(page.path.concat([{ level: K.CHILD[page.scope.level].level, id: e.navId }]));
  }

  var TONE = { '#3b82f6': 'blue', '#a855f7': 'purple', '#06b6d4': 'cyan', '#f97316': 'orange' };

  function kpiCards(page, t, rows) {
    function card(icon, label, value, sub, color, metric) {
      var clickable = page.scope.level !== 'shg';
      return el('div', K.withProps({ className: 'cd-rp-kpi cd-rp-kpi--' + TONE[color] + (clickable ? ' cd-rp-click' : '') },
        clickable ? K.onActivate(function () { split(page, rows, metric, label, color); }) : {}), [
        el('div', { className: 'cd-rp-kpi-icon', 'aria-hidden': 'true' }, icon),
        el('div', { className: 'cd-rp-kpi-body' }, [
          el('div', { className: 'cd-rp-kpi-label' }, label),
          el('div', { className: 'cd-rp-kpi-val cd-num' }, value),
          el('div', { className: 'cd-rp-kpi-sub' }, sub)
        ]),
        el('span', { className: 'cd-rp-kpi-dot', 'aria-hidden': 'true' })
      ]);
    }
    var cards = [
      card('\uD83D\uDEE1\uFE0F', 'Collected', fmt.compactCr(t.repaid), '' + page.periodName + ' \u00b7 incl. interest', '#3b82f6', 'repaid'),
      card('\uD83E\uDDFE', 'Repayments', fmt.number(t.txns), t.txns > 0 ? 'avg ' + fmt.rupees(t.repaid / t.txns) + ' each' : 'no payments yet', '#a855f7', 'txns')
    ];
    if (page.payOn) {
      cards.push(card('\uD83D\uDCF1', 'Paid online', fmt.compactCr(t.online), pct(t.repaid > 0 ? t.online / t.repaid : NaN) + ' of collected', '#06b6d4', 'online'));
      cards.push(card('\uD83D\uDCB5', 'Manual (offline)', fmt.compactCr(t.manual), pct(t.repaid > 0 ? t.manual / t.repaid : NaN) + ' of collected', '#f97316', 'manual'));
    } else {
      cards.push(card('\uD83D\uDC69', 'Women who repaid', fmt.number(t.hasPayers ? t.payers : NaN), 'distinct members', '#06b6d4', 'payers'));
    }
    return el('div', { className: 'cd-repay-kpi-grid cd-rp-kpis' }, cards);
  }

  function channels(page, t) {
    if (!page.payOn) {
      return el('div', { className: 'cd-surface cd-rp-card' }, [
        el('span', { className: 'cd-metric-label' }, 'Payments by Channel'),
        el('div', { className: 'cd-num cd-rp-total' }, fmt.compactCr(t.repaid)),
        el('p', { className: 'cd-text-muted' }, 'The payment-channel split is switched off on this server.')
      ]);
    }
    var total = t.repaid;
    return el('div', { className: 'cd-surface cd-rp-card' }, [
      el('div', { className: 'cd-pay-total-row' }, [
        el('div', {}, [
          el('span', { className: 'cd-metric-label' }, 'Payments by Channel'),
          el('div', { className: 'cd-num cd-rp-total' }, fmt.compactCr(total))
        ]),
        el('div', { style: { textAlign: 'right' } }, [
          el('div', { className: 'cd-num cd-rp-share-on' }, pct(total > 0 ? t.online / total : NaN) + ' online'),
          el('div', { className: 'cd-num cd-rp-share-off' }, pct(total > 0 ? t.manual / total : NaN) + ' manual')
        ])
      ]),
      el('div', { className: 'cd-rp-stack' }, CHANNELS.map(function (c) {
        var w = total > 0 ? t[c.key] / total * 100 : 0;
        return w > 0 ? el('div', { title: c.label, style: { width: w + '%', backgroundColor: c.color } }) : null;
      })),
      el('div', { className: 'cd-rp-pills' }, CHANNELS.map(function (c) {
        var amt = t[c.key], n = c.key === 'manual' ? t.manualTxns : t[c.key + 'Txns'];
        return el('div', { className: 'cd-rp-pill', style: { borderColor: c.color } }, [
          el('span', { className: 'cd-rp-pill-icon', style: { backgroundColor: c.color }, 'aria-hidden': 'true' }, c.icon),
          el('div', { className: 'cd-rp-pill-body' }, [
            el('span', { className: 'cd-rp-pill-label', style: { color: c.color } }, c.label + ' \u00b7 ' + c.hint),
            el('strong', { className: 'cd-rp-pill-amt cd-num' }, fmt.compactCr(amt)),
            el('span', { className: 'cd-rp-pill-share' }, pct(total > 0 ? amt / total : NaN) + ' | ' + fmt.number(n) + ' payments')
          ])
        ]);
      }))
    ]);
  }

  /* the level below, ranked; one list instead of three (ranking, cash dependency, open a ...) */
  var RP_SORT = 'repaid';
  var BAND_COLOR = { healthy: '#15803d', watch: '#a16207', attention: '#c2410c', critical: '#b91c1c', 'no-data': '#64748b' };
  var BAND_TEXT = { healthy: 'Strong', watch: 'Good', attention: 'Attention', critical: 'Concern', 'no-data': 'No data' };

  function rankList(page, ents) {
    var ch = K.CHILD[page.scope.level];
    var pills = el('div', { className: 'cd-cv-pills' });
    var holder = el('div', {});
    var all = false;
    var more = el('button', { type: 'button', className: 'cd-cv-link' });
    var anyOd = ents.some(function (e) { return !!e.row.od; });
    var SORTS = [['repaid', 'Collected'], ['txns', 'Repayments']].concat(page.payOn ? [['online', 'Online %'], ['cash', 'Cash %']] : [])
                .concat(anyOd ? [['odAmt', 'Overdue'], ['odRate', 'Overdue %']] : []);
    function val(e, key) {
      var r = e.row;
      if (key === 'txns') { return r.repayTxns || 0; }
      if (key === 'online') { return r.repaid > 0 ? online(r) / r.repaid : -1; }
      if (key === 'cash') { return r.repaid > 0 ? manualOf(r) / r.repaid : -1; }
      if (key === 'odAmt') { return r.od ? r.od.amount : -1; }
      if (key === 'odRate') { return r.od && r.od.open > 0 ? r.od.loans / r.od.open : -1; }
      return r.repaid || 0;
    }
    function draw() {
      K.clearBox(pills);
      SORTS.forEach(function (o) {
        pills.appendChild(el('button', { type: 'button', className: 'cd-cv-pill' + (RP_SORT === o[0] ? ' cd-cv-pill--on' : ''),
          onClick: function () { RP_SORT = o[0]; draw(); } }, o[1]));
      });
      var key = RP_SORT;
      var list = ents.slice().sort(function (a, b) { return val(b, key) - val(a, key); });
      var max = list.length ? Math.max(0, val(list[0], key)) : 0;
      var shown = all ? list : list.slice(0, 10);
      K.clearBox(holder);
      var box = el('div', { className: 'cd-cv-top-list' + (all ? ' cd-cv-scroll cd-cv-scroll--tall' : '') });
      shown.forEach(function (e, i) {
        var r = e.row, v = Math.max(0, val(e, key)), share = onlineShare(r), b = band(share);
        var od = r.od;
        var main = key === 'txns' ? fmt.number(r.repayTxns) + ' payments' : key === 'online' ? pct(share) + ' online'
                 : key === 'odAmt' ? (od ? fmt.compactCr(od.amount) + ' overdue' : '\u2014')
                 : key === 'odRate' ? (od && od.open > 0 ? fmt.percent(od.loans / od.open, 1) + ' behind' : '\u2014')
                 : key === 'cash' ? pct(r.repaid > 0 ? manualOf(r) / r.repaid : NaN) + ' cash' : fmt.compactCr(r.repaid);
        var sub = key === 'repaid' ? fmt.number(r.repayTxns) + ' payments' + (page.payOn ? ' · ' + pct(share) + ' online' : '')
                : key === 'cash' ? fmt.compactCr(manualOf(r)) + ' of ' + fmt.compactCr(r.repaid)
                : key === 'odAmt' || key === 'odRate' ? (od ? fmt.number(od.loans) + ' of ' + fmt.number(od.open) + ' open loans behind \u00b7 ' + fmt.compactCr(r.repaid) + ' collected' : '')
                : fmt.compactCr(r.repaid) + ' collected';
        box.appendChild(el('div', K.withProps({ className: 'cd-cv-top-row cd-rp-rank-row', title: e.navId ? 'Open ' + e.name : e.name },
          e.navId ? K.onActivate(function () { open(page, e); }) : {}), [
          el('span', { className: 'cd-cv-top-rank' }, String(i + 1)),
          el('span', { className: 'cd-rp-rank-who' }, [
            el('strong', {}, e.name),
            e.sub ? el('em', {}, e.sub) : null
          ]),
          el('span', { className: 'cd-cv-top-bar' }, [el('i', { style: { width: (max > 0 ? Math.max(3, v / max * 100) : 0) + '%',
            backgroundColor: key === 'cash' ? '#b45309' : key === 'online' ? '#0284c7' : key === 'odAmt' || key === 'odRate' ? '#dc2626' : '#2563eb' } })]),
          el('span', { className: 'cd-cv-top-amt' }, [el('strong', {}, main), el('em', {}, sub)]),
          page.payOn ? el('span', { className: 'cd-rp-band', style: { color: BAND_COLOR[b], borderColor: BAND_COLOR[b] } }, BAND_TEXT[b]) : null
        ]));
      });
      holder.appendChild(box);
      more.textContent = all ? 'Show top 10' : 'View all (' + list.length + ')';
      more.style.display = list.length > 10 ? '' : 'none';
    }
    more.onclick = function () { all = !all; draw(); };
    draw();
    return el('div', { className: 'cd-cv-card cd-rp-rankcard' }, [
      el('div', { className: 'cd-cv-cardhead' }, [
        el('h3', {}, [ch.many + ' of ' + page.where(), el('small', {}, page.periodName + ' · click one to open it' + (page.payOn ? ' · tag = online share against the state' : ''))]),
        more
      ]),
      el('div', { className: 'cd-cv-sortbar' }, [el('span', { className: 'cd-cv-muted' }, 'Rank by'), pills]),
      ents.length ? holder : el('div', { className: 'cd-cv-hint' }, 'No repayments recorded here in ' + page.periodName + '.')
    ]);
  }

  function shgCard(page) {
    return K.load([{ action: 'shg', shgId: page.scope.shgId }], function (rs) {
      var s = rs[0].body && rs[0].body.shg;
      if (!s) { return K.note('This SHG is not active in SNBSAP.'); }
      var facts = [
        ['VO', s.voName ? K.titleCase(s.voName) : ''], ['Registered', s.registered], ['Members', K.has(s.members) ? fmt.number(s.members) : ''],
        ['Category', s.category ? K.catLabel(s.category) : ''], ['Village', s.village ? K.titleCase(s.village) : ''],
        ['Wellbeing', s.wellbeing ? K.titleCase(s.wellbeing) : ''], ['Grade', s.grade], ['Bank', s.bank ? K.titleCase(s.bank) + (s.branch ? ', ' + K.titleCase(s.branch) : '') : ''],
        ['Mobile', s.mobileLast4 ? 'XXXXXX' + s.mobileLast4 : '']
      ].filter(function (f) { return f[1]; });
      return el('div', { className: 'cd-surface cd-rp-card' }, [
        el('h3', { className: 'cd-rp-h3' }, K.titleCase(s.name)),
        el('p', { className: 'cd-text-muted cd-rp-small' }, 'SHG ID ' + s.id + ' · repayments of all its members in ' + page.periodName + ' are summed above.'),
        el('div', { className: 'cd-rp-facts' }, facts.map(function (f) {
          return el('div', {}, [el('div', { className: 'cd-rp-fact-k' }, f[0]), el('div', { className: 'cd-rp-fact-v' }, f[1])]);
        }))
      ]);
    }, 'Loading the SHG...');
  }

  // one card per woman: what she paid, how many payments, and how she paid (UPI / POS / auto-debit / manual)
  var MODE_COLORS = { upi: '#7c3aed', pos: '#0284c7', auto: '#0d9488', manual: '#b45309' };
  function womenTable(page, rows) {
    var list = rows.filter(function (r) { return (r.repaid || 0) > 0; })
                   .sort(function (a, b) { return (b.repaid || 0) - (a.repaid || 0); });
    var cards = list.map(function (r, i) {
      var total = r.repaid || 0;
      var parts = [['upi', 'UPI', r.upiAmount || 0], ['pos', 'POS', r.posAmount || 0], ['auto', 'Auto', r.autoAmount || 0], ['manual', 'Cash', manualOf(r)]];
      var bar = null, legend = null, tag = null;
      if (page.payOn) {
        bar = el('div', { className: 'cd-wm-bar' }, parts.map(function (m) {
          return el('span', { className: 'cd-wm-seg', title: m[1] + ' ' + fmt.compactCr(m[2]), style: { width: (total > 0 ? m[2] / total * 100 : 0) + '%', backgroundColor: MODE_COLORS[m[0]] } });
        }));
        legend = el('div', { className: 'cd-wm-legend' }, parts.filter(function (m) { return m[2] > 0; }).map(function (m) {
          return el('span', {}, [el('i', { style: { backgroundColor: MODE_COLORS[m[0]] } }), m[1] + ' ' + fmt.compactCr(m[2])]);
        }));
        tag = CeoDash.components.JourneyView.stateBadge(band(onlineShare(r)));
      }
      return el('div', { className: 'cd-wm-card' }, [
        el('div', { className: 'cd-wm-top' }, [
          el('span', { className: 'cd-wm-rank' }, String(i + 1)),
          el('div', { className: 'cd-wm-who' }, [el('strong', {}, K.titleCase(r.name || r.id)), el('em', {}, 'Member ID ' + r.id)]),
          tag
        ]),
        el('div', { className: 'cd-wm-amt' }, [el('b', {}, fmt.compactCr(total)), el('span', {}, fmt.number(r.repayTxns) + (r.repayTxns === 1 ? ' payment' : ' payments') +
          (page.payOn ? ' \u00b7 ' + pct(onlineShare(r)) + ' online' : ''))]),
        bar, legend
      ]);
    });
    var paidNone = rows.length - list.length;
    return el('div', { className: 'cd-surface cd-rp-card', style: { marginTop: '18px' } }, [
      el('h3', { className: 'cd-rp-h3' }, 'How each woman paid'),
      el('p', { className: 'cd-text-muted cd-rp-small' }, list.length + ' women repaid in ' + page.periodName + (paidNone > 0 ? ' \u00b7 ' + paidNone + ' made no repayment' : '') +
        '. Largest collections first.'),
      list.length ? el('div', { className: 'cd-wm-grid' }, cards) : K.note('No repayments recorded in ' + page.periodName + '.')
    ]);
  }

  function split(page, rows, metric, label, color) {
    var ch = K.CHILD[page.scope.level], data = page.data, scope = page.scope;
    var value = {
      repaid: function (r) { return r.repaid || 0; }, txns: function (r) { return r.repayTxns || 0; },
      online: function (r) { return online(r); }, manual: function (r) { return manualOf(r); },
      payers: function (r) { return r.payers || 0; }
    }[metric];
    var big = function (r) { return metric === 'txns' || metric === 'payers' ? fmt.number(value(r)) : fmt.compactCr(value(r)); };
    var small = function (r) {
      if (metric === 'online' || metric === 'manual') { return pct(r.repaid > 0 ? value(r) / r.repaid : NaN) + ' of ' + fmt.compactCr(r.repaid) + ' collected'; }
      return fmt.number(r.repayTxns) + ' payments' + (page.payOn ? ' · ' + pct(onlineShare(r)) + ' online' : '');
    };
    var ov = K.overlay(color);
    ov.setTitle(label, page.where() + ' · ' + page.periodName + ' · by ' + ch.one.toLowerCase());
    var list = rows.filter(function (r) { return value(r) > 0; }).sort(function (a, b) { return value(b) - value(a); });
    var max = list.length ? value(list[0]) : 0;
    ov.setBody(el('div', {}, [
      el('p', { className: 'cd-ex-sub cd-lg-hint' }, 'Click a row to open it on the page.'),
      list.length ? el('div', { className: 'cd-lg-list' }, list.map(function (r, i) {
        var navId = K.navIdOf(data, scope, ch.group, r);
        var ent = navId && data.byId[navId];
        var go = function () { ov.close(); if (navId) { page.go(page.path.concat([{ level: ch.level, id: navId }])); } };
        return el('div', K.withProps({ className: 'cd-lg-row' + (navId ? '' : ' cd-lg-row--off') }, navId ? K.onActivate(go) : {}), [
          el('div', { className: 'cd-lg-row-rank' }, String(i + 1)),
          el('div', { className: 'cd-lg-row-main' }, [
            el('div', { className: 'cd-lg-row-name' }, ent ? ent.name : K.titleCase(r.name || r.id)),
            el('div', { className: 'cd-lg-bar' }, [el('div', { className: 'cd-lg-bar-fill', style: { width: (max > 0 ? Math.round(value(r) / max * 100) : 0) + '%', backgroundColor: color } })])
          ]),
          el('div', { className: 'cd-lg-row-fig' }, [
            el('div', { className: 'cd-lg-row-big', style: { color: color } }, big(r)),
            el('div', { className: 'cd-lg-row-small' }, small(r))
          ]),
          el('div', { className: 'cd-lg-row-chev', 'aria-hidden': 'true' }, navId ? '›' : '')
        ]);
      })) : el('p', { className: 'cd-text-muted' }, 'Nothing recorded here in ' + page.periodName + '.')
    ]));
  }

  function crumbs(page) {
    var list = page.scope.crumbs || [];
    if (!list.length) { return null; }
    var kids = [el('button', { type: 'button', className: 'cd-rp-crumb', onClick: function () { CeoDash.core.router.drillToDepth(0); } }, 'Andhra Pradesh')];
    var scope = page.scope, pending = [];
    list.forEach(function (c, i) {
      kids.push(el('span', { className: 'cd-rp-crumb-sep', 'aria-hidden': 'true' }, '\u203a'));
      var node = i === list.length - 1
        ? el('span', { className: 'cd-rp-crumb cd-rp-crumb--here' }, c.name)
        : el('button', { type: 'button', className: 'cd-rp-crumb', onClick: function () { CeoDash.core.router.drillToDepth(c.depth); } }, c.name);
      kids.push(node);
      /* opened by link or Back: VO / SHG names are not known yet, so look them up */
      if ((c.level === 'vo' || c.level === 'shg') && !ex.NAMES[c.id]) { pending.push({ node: node, crumb: c }); }
    });
    pending.forEach(function (x) {
      var p = x.crumb.level === 'vo'
        ? K.params({ districtId: scope.districtId, mandalId: scope.mandalId }, page.rng, 'VO')
        : K.params({ districtId: scope.districtId, mandalId: scope.mandalId, voId: scope.voId }, page.rng, 'SHG');
      ex.call(p, function (res) {
        var rows = K.rowsOf(res) || [];
        K.remember(x.crumb.level === 'vo' ? 'VO' : 'SHG', rows);
        if (ex.NAMES[x.crumb.id] && global.document.body.contains(x.node)) { CeoDash.core.state.set({}); }
      });
    });
    return el('nav', { className: 'cd-rp-crumbs', 'aria-label': 'Where you are' }, kids);
  }

  function render(container, appState, data) {
    var scope = ex.scopeOf(data, appState.drillPath);
    if (scope.level === 'member') { CeoDash.core.router.drillToDepth((appState.drillPath || []).length - 1); return; }
    var ctx = ex.getCtx(data);
    var page = new RepayPage(data, scope, appState, ctx.fy, true);
    var ch = K.CHILD[scope.level];
    var calls = [K.params(scope, page.rng, ch.group)];

    var body = K.load(calls, function (rs) {
      var rows = K.rowsOf(rs[0]) || [];
      page.payOn = rs[0].body.payModes !== false;
      K.remember(ch.group, rows);
      var t = tally(rows);
      SCOPE_CASH = t.repaid > 0 ? t.manual / t.repaid : NaN;
      var ents = entities(page, rows);
      return el('div', { className: 'cd-rp-page' }, [
        kpiCards(page, t, rows),
        scope.level === 'shg'
          ? el('div', { className: 'cd-cv-row' }, [el('div', { className: 'cd-rp-col-channels' }, [channels(page, t)]), el('div', { className: 'cd-rp-col-list' }, [shgCard(page)])])
          : el('div', { className: 'cd-cv-row' }, [el('div', { className: 'cd-rp-col-channels' }, [channels(page, t)]), el('div', { className: 'cd-rp-col-list' }, [rankList(page, ents)])]),
        scope.level === 'shg' ? womenTable(page, rows) : null,
        scope.level === 'shg' ? page.shgHistory() : page.topShgs()
      ]);
    }, 'Loading collections...');

    container.appendChild(el('section', { className: 'cd-chapter cd-chapter--repayment-journey cd-chapter--lg' }, [
      page.header(), crumbs(page), body
    ]));
  }

  ex.chapters['repayment-journey'] = render;
  ex.chapters['payment-behavior'] = render;
})(window);
