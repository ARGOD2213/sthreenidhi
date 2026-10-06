/* ---------- Explorer - shared drill-down page and the calls to the server ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  var el = CeoDash.core.dom.el, fmt = CeoDash.core.format;

  var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var CHILD = {
    state:    { group: 'DISTRICT', level: 'region', label: 'Districts', one: 'District' },
    district: { group: 'MANDAL',   level: 'office', label: 'Mandals',   one: 'Mandal' },
    mandal:   { group: 'VO',       level: 'vo',     label: 'Village Organisations (VOs)', one: 'VO' },
    vo:       { group: 'SHG',      level: 'shg',    label: 'SHGs', one: 'SHG' },
    shg:      { group: 'MEMBER',   level: 'member', label: 'Members (women)', one: 'Member' }
  };
  var NAMES = {};
  var PAY_ON = true;
  var MODES = [
    { key: 'upi',    label: 'UPI',            hint: 'phone payment',            color: '#7c3aed' },
    { key: 'pos',    label: 'POS (Paytm)',    hint: 'card / Paytm machine',     color: '#0284c7' },
    { key: 'auto',   label: 'Auto-debit',     hint: 'from the SHG bank account', color: '#0d9488' },
    { key: 'manual', label: 'Manual',         hint: 'cash / bank / other',      color: '#b45309' }
  ];
  var MODE_LABEL = { UPI: 'UPI', POS: 'POS (Paytm)', AUTO: 'Auto-debit', MANUAL: 'Manual' };
  var SORT = { by: 'amount', dir: -1 };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function addMonths(ym, k) {
    var y = +ym.substr(0, 4), m = +ym.substr(5, 2) - 1 + k;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  function nextDay(iso) {
    var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fyStartOf(ym) { var y = +ym.substr(0, 4); return +ym.substr(5, 2) >= 4 ? y : y - 1; }
  function fyLabel(sy) { return sy + '-' + pad((sy + 1) % 100); }
  function monthLabel(ym) { return MONTH_NAMES[+ym.substr(5, 2) - 1] + ' ' + ym.substr(0, 4); }
  function dateLabel(iso) { var p = iso.split('-'); return (+p[2]) + ' ' + MONTH_NAMES[+p[1] - 1] + ' ' + p[0]; }
  function windowEnd(data) { return addMonths(data.periods[data.periods.length - 1], 1); }

  function fyList(data) {
    var out = [];
    for (var i = data.periods.length - 1; i >= 0; i--) {
      var sy = fyStartOf(data.periods[i]);
      if (out.indexOf(sy) === -1 && data.periods.indexOf(sy + '-04') !== -1) { out.push(sy); }
    }
    return out;
  }

  function getCtx(data) {
    var c = CeoDash.core.context.get();
    var fys = fyList(data), cur = fyStartOf(String(data.fyStart).substr(0, 7));
    var fy = fys.indexOf(c.exFy) !== -1 ? c.exFy : cur;
    var type = (c.exPeriod === 'q' || c.exPeriod === 'm' || c.exPeriod === 'd') ? c.exPeriod : 'fy';
    return { fy: fy, type: type, value: c.exValue, project: c.exProject || null, fys: fys, curFy: cur };
  }

  function setCtx(patch, rerender) {
    CeoDash.core.context.set(patch);
    if (rerender !== false) { CeoDash.core.state.set({}); }
  }

  function range(ctx, data) {
    var sy = ctx.fy, from, to, label, months = 0;
    var we = windowEnd(data) + '-01';
    if (ctx.type === 'q') {
      var q = Math.min(4, Math.max(1, +ctx.value || 1)), sm = addMonths(sy + '-04', 3 * (q - 1));
      from = sm + '-01'; to = addMonths(sm, 3) + '-01'; months = 3;
      label = 'Q' + q + ' FY ' + fyLabel(sy) + ' (' + monthLabel(sm) + ' – ' + monthLabel(addMonths(sm, 2)) + ')';
    } else if (ctx.type === 'm' && /^\d{4}-\d{2}$/.test(ctx.value || '')) {
      from = ctx.value + '-01'; to = addMonths(ctx.value, 1) + '-01'; months = 1; label = monthLabel(ctx.value);
    } else if (ctx.type === 'd' && /^\d{4}-\d{2}-\d{2}$/.test(ctx.value || '')) {
      from = ctx.value; to = nextDay(ctx.value); label = dateLabel(ctx.value);
    } else {
      from = sy + '-04-01'; to = (sy + 1) + '-04-01'; months = 12; label = 'FY ' + fyLabel(sy);
    }
    if (ctx.type !== 'd' && to > we) {
      to = we;
      if (ctx.type === 'fy') { label += ' to date'; }
    }
    return { from: from, to: to, label: label, months: months, empty: from >= to };
  }

  var CACHE = {}, PENDING = {};

  function download(params) {
    var p = { action: 'export' };
    for (var k in params) { if (Object.prototype.hasOwnProperty.call(params, k) && k !== 'action') { p[k] = params[k]; } }
    var f = global.document.getElementById('cd-download-frame');
    if (!f) {
      f = global.document.createElement('iframe');
      f.id = 'cd-download-frame';
      f.style.display = 'none';
      global.document.body.appendChild(f);
    }
    f.src = urlOf(p);
  }
  function excelButton(onClick, label) {
    return el('button', { type: 'button', className: 'cd-xls-btn', title: 'Download this view as an Excel file', onClick: onClick },
      [el('span', { className: 'cd-xls-ico', 'aria-hidden': 'true' }, 'XLS'), label || 'Download Excel']);
  }

  function urlOf(params) {
    var q = [];
    for (var k in params) {
      if (Object.prototype.hasOwnProperty.call(params, k) && params[k] !== null && params[k] !== undefined && params[k] !== '') {
        q.push(k + '=' + encodeURIComponent(params[k]));
      }
    }
    if (global.__CEO_TOKEN) { q.push('t=' + encodeURIComponent(global.__CEO_TOKEN)); }
    return (global.__CEO_CTX || '') + '/CeoLoanIntelligence?' + q.join('&');
  }

  function call(params, done) {
    var url = urlOf(params);
    if (CACHE[url]) { done(CACHE[url]); return; }
    if (PENDING[url]) { PENDING[url].push(done); return; }
    PENDING[url] = [done];
    var xhr;
    function finish(out) {
      if (!PENDING[url]) { return; }
      var waiting = PENDING[url] || [];
      delete PENDING[url];
      if (out.ok) { CACHE[url] = out; }
      for (var i = 0; i < waiting.length; i++) {
        try { waiting[i](out); } catch (e) { if (global.console) { global.console.error(e); } }
      }
    }
    try {
      xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      try {
        xhr.timeout = 150000;
        xhr.ontimeout = function () { finish({ ok: false, error: 'SNBSAP is taking too long to answer.', body: null }); };
      } catch (te) {  }
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || !PENDING[url]) { return; }
        var body = null;
        try { body = JSON.parse(xhr.responseText); } catch (pe) { body = null; }
        if (xhr.status === 200 && body) { finish({ ok: true, error: null, body: body }); }
        else if (xhr.status === 0) { finish({ ok: false, error: 'Could not reach the dashboard server.', body: null }); }
        else { finish({ ok: false, error: (body && body.message) || ('The server returned ' + xhr.status + '.'), body: null }); }
      };
      xhr.send(null);
    } catch (e) {
      finish({ ok: false, error: 'Could not reach the dashboard server.', body: null });
    }
  }

  function failBox(message, retry) {
    return el('div', { className: 'cd-ex-note cd-ex-note--warn', role: 'alert' }, [
      el('span', {}, 'Could not load this section. ' + (message || '')),
      retry ? el('button', { type: 'button', className: 'cd-ex-retry', onClick: retry }, 'Retry') : null
    ]);
  }

  function slot(params, build, loadingText) {
    var box = el('div', { className: 'cd-ex-slot' });
    function run() {
      var filled = false;
      call(params, function (res) {
        filled = true;
        while (box.firstChild) { box.removeChild(box.firstChild); }
        var content;
        if (!res.ok) { content = failBox(res.error, run); }
        else {
          try { content = build(res); } catch (e) {
            content = el('div', { className: 'cd-ex-note cd-ex-note--warn' }, 'Could not show this section.');
            if (global.console) { global.console.error(e); }
          }
        }
        if (content) { box.appendChild(content); }
      });
      if (!filled) {
        while (box.firstChild) { box.removeChild(box.firstChild); }
        box.appendChild(el('div', { className: 'cd-ex-loading', role: 'status' }, [
          el('span', { className: 'cd-ex-spinner', 'aria-hidden': 'true' }), loadingText || 'Loading...'
        ]));
      }
    }
    run();
    return box;
  }

  function scopeOf(data, path) {
    var s = { level: 'state', name: data.org.name, districtId: null, mandalId: null, voId: null, shgId: null,
              memberId: null, region: null, office: null, crumbs: [] };
    path = path || [];
    for (var i = 0; i < path.length; i++) {
      var p = path[i], name = null;
      if (p.level === 'region') {
        var r = data.byId[p.id]; if (!r) { break; }
        s.level = 'district'; s.region = r; s.districtId = r.districtId; name = r.name;
      } else if (p.level === 'office') {
        var o = data.byId[p.id]; if (!o) { break; }
        s.level = 'mandal'; s.office = o; s.districtId = o.districtId; s.mandalId = o.mandalId; name = o.name;
        if (!s.region) { s.region = data.byId[o.regionId]; }
      } else if (p.level === 'vo') {
        s.level = 'vo'; s.voId = p.id; name = NAMES[p.id] || (data.byId[p.id] && data.byId[p.id].name) || ('VO ' + p.id);
      } else if (p.level === 'shg') {
        s.level = 'shg'; s.shgId = p.id; name = NAMES[p.id] || (data.byId[p.id] && data.byId[p.id].name) || ('SHG ' + p.id);
      } else if (p.level === 'member' || p.level === 'borrower') {
        s.level = 'member'; s.memberId = p.id; name = NAMES[p.id] || p.id;
      } else { break; }
      s.name = name;
      s.crumbs.push({ name: name, depth: i + 1, level: s.level, id: p.id });
    }
    return s;
  }

  function roleLabel(r) {
    return r === 'MANAGER' ? 'Manager' : r === 'AM' ? 'Assistant Manager' : r === 'AGM' ? 'AGM (as officer)' : 'Officer';
  }

  // first two names, then "+N more" - a district can have many AGMs and the full list ran over several lines
  function shortList(names) {
    if (!names.length) { return '\u2014'; }
    return names.length <= 2 ? names.join(' / ') : names.slice(0, 2).join(' / ') + ' +' + (names.length - 2) + ' more';
  }

  function responsible(data, scope) {
    if (scope.office && scope.office.officer) {
      var o = scope.office.officer;
      return { officer: o.userId ? o.name + ' (' + roleLabel(o.role) + ')' : 'No officer mapped', agm: o.agmName || '—', dgm: o.dgmName || '—' };
    }
    if (scope.region) {
      var agms = [], dgms = [];
      (scope.region.officeIds || []).forEach(function (id) {
        var of = data.byId[id] && data.byId[id].officer;
        if (!of) { return; }
        if (of.agmName && agms.indexOf(of.agmName) === -1) { agms.push(of.agmName); }
        if (of.dgmName && dgms.indexOf(of.dgmName) === -1) { dgms.push(of.dgmName); }
      });
      return { officer: null, agm: shortList(agms), dgm: shortList(dgms) };
    }
    return null;
  }

  function districtAgm(data, region) { var r = responsible(data, { region: region }); return r ? r.agm : '—'; }

  function scopeParams(scope) {
    return { districtId: scope.districtId, mandalId: scope.mandalId, voId: scope.voId, shgId: scope.shgId };
  }

  function childParams(scope, ctx, rng) {
    var p = scopeParams(scope);
    p.action = 'drill'; p.group = CHILD[scope.level].group; p.from = rng.from; p.to = rng.to;
    p.project = ctx.project ? ctx.project.type : null;
    return p;
  }

  function childRows(data, scope, res) {
    var ch = CHILD[scope.level];
    if (!res.ok) { return { error: res.error, rows: [] }; }
    PAY_ON = res.body.payModes !== false;
    var slugOf = {};
    data.regions.forEach(function (r) { slugOf[r.districtId] = r.id; });
    var rows = (res.body.rows || []).map(function (r) {
      var navId = r.id, sub = '';
      if (ch.group === 'DISTRICT') {
        navId = slugOf[r.id];
        var reg = data.byId[navId];
        if (reg) { r.name = reg.name; sub = 'AGM: ' + districtAgm(data, reg); }
      } else if (ch.group === 'MANDAL') {
        navId = scope.region ? scope.region.id + '-m' + r.id : null;
        var off = data.byId[navId];
        if (off && off.officer) { sub = off.officer.userId ? roleLabel(off.officer.role) + ': ' + off.officer.name : 'No officer mapped'; }
      } else {
        NAMES[r.id] = r.name;
        if (ch.group !== 'MEMBER' && r.activeMembers !== null) { sub = fmt.number(r.activeMembers) + ' active members'; }
        if (ch.group === 'MEMBER') { sub = 'Member ID ' + r.id; }
      }
      r.navId = navId; r.sub = sub;
      var odEnt = navId && data.byId[navId];
      if (odEnt && odEnt.metrics && odEnt.metrics.od) { r.od = odEnt.metrics.od; } else if (!r.od) { r.od = null; }
      return r;
    });
    return { rows: rows, source: res.body.source };
  }

  function sumRows(rows) {
    var t = { loanCount: 0, disbursed: 0, openLoans: 0, closedLoans: 0, repayTxns: 0, repaid: 0,
              upi: 0, pos: 0, auto: 0, upiTxns: 0, posTxns: 0, autoTxns: 0,
              borrowers: 0, payers: 0, activeMembers: 0, hasBorrowers: rows.length > 0, hasMembers: rows.length > 0, hasOpen: rows.length > 0 };
    rows.forEach(function (r) {
      t.loanCount += r.loanCount || 0; t.disbursed += r.disbursed || 0;
      t.repayTxns += r.repayTxns || 0; t.repaid += r.repaid || 0;
      if (r.openLoans === null) { t.hasOpen = false; } else { t.openLoans += r.openLoans; t.closedLoans += r.closedLoans || 0; }
      if (r.borrowers === null) { t.hasBorrowers = false; } else { t.borrowers += r.borrowers; t.payers += r.payers || 0; }
      if (r.activeMembers === null) { t.hasMembers = false; } else { t.activeMembers += r.activeMembers; }
      t.upi += r.upiAmount || 0; t.pos += r.posAmount || 0; t.auto += r.autoAmount || 0;
      t.upiTxns += r.upiTxns || 0; t.posTxns += r.posTxns || 0; t.autoTxns += r.autoTxns || 0;
    });
    t.online = t.upi + t.pos + t.auto;
    t.manual = Math.max(0, t.repaid - t.online);
    t.manualTxns = Math.max(0, t.repayTxns - t.upiTxns - t.posTxns - t.autoTxns);
    return t;
  }

  function onlineShare(r) {
    var on = (r.upiAmount || 0) + (r.posAmount || 0) + (r.autoAmount || 0);
    return r.repaid > 0 ? fmt.percent(on / r.repaid) : '—';
  }

  function modesPanel(t, rng) {
    var total = t.repaid;
    var rows = MODES.map(function (m) {
      var amt = t[m.key], txns = m.key === 'manual' ? t.manualTxns : t[m.key + 'Txns'];
      var share = total > 0 ? amt / total : 0;
      return el('div', { className: 'cd-ex-mode' }, [
        el('div', { className: 'cd-ex-mode-head' }, [
          el('span', { className: 'cd-ex-mode-dot', style: { backgroundColor: m.color } }),
          el('span', { className: 'cd-ex-mode-name' }, m.label),
          el('span', { className: 'cd-ex-mode-amt' }, fmt.compactCr(amt))
        ]),
        el('div', { className: 'cd-ex-bar-track cd-ex-mode-track' }, [el('div', { className: 'cd-ex-bar-fill', style: { width: Math.round(share * 100) + '%', backgroundColor: m.color } })]),
        el('div', { className: 'cd-ex-sub' }, fmt.percent(share) + ' · ' + fmt.number(txns) + ' payments · ' + m.hint)
      ]);
    });
    return el('div', { className: 'cd-loan-section' }, [
      el('div', { className: 'cd-loan-section-head' }, [el('div', {}, [
        el('h2', {}, 'How women paid'),
        el('p', { className: 'cd-text-muted' }, 'Online ' + (total > 0 ? fmt.percent(t.online / total) : '—') + ' · Offline ' +
          (total > 0 ? fmt.percent(t.manual / total) : '—') + ' of ' + fmt.compactCr(total) + ' collected in ' + rng.label + '.')
      ])]),
      el('div', { className: 'cd-ex-modes' }, rows)
    ]);
  }

  function targetFor(data, scope, ctx, rng) {
    if (ctx.project || ctx.fy !== ctx.curFy || !rng.months) { return NaN; }
    var m = scope.level === 'state' ? data.org.metrics : scope.level === 'district' ? scope.region.metrics
          : scope.level === 'mandal' ? scope.office.metrics : null;
    if (!m || !(m.disbursedTarget > 0)) { return NaN; }
    return m.disbursedTarget * (rng.months === 12 ? 1 : rng.months / 12);
  }

  function goToDepth(depth) { CeoDash.core.router.drillToDepth(depth); }

  function crumbs(scope, root) {
    var items = [el('button', { type: 'button', className: 'cd-ex-crumb', onClick: function () { goToDepth(0); } }, root || 'Andhra Pradesh')];
    scope.crumbs.forEach(function (c, i) {
      items.push(el('span', { className: 'cd-ex-crumb-sep' }, '›'));
      var last = i === scope.crumbs.length - 1;
      items.push(last ? el('span', { className: 'cd-ex-crumb cd-ex-crumb--here' }, c.name)
                      : el('button', { type: 'button', className: 'cd-ex-crumb', onClick: function () { goToDepth(c.depth); } }, c.name));
    });
    return el('nav', { className: 'cd-ex-crumbs', 'aria-label': 'Drill path' }, items);
  }

  function chain(data, scope) {
    var r = responsible(data, scope);
    if (!r) {
      var dgms = {}, agms = {}, nd = 0, na = 0;
      (data.offices || []).forEach(function (o) {
        var of = o.officer || {};
        if (of.dgmName && !dgms[of.dgmName]) { dgms[of.dgmName] = true; nd++; }
        if (of.agmName && !agms[of.agmName]) { agms[of.agmName] = true; na++; }
      });
      return el('div', { className: 'cd-ex-chain cd-text-muted' }, 'Responsibility: ' + nd + ' DGM' + (nd === 1 ? '' : 's') + ' → ' + na + ' AGM' + (na === 1 ? '' : 's') +
        ' → assigned officers, by district and mandal. Open a district to see who owns it.');
    }
    var parts = [el('span', { className: 'cd-ex-chain-k' }, 'Responsible:'),
                 el('span', {}, 'DGM ' + r.dgm), el('span', { className: 'cd-ex-crumb-sep' }, '→'),
                 el('span', {}, 'AGM ' + r.agm)];
    if (r.officer) { parts.push(el('span', { className: 'cd-ex-crumb-sep' }, '→')); parts.push(el('strong', {}, r.officer)); }
    if (scope.level === 'vo' || scope.level === 'shg' || scope.level === 'member') {
      parts.push(el('span', { className: 'cd-text-muted' }, ' (owner of this ' + (scope.office ? 'mandal' : 'area') + ')'));
    }
    return el('div', { className: 'cd-ex-chain' }, parts);
  }

  function contextBar(data, ctx, rng, opts) {
    opts = opts || {};
    var items = [];
    if (!opts.dateOnly) {
      var fySel = el('select', { className: 'cd-loan-filter-select', onChange: function (e) { setCtx({ exFy: +e.target.value, exPeriod: 'fy', exValue: null }); } },
        ctx.fys.map(function (sy) { return el('option', { value: String(sy), selected: sy === ctx.fy ? 'selected' : undefined }, 'FY ' + fyLabel(sy)); }));
      fySel.value = String(ctx.fy);
      items.push(el('div', { className: 'cd-loan-filter-field' }, [el('label', { className: 'cd-loan-filter-label' }, 'Financial year'), fySel]));

      var we = windowEnd(data);
      var pills = [el('button', { type: 'button', className: 'cd-toggle-btn' + (ctx.type === 'fy' ? ' cd-ex-on' : ''),
                                   onClick: function () { setCtx({ exPeriod: 'fy', exValue: null }); } }, 'Full year')];
      for (var q = 1; q <= 4; q++) {
        (function (qq) {
          var startMonth = addMonths(ctx.fy + '-04', 3 * (qq - 1));
          pills.push(el('button', {
            type: 'button', className: 'cd-toggle-btn' + (ctx.type === 'q' && +ctx.value === qq ? ' cd-ex-on' : ''),
            disabled: startMonth >= we ? 'disabled' : undefined,
            onClick: function () { setCtx({ exPeriod: 'q', exValue: qq }); }
          }, 'Q' + qq));
        })(q);
      }
      items.push(el('div', { className: 'cd-loan-filter-field' }, [el('label', { className: 'cd-loan-filter-label' }, 'Period'), el('div', { className: 'cd-ex-pills' }, pills)]));

      var monthOpts = [el('option', { value: '' }, 'All months')];
      for (var mi = 0; mi < 12; mi++) {
        var ym = addMonths(ctx.fy + '-04', mi);
        if (ym >= we) { break; }
        monthOpts.push(el('option', { value: ym, selected: ctx.type === 'm' && ctx.value === ym ? 'selected' : undefined }, monthLabel(ym)));
      }
      var mSel = el('select', { className: 'cd-loan-filter-select', onChange: function (e) {
        if (e.target.value) { setCtx({ exPeriod: 'm', exValue: e.target.value }); } else { setCtx({ exPeriod: 'fy', exValue: null }); }
      } }, monthOpts);
      mSel.value = ctx.type === 'm' ? ctx.value : '';
      items.push(el('div', { className: 'cd-loan-filter-field' }, [el('label', { className: 'cd-loan-filter-label' }, 'Month'), mSel]));
    }

    var projOpts = [el('option', { value: '' }, 'All projects')].concat((data.projectTypes || []).map(function (p) {
      return el('option', { value: p.type, selected: ctx.project && ctx.project.type === p.type ? 'selected' : undefined }, p.name);
    }));
    var pSel = el('select', { className: 'cd-loan-filter-select', onChange: function (e) {
      var t = e.target.value, name = '';
      (data.projectTypes || []).forEach(function (p) { if (p.type === t) { name = p.name; } });
      setCtx({ exProject: t ? { type: t, name: name } : null });
    } }, projOpts);
    pSel.value = ctx.project ? ctx.project.type : '';
    items.push(el('div', { className: 'cd-loan-filter-field' }, [el('label', { className: 'cd-loan-filter-label' }, 'Project'), pSel]));

    var showing = [el('span', { className: 'cd-ex-chain-k' }, 'Showing:'), el('strong', {}, rng.label)];
    if (ctx.project) {
      showing.push(el('button', { type: 'button', className: 'cd-ex-chip', title: 'Remove project filter',
                                  onClick: function () { setCtx({ exProject: null }); } }, 'Project: ' + ctx.project.name + '  ✕'));
    }
    if (ctx.type === 'd' && !opts.dateOnly) {
      showing.push(el('button', { type: 'button', className: 'cd-ex-chip', title: 'Back to the whole month',
                                  onClick: function () { setCtx({ exPeriod: 'm', exValue: String(ctx.value).substr(0, 7) }); } }, 'Date: ' + rng.label + '  ✕'));
    }
    return el('div', { className: 'cd-ex-bar cd-surface' }, [
      el('div', { className: 'cd-loan-filters-inline' }, items),
      el('div', { className: 'cd-ex-showing' }, showing)
    ]);
  }

  function kpi(label, value, sub, color) {
    return el('div', { className: 'cd-ex-kpi' }, [
      el('div', { className: 'cd-ex-kpi-label' }, label),
      el('div', { className: 'cd-ex-kpi-value', style: { color: color || '' } }, value),
      sub ? el('div', { className: 'cd-ex-kpi-sub' }, sub) : null
    ]);
  }

  function kpiRow(data, scope, ctx, rng, mode, rows) {
    var t = sumRows(rows);
    var target = targetFor(data, scope, ctx, rng);
    var ach = target > 0 ? (t.disbursed / target) * 100 : NaN;
    var borrowers = t.hasBorrowers ? t.borrowers : (ctx.type === 'fy' && ctx.fy === ctx.curFy && !ctx.project && scope.level !== 'state'
      ? (scope.level === 'district' ? scope.region.metrics.activeBorrowers : scope.level === 'mandal' ? scope.office.metrics.activeBorrowers : NaN)
      : (ctx.type === 'fy' && ctx.fy === ctx.curFy && !ctx.project ? data.org.metrics.activeBorrowers : NaN));
    var members = t.hasMembers ? t.activeMembers
      : scope.level === 'state' ? data.org.metrics.activeMembers : scope.level === 'district' ? scope.region.metrics.activeMembers : NaN;
    var loanCards = [
      kpi('Loans issued', fmt.number(t.loanCount), rng.label, '#1d4ed8'),
      kpi('Amount disbursed', fmt.compactCr(t.disbursed), t.hasOpen ? fmt.number(t.openLoans) + ' open · ' + fmt.number(t.closedLoans) + ' closed now' : null, '#1d4ed8'),
      kpi('Women who borrowed', fmt.number(borrowers), 'distinct members', '#0284c7'),
      kpi('Target', fmt.compactCr(target), fmt.missing(ach) ? (ctx.project ? 'targets are not set per project' : 'no target for this period') : fmt.percent(ach / 100) + ' achieved', '#15803d')
    ];
    var repayCards = [
      kpi('Amount collected', fmt.compactCr(t.repaid), rng.label + ' · incl. interest', '#15803d'),
      kpi('Repayment transactions', fmt.number(t.repayTxns), t.repayTxns > 0 ? 'avg ' + fmt.rupees(t.repaid / t.repayTxns) : null, '#15803d'),
      kpi('Women who repaid', fmt.number(t.hasBorrowers ? t.payers : NaN), 'distinct members', '#0f766e')
    ];
    if (PAY_ON) {
      repayCards.splice(1, 0, kpi('Paid online', fmt.compactCr(t.online),
        (t.repaid > 0 ? fmt.percent(t.online / t.repaid) : '—') + ' of collected · UPI, POS, auto-debit', '#7c3aed'));
    }
    var memberCard = kpi('Active members', fmt.number(members), 'in ' + scope.name, '#7c3aed');
    if (ctx.type === 'd') {
      return el('div', { className: 'cd-ex-kpis' }, [loanCards[0], loanCards[1], repayCards[0]].concat(PAY_ON ? [repayCards[1], repayCards[2]] : [repayCards[1]]));
    }
    var cards = mode === 'repayments' ? repayCards.concat([memberCard], loanCards.slice(0, 2)) : loanCards.concat([memberCard], repayCards.slice(0, 2));
    return el('div', { className: 'cd-ex-kpis' }, cards);
  }

  function amountOf(r, mode) { return mode === 'repayments' ? (r.repaid || 0) : (r.disbursed || 0); }

  function childTable(data, scope, ctx, rng, mode, res, onOpen) {
    var ch = CHILD[scope.level];
    var head = el('div', { className: 'cd-loan-section-head' }, [
      el('div', {}, [
        el('h2', {}, ch.label + ' of ' + scope.name),
        el('p', { className: 'cd-text-muted' }, (ctx.type === 'd' ? 'Loans and collections on ' : (mode === 'repayments' ? 'Collections' : 'Loans') + ' in ') + rng.label +
          (ctx.project ? ' · project ' + ctx.project.name : '') + '. Click any row to open it.')
      ]),
      el('div', { className: 'cd-ex-pills' }, [
        el('button', { type: 'button', className: 'cd-toggle-btn' + (SORT.by === 'amount' && SORT.dir < 0 ? ' cd-ex-on' : ''), onClick: function () { SORT = { by: 'amount', dir: -1 }; CeoDash.core.state.set({}); } }, 'Top first'),
        el('button', { type: 'button', className: 'cd-toggle-btn' + (SORT.by === 'amount' && SORT.dir > 0 ? ' cd-ex-on' : ''), onClick: function () { SORT = { by: 'amount', dir: 1 }; CeoDash.core.state.set({}); } }, 'Lowest first'),
        el('button', { type: 'button', className: 'cd-toggle-btn' + (SORT.by === 'name' ? ' cd-ex-on' : ''), onClick: function () { SORT = { by: 'name', dir: 1 }; CeoDash.core.state.set({}); } }, 'A–Z')
      ])
    ]);
    if (res.error) {
      return el('div', { className: 'cd-loan-section' }, [head, el('div', { className: 'cd-ex-note cd-ex-note--warn' }, 'Could not load ' + ch.label.toLowerCase() + ': ' + res.error)]);
    }
    var rows = res.rows.slice();
    rows.sort(function (a, b) {
      if (SORT.by === 'name') { return String(a.name).localeCompare(String(b.name)); }
      var d = (amountOf(a, mode) - amountOf(b, mode)) * SORT.dir;
      return d !== 0 ? d : String(a.name).localeCompare(String(b.name));
    });
    var max = 0;
    rows.forEach(function (r) { max = Math.max(max, amountOf(r, mode)); });
    var withTarget = (ch.group === 'DISTRICT' || ch.group === 'MANDAL') && !ctx.project && ctx.fy === ctx.curFy && rng.months > 0;
    var heads = ['#', ch.one, 'Loans issued', 'Disbursed', 'Repayments', 'Collected'];
    if (ch.group === 'MEMBER') { heads = ['#', 'Member', 'Loans in period', 'Borrowed', 'Repayments', 'Repaid']; }
    var withOnline = (mode === 'repayments' || ctx.type === 'd') && PAY_ON;
    if (withOnline) { heads.push('Paid online'); }
    if (withTarget) { heads.push('Target achieved'); }
    var body = rows.map(function (r, i) {
      var target = NaN;
      if (withTarget) {
        var ent = data.byId[r.navId];
        if (ent && ent.metrics.disbursedTarget > 0) { target = ent.metrics.disbursedTarget * (rng.months === 12 ? 1 : rng.months / 12); }
      }
      var share = max > 0 ? Math.round(amountOf(r, mode) / max * 100) : 0;
      var rank = SORT.by === 'amount' && SORT.dir < 0 && i < 3 && amountOf(r, mode) > 0;
      var cells = [
        el('td', { className: 'cd-ex-rank' }, rank ? el('span', { className: 'cd-ex-medal' }, String(i + 1)) : String(i + 1)),
        el('td', {}, [el('div', { className: 'cd-ex-name' }, r.name || r.id), r.sub ? el('div', { className: 'cd-ex-sub' }, r.sub) : null,
                      el('div', { className: 'cd-ex-bar-track' }, [el('div', { className: 'cd-ex-bar-fill' + (mode === 'repayments' ? ' cd-ex-bar-fill--repay' : ''), style: { width: share + '%' } })])]),
        el('td', { className: 'cd-num' }, fmt.number(r.loanCount) + (r.borrowers !== null && r.borrowers !== undefined && ch.group !== 'MEMBER' ? ' · ' + fmt.number(r.borrowers) + ' women' : '')),
        el('td', { className: 'cd-num' }, fmt.compactCr(r.disbursed)),
        el('td', { className: 'cd-num' }, fmt.number(r.repayTxns) + (r.payers !== null && r.payers !== undefined && ch.group !== 'MEMBER' ? ' · ' + fmt.number(r.payers) + ' women' : '')),
        el('td', { className: 'cd-num' }, fmt.compactCr(r.repaid))
      ];
      if (withOnline) { cells.push(el('td', { className: 'cd-num' }, onlineShare(r))); }
      if (withTarget) { cells.push(el('td', { className: 'cd-num' }, target > 0 ? fmt.percent(r.disbursed / target) : '—')); }
      var canOpen = !!r.navId;
      return el('tr', {
        className: 'cd-ex-row' + (canOpen ? '' : ' cd-ex-row--off'), tabIndex: canOpen ? '0' : undefined,
        onClick: canOpen ? function () { onOpen(r); } : undefined,
        onKeydown: canOpen ? function (evt) { if (evt.keyCode === 13 || evt.keyCode === 32) { onOpen(r); } } : undefined
      }, cells);
    });
    var table = el('div', { className: 'cd-ex-table-wrap' }, [el('table', { className: 'cd-ex-table' }, [
      el('thead', {}, [el('tr', {}, heads.map(function (h) { return el('th', {}, h); }))]),
      el('tbody', {}, body.length ? body : [el('tr', {}, [el('td', { colSpan: String(heads.length), className: 'cd-text-muted' }, 'Nothing recorded here.')])])
    ])]);
    return el('div', { className: 'cd-loan-section' }, [head, table,
      el('p', { className: 'cd-ex-foot cd-text-muted' }, rows.length + ' ' + ch.label.toLowerCase() + ' · ' + (res.source === 'memory' ? 'from the dashboard snapshot' : 'loaded on demand from SNBSAP'))]);
  }

  function projectPanel(data, scope, ctx, rng, mode) {
    var p = scopeParams(scope);
    p.action = 'drill'; p.group = 'PROJECT'; p.from = rng.from; p.to = rng.to;
    var head = el('div', { className: 'cd-loan-section-head' }, [el('div', {}, [
      el('h2', {}, 'By project'),
      el('p', { className: 'cd-text-muted' }, 'Click a project to analyse only that project at every level.')
    ])]);
    return el('div', { className: 'cd-loan-section' }, [head, slot(p, function (res) {
      return projectCards(res, ctx, mode);
    }, 'Loading projects...')]);
  }

  function projectCards(res, ctx, mode) {
    if (!res.ok) { return el('div', { className: 'cd-ex-note cd-ex-note--warn' }, res.error); }
    var rows = (res.body.rows || []).slice().sort(function (a, b) { return amountOf(b, mode) - amountOf(a, mode); });
    var total = 0;
    rows.forEach(function (r) { total += amountOf(r, mode); });
    var cards = rows.map(function (r) {
      var on = ctx.project && ctx.project.type === r.id;
      return el('div', {
        className: 'cd-ex-proj' + (on ? ' cd-ex-proj--on' : ''), role: 'button', tabIndex: '0',
        onClick: function () { setCtx({ exProject: on ? null : { type: r.id, name: r.name } }); },
        onKeydown: function (evt) { if (evt.keyCode === 13 || evt.keyCode === 32) { setCtx({ exProject: on ? null : { type: r.id, name: r.name } }); } }
      }, [
        el('div', { className: 'cd-ex-proj-name' }, r.name + (on ? '  ✓' : '')),
        el('div', { className: 'cd-ex-proj-amt' }, fmt.compactCr(amountOf(r, mode))),
        el('div', { className: 'cd-ex-sub' }, (mode === 'repayments' ? fmt.number(r.repayTxns) + ' repayments' : fmt.number(r.loanCount) + ' loans') +
          (total > 0 ? ' · ' + fmt.percent(amountOf(r, mode) / total) : ''))
      ]);
    });
    return cards.length ? el('div', { className: 'cd-ex-proj-list' }, cards) : el('p', { className: 'cd-text-muted' }, 'No loans or repayments in this period.');
  }

  function purposeNote(data, scope, ctx) {
    if (ctx.type !== 'fy' || ctx.fy !== ctx.curFy || ctx.project || (scope.level !== 'state' && scope.level !== 'district')) { return null; }
    var rows = scope.level === 'state' ? data.org.loanTypeComposition : ((data.compositionByRegion || {})[scope.region.id] || {}).purposes;
    if (!rows || !rows.length) { return null; }
    return el('div', { className: 'cd-loan-section' }, [
      el('div', { className: 'cd-loan-section-head' }, [el('div', {}, [el('h2', {}, 'By activity (purpose)'),
        el('p', { className: 'cd-text-muted' }, 'FY ' + fyLabel(ctx.fy) + ' · top activities in ' + scope.name)])]),
      el('div', { className: 'cd-ex-proj-list' }, rows.slice(0, 8).map(function (r) {
        return el('div', { className: 'cd-ex-proj cd-ex-proj--static' }, [
          el('div', { className: 'cd-ex-proj-name' }, r.name),
          el('div', { className: 'cd-ex-proj-amt' }, fmt.compactCr(r.amount)),
          el('div', { className: 'cd-ex-sub' }, fmt.number(r.loanCount) + ' loans')
        ]);
      }))
    ]);
  }

  function inRange(iso, rng) { return !!iso && iso >= rng.from && iso < rng.to; }

  function memberView(data, scope, ctx, rng) {
    return slot({ action: 'member', memberId: scope.memberId }, function (res) {
      return memberContent(data, scope, ctx, rng, res);
    }, 'Loading every loan and repayment of this member...');
  }

  function memberContent(data, scope, ctx, rng, res) {
    if (!res.ok) { return el('div', { className: 'cd-ex-note cd-ex-note--warn' }, 'Could not load this member: ' + res.error); }
    var m = res.body.member, loans = res.body.loans || [];
    if (!m) { return el('div', { className: 'cd-ex-note' }, 'This member is not active in SNBSAP.'); }
    NAMES[m.id] = m.name;
    var all = { amount: 0, repaid: 0, open: 0 }, per = { loans: 0, amount: 0, txns: 0, repaid: 0 };
    loans.forEach(function (l) {
      all.amount += l.amount || 0; all.repaid += l.repaid || 0;
      if (String(l.status).toUpperCase() === 'OPEN') { all.open++; }
      if (inRange(l.issuedDate, rng) && (!ctx.project || ctx.project.type === l.projectType)) { per.loans++; per.amount += l.amount || 0; }
      (l.repayments || []).forEach(function (x) {
        if (inRange(x.date, rng) && (!ctx.project || ctx.project.type === l.projectType)) { per.txns++; per.repaid += x.amount || 0; }
      });
    });
    var crumbNames = scope.crumbs.map(function (c) { return c.name; });
    var where = crumbNames.slice(0, -1).reverse().join(' · ');
    var identity = el('div', { className: 'cd-ex-member-id cd-surface' }, [
      el('div', { className: 'cd-ex-avatar' }, String(m.name || '?').charAt(0).toUpperCase()),
      el('div', {}, [
        el('h2', { style: { margin: '0 0 2px' } }, m.name),
        el('div', { className: 'cd-ex-sub' }, 'Member ID ' + m.id + ' · SHG ID ' + m.shgId),
        el('div', { className: 'cd-ex-sub' }, where),
        el('div', { className: 'cd-ex-sub' }, 'Phone, village, Aadhaar and social category are not recorded in SNBSAP member data.')
      ])
    ]);
    var kpis = el('div', { className: 'cd-ex-kpis' }, [
      kpi('Loans taken (all years)', String(loans.length), all.open + ' open now', '#1d4ed8'),
      kpi('Borrowed (all years)', fmt.rupees(all.amount), null, '#1d4ed8'),
      kpi('Repaid (all years)', fmt.rupees(all.repaid), 'includes interest', '#15803d'),
      kpi('In ' + rng.label, per.loans + ' loan' + (per.loans === 1 ? '' : 's') + ' · ' + fmt.rupees(per.amount),
          per.txns + ' repayment' + (per.txns === 1 ? '' : 's') + ' · ' + fmt.rupees(per.repaid) + (ctx.project ? ' · ' + ctx.project.name : ''), '#7c3aed')
    ]);
    var cards = loans.map(function (l, i) {
      var open = String(l.status).toUpperCase() === 'OPEN';
      var issuedHere = inRange(l.issuedDate, rng);
      var txRows = (l.repayments || []).slice().reverse().map(function (x) {
        return el('tr', { className: inRange(x.date, rng) ? 'cd-ex-in' : '' }, [
          el('td', {}, x.date || '—'), el('td', { className: 'cd-num' }, fmt.rupees(x.amount)),
          el('td', {}, x.status ? x.status.charAt(0).toUpperCase() + x.status.substr(1).toLowerCase() : '—'), el('td', {}, x.processed === 'Y' ? 'Processed' : x.processed === 'N' ? 'Pending' : (x.processed || '—')),
          el('td', {}, x.adjustType ? 'Adjustment ' + x.adjustType : '—'), el('td', {}, x.creditedDate || '—'),
          el('td', {}, MODE_LABEL[x.mode] || '—')
        ]);
      });
      return el('div', { className: 'cd-ex-loan cd-surface' + (issuedHere ? ' cd-ex-loan--in' : '') }, [
        el('div', { className: 'cd-ex-loan-head' }, [
          el('div', {}, [
            el('div', { className: 'cd-ex-sub' }, 'Loan ' + (i + 1) + ' · ' + (l.projectName || 'Project ' + l.projectType) + (l.purpose ? ' · ' + l.purpose : '')),
            el('div', { className: 'cd-ex-proj-amt' }, fmt.rupees(l.amount))
          ]),
          el('div', { style: { textAlign: 'right' } }, [
            el('span', { className: 'cd-ex-chip' + (open ? '' : ' cd-ex-chip--done') }, open ? 'Open' : 'Closed'),
            el('div', { className: 'cd-ex-sub' }, 'Issued ' + (l.issuedDate || '—') + (issuedHere ? ' · in selected period' : ''))
          ])
        ]),
        el('div', { className: 'cd-ex-loan-facts' }, [
          el('span', {}, 'Repaid ' + fmt.rupees(l.repaid) + ' (incl. interest)'),
          el('span', {}, fmt.number(l.repayTxns) + ' repayments'),
          el('span', {}, 'Last ' + (l.lastRepaymentDate || '—')),
          el('span', {}, 'Member loan a/c ' + l.id),
          el('span', {}, 'SHG loan a/c ' + (l.shgLoanAccNo || '—'))
        ]),
        CeoDash.core.arrearsLine(l),
        txRows.length ? el('div', { className: 'cd-ex-table-wrap cd-ex-table-wrap--short' }, [el('table', { className: 'cd-ex-table cd-ex-table--tx' }, [
          el('thead', {}, [el('tr', {}, ['Repayment date', 'Amount', 'Status', 'Processing', 'Adjustment', 'Credited', 'Paid by'].map(function (h) { return el('th', {}, h); }))]),
          el('tbody', {}, txRows)
        ])]) : el('p', { className: 'cd-text-muted' }, 'No repayments recorded for this loan.')
      ]);
    });
    return el('div', {}, [identity, kpis,
      el('h2', { style: { margin: '18px 0 8px' } }, 'Every loan of ' + m.name),
      el('p', { className: 'cd-text-muted', style: { marginTop: 0 } }, 'Rows highlighted fall in ' + rng.label + '.'),
      cards.length ? el('div', {}, cards) : el('p', { className: 'cd-text-muted' }, 'This member has not taken a loan.')]);
  }

  function openChild(row) { CeoDash.core.router.drillInto(row.level || 'x', row.navId); }

  function body(data, scope, ctx, rng, mode) {
    if (rng.empty) { return [el('div', { className: 'cd-ex-note' }, 'No data yet for ' + rng.label + '.')]; }
    if (scope.level === 'member') { return [memberView(data, scope, ctx, rng)]; }
    var ch = CHILD[scope.level];
    var params = childParams(scope, ctx, rng);
    var kpis = slot(params, function (res) { return kpiRow(data, scope, ctx, rng, mode, childRows(data, scope, res).rows); },
                    'Loading figures...');
    var table = slot(params, function (res) {
      return childTable(data, scope, ctx, rng, mode, childRows(data, scope, res),
                        function (r) { CeoDash.core.router.drillInto(ch.level, r.navId); });
    }, 'Loading ' + ch.label.toLowerCase() + '...');
    var modes = mode === 'repayments' ? slot(params, function (res) {
      var cr = childRows(data, scope, res);
      return PAY_ON ? modesPanel(sumRows(cr.rows), rng) : null;
    }, 'Loading payment modes...') : null;
    var side = ctx.type === 'd' ? null : el('div', {}, [modes, projectPanel(data, scope, ctx, rng, mode), purposeNote(data, scope, ctx)]);
    return [kpis, el('div', { className: 'cd-ex-grid' + (side ? '' : ' cd-ex-grid--single') }, [table, side])];
  }

  function render(container, appState, data, mode) {
    var ctx = getCtx(data), rng = range(ctx, data), scope = scopeOf(data, appState.drillPath);
    var title = mode === 'repayments' ? 'Repayments & Collections' : 'Loans Given';
    var desc = mode === 'repayments'
      ? 'Who repaid, how much and when: state → district → mandal → VO → SHG → each woman and every repayment.'
      : 'Who borrowed, how much and for what: state → district → mandal → VO → SHG → each woman and every loan.';
    var parts = [
      el('div', { className: 'cd-loan-header-bar' }, [el('div', { className: 'cd-loan-header-info' }, [
        el('h1', { className: 'cd-loan-page-title' }, title + (scope.level === 'state' ? '' : ' · ' + scope.name)),
        el('p', { className: 'cd-loan-page-desc' }, desc)
      ])]),
      contextBar(data, ctx, rng),
      crumbs(scope),
      chain(data, scope)
    ].concat(body(data, scope, ctx, rng, mode));
    container.appendChild(el('section', { className: 'cd-chapter cd-chapter--explorer' }, parts));
  }

  function dayPanel(data, path, isoDate) {
    var base = getCtx(data);
    var ctx = { fy: base.fy, type: 'd', value: isoDate, project: base.project, fys: base.fys, curFy: base.curFy };
    var rng = range(ctx, data), scope = scopeOf(data, path);
    return el('div', { className: 'cd-ex-day' }, [
      contextBar(data, ctx, rng, { dateOnly: true }),
      crumbs(scope),
      chain(data, scope)
    ].concat(scope.level === 'state' ? body(data, scope, ctx, rng, 'loans').slice(1) : body(data, scope, ctx, rng, 'loans')));
  }

  function chapter(mode) { return function (container, appState, data) { render(container, appState, data, mode); }; }

  CeoDash.explorer = {
    chapters: { 'loan-journey': chapter('loans'), 'member-profile': chapter('loans'),
                'repayment-journey': chapter('repayments'), 'payment-behavior': chapter('repayments') },
    render: render, dayPanel: dayPanel, call: call, failBox: failBox, scopeOf: scopeOf, getCtx: getCtx, setCtx: setCtx,
    download: download, excelButton: excelButton,
    range: range, fyLabel: fyLabel, addMonths: addMonths, roleLabel: roleLabel, districtAgm: districtAgm, NAMES: NAMES
  };
})(window);

