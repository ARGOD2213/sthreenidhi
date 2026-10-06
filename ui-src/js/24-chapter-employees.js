/* ---------- Chapter: Employee performance (zone map, profiles, leagues) ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  var ex = CeoDash.explorer, K = ex.lgKit;
  var el = CeoDash.core.dom.el;
  var fmt = CeoDash.core.format;
  var ONE_CRORE = 10000000;
  var NONE = 'none';

  var LEVELS = ['state', 'dgm', 'agm', 'officer'];
  var CHILD_OF = { state: 'dgm', dgm: 'agm', agm: 'officer', officer: 'mandal' };
  var TITLE = { dgm: ['DGM', 'DGMs (zones)'], agm: ['AGM', 'AGMs'], officer: ['Manager', 'Managers'], mandal: ['Mandal', 'Mandals'] };
  var BAND = {
    healthy:   { label: 'Strong',    color: '#15803d', bg: '#dcfce7' },
    watch:     { label: 'Good',      color: '#1d4ed8', bg: '#dbeafe' },
    attention: { label: 'Attention', color: '#b45309', bg: '#fef3c7' },
    critical:  { label: 'Concern',   color: '#b91c1c', bg: '#fee2e2' },
    'no-data': { label: 'No data',   color: '#64748b', bg: '#f1f5f9' }
  };
  var CHANNELS = [
    { key: 'upi', label: 'UPI', color: '#2563eb' }, { key: 'pos', label: 'POS (Paytm)', color: '#0d9488' },
    { key: 'auto', label: 'Auto-debit', color: '#7c3aed' }, { key: 'manual', label: 'Manual', color: '#b45309' }
  ];
  var SORTS = [
    { id: 'online', label: 'Online share' }, { id: 'cash', label: 'Cash share' },
    { id: 'achievement', label: 'Disbursement vs target' }, { id: 'collected', label: 'Collected' },
    { id: 'overdue', label: 'Overdue %' }
  ];
  var SORT = 'online';

  function blankFig() {
    return { target: 0, hasTarget: false, disbursed: 0, loans: 0, open: 0, closed: 0, borrowers: 0, hasBorrowers: true,
             repaid: 0, txns: 0, upi: 0, pos: 0, auto: 0,
             hasOd: false, odAmt: 0, odLoans: 0, odOpen: 0, odOut: 0, odRisk: 0 };
  }
  function addRow(f, r) {
    if (!r) { return; }
    if (K.has(r.targetCr)) { f.target += r.targetCr * ONE_CRORE; f.hasTarget = true; }
    f.disbursed += r.disbursed || 0; f.loans += r.loanCount || 0; f.open += r.openLoans || 0; f.closed += r.closedLoans || 0;
    if (K.has(r.borrowers)) { f.borrowers += r.borrowers; } else { f.hasBorrowers = false; }
    f.repaid += r.repaid || 0; f.txns += r.repayTxns || 0;
    f.upi += r.upiAmount || 0; f.pos += r.posAmount || 0; f.auto += r.autoAmount || 0;
    if (r.od) { f.hasOd = true; f.odAmt += r.od.amount; f.odLoans += r.od.loans; f.odOpen += r.od.open; f.odOut += r.od.outstanding; f.odRisk += r.od.atRisk; }
  }
  function finish(f) {
    f.odRate = f.hasOd && f.odOpen > 0 ? f.odLoans / f.odOpen : NaN;
    f.online = f.upi + f.pos + f.auto;
    f.manual = Math.max(0, f.repaid - f.online);
    f.onlineShare = f.repaid > 0 ? f.online / f.repaid : NaN;
    f.cashShare = f.repaid > 0 ? f.manual / f.repaid : NaN;
    f.achievement = f.hasTarget && f.target > 0 ? f.disbursed / f.target : NaN;
    return f;
  }
  var REF = { cash: NaN, ach: NaN };
  function cashRatio(f) {
    return fmt.missing(f.cashShare) || !(REF.cash > 0) ? NaN : f.cashShare / REF.cash;
  }
  function bandOf(f) {
    if (fmt.missing(f.onlineShare)) { return 'no-data'; }
    var r = cashRatio(f);
    if (fmt.missing(r)) { return f.onlineShare >= 0.95 ? 'healthy' : f.onlineShare >= 0.9 ? 'watch' : f.onlineShare >= 0.8 ? 'attention' : 'critical'; }
    return r <= 0.75 ? 'healthy' : r <= 1.05 ? 'watch' : r <= 1.5 ? 'attention' : 'critical';
  }
  function ratioText(f) {
    var r = cashRatio(f);
    return fmt.missing(r) ? '' : (Math.round(r * 10) / 10) + '× state cash';
  }
  function pct(v) { return fmt.missing(v) ? '—' : fmt.percent(v); }
  // first two districts, then "+N more" (a zone head can cover many districts)
  function shortDistricts(list) {
    return list.length <= 2 ? list.join(', ') : list.slice(0, 2).join(', ') + ' +' + (list.length - 2) + ' more';
  }
  function initials(name) {
    var w = String(name || '?').replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(function (x) { return x && x.length > 1; });
    return ((w[0] || '?').charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase();
  }

  function node(kind, id, name, role) {
    return { kind: kind, id: id, name: name, role: role, children: [], byId: {}, offices: [], districts: [], fig: null };
  }
  function childOf(parent, kind, id, name, role) {
    var c = parent.byId[id];
    if (!c) { c = node(kind, id, name, role); parent.byId[id] = c; parent.children.push(c); }
    return c;
  }

  function buildTree(data, rowFor) {
    var root = node('state', 'state', 'Andhra Pradesh', '');
    (data.offices || []).forEach(function (o) {
      var of = o.officer || {};
      var region = data.byId[o.regionId];
      var dgm = childOf(root, 'dgm', of.dgmUserId || NONE, of.dgmName || 'DGM not mapped', 'DGM');
      var agm = childOf(dgm, 'agm', of.agmUserId || NONE, of.agmName || 'AGM not mapped', 'AGM');
      var off = childOf(agm, 'officer', of.userId || NONE, of.userId ? (of.name || of.userId) : 'No officer mapped',
                        of.userId ? ex.roleLabel(of.role) : 'Unassigned');
      var mandal = childOf(off, 'mandal', o.id, o.name, region ? region.name : '');
      mandal.office = o;
      [root, dgm, agm, off, mandal].forEach(function (n) {
        n.offices.push(o.id);
        if (region && n.districts.indexOf(region.name) === -1) { n.districts.push(region.name); }
      });
    });
    (function sum(n) {
      n.fig = blankFig();
      if (n.kind === 'mandal') {
        var mrow = rowFor(n.office);
        if (mrow && !mrow.od && n.office.metrics) { mrow.od = n.office.metrics.od || null; }
        addRow(n.fig, mrow);
      }
      else { n.children.forEach(function (c) { sum(c); addAll(n.fig, c.fig); }); }
      finish(n.fig);
    })(root);
    return root;
  }
  function addAll(f, c) {
    f.target += c.target; f.hasTarget = f.hasTarget || c.hasTarget; f.disbursed += c.disbursed; f.loans += c.loans;
    f.open += c.open; f.closed += c.closed; f.borrowers += c.borrowers; f.hasBorrowers = f.hasBorrowers && c.hasBorrowers;
    f.repaid += c.repaid; f.txns += c.txns; f.upi += c.upi; f.pos += c.pos; f.auto += c.auto;
    f.hasOd = f.hasOd || c.hasOd; f.odAmt += c.odAmt; f.odLoans += c.odLoans; f.odOpen += c.odOpen; f.odOut += c.odOut; f.odRisk += c.odRisk;
  }
  function counts(n) {
    var c = { agm: 0, officer: 0, mandal: 0 };
    (function walk(x) { if (c[x.kind] !== undefined) { c[x.kind]++; } x.children.forEach(walk); })(n);
    return c;
  }

  /* unique people per role (a person mapped under two bosses is one person) */
  function people(root) {
    var seen = { dgm: {}, agm: {}, officer: {} }, out = { dgm: 0, agm: 0, officer: 0, mandal: 0, unassigned: 0 };
    (function walk(n, up) {
      if (n.kind === 'mandal') {
        out.mandal++;
        if (up.officer === NONE || up.agm === NONE) { out.unassigned++; }
        return;
      }
      if (seen[n.kind] && n.id !== NONE && !seen[n.kind][n.id]) { seen[n.kind][n.id] = true; out[n.kind]++; }
      var next = {}; for (var k in up) { if (up.hasOwnProperty(k)) { next[k] = up[k]; } }
      next[n.kind] = n.id;
      n.children.forEach(function (c) { walk(c, next); });
    })(root, {});
    return out;
  }
  /* person id -> the distinct bosses above them ({dgm, agm} pairs) */
  function bossIndex(root) {
    var idx = {};
    root.children.forEach(function (d) {
      d.children.forEach(function (a) {
        if (a.id !== NONE) { add('agm|' + a.id, { dgm: d }); }
        a.children.forEach(function (o) { if (o.id !== NONE) { add('officer|' + o.id, { dgm: d, agm: a }); } });
      });
    });
    function add(k, v) {
      var list = idx[k] || (idx[k] = []);
      for (var i = 0; i < list.length; i++) { if (list[i].dgm === v.dgm && list[i].agm === v.agm) { return; } }
      list.push(v);
    }
    return idx;
  }
  var BOSSES = {};

  function resolve(root, path) {
    var chain = [root], cur = root;
    for (var i = 0; i < path.length; i++) {
      var next = cur.byId[path[i].id];
      if (!next || next.kind !== path[i].level) { break; }
      chain.push(next); cur = next;
    }
    return chain;
  }
  function pathOf(chain) { return chain.slice(1).map(function (n) { return { level: n.kind, id: n.id }; }); }

  function pathForOffice(data, officeId) {
    var o = data.byId[officeId];
    if (!o || o.level !== 'office') { return []; }
    var of = o.officer || {};
    return [{ level: 'dgm', id: of.dgmUserId || NONE }, { level: 'agm', id: of.agmUserId || NONE }, { level: 'officer', id: of.userId || NONE }];
  }
  function pathForDistrict(data, slug) {
    var r = data.byId[slug];
    if (!r || !r.officeIds || !r.officeIds.length) { return []; }
    return pathForOffice(data, r.officeIds[0]).slice(0, 2);
  }
  function openFor(data, path) { CeoDash.core.router.goToChapter('performance-map', path); }

  function bootTree(data) {
    return buildTree(data, function (o) {
      var m = o.metrics || {};
      return { targetCr: m.disbursedTarget > 0 ? m.disbursedTarget / ONE_CRORE : null, disbursed: m.disbursed, loanCount: m.totalLoans,
               openLoans: m.pendingLoans, closedLoans: m.closedLoans, borrowers: fmt.missing(m.activeBorrowers) ? null : m.activeBorrowers,
               repaid: m.receivedRepayment, repayTxns: m.repayTxns, od: m.od || null };
    });
  }

  function kpiCards(n, sy, payOn) {
    var f = n.fig;
    function card(icon, label, value, sub, color) {
      return el('div', { className: 'cd-repay-kpi-card' }, [
        el('div', { className: 'cd-repay-kpi-icon', style: { backgroundColor: color } }, icon),
        el('div', {}, [el('div', { className: 'cd-repay-kpi-label' }, label), el('div', { className: 'cd-repay-kpi-val' }, value),
                       el('div', { className: 'cd-repay-kpi-sub' }, sub)])
      ]);
    }
    var cards = [];
    if (payOn) {
      cards.push(card('📱', 'Paid online', pct(f.onlineShare), fmt.compactCr(f.online) + ' of ' + fmt.compactCr(f.repaid) + ' collected', '#2563eb'));
      cards.push(card('💵', 'Paid in cash / manual', pct(f.cashShare), fmt.compactCr(f.manual) + ' collected manually', '#f97316'));
    }
    cards.push(card('🛡️', 'Collected', fmt.compactCr(f.repaid), fmt.number(f.txns) + ' repayments · FY ' + ex.fyLabel(sy), '#15803d'));
    cards.push(card('🎯', 'Disbursed vs target', pct(f.achievement), fmt.compactCr(f.disbursed) + (f.hasTarget ? ' of ' + fmt.compactCr(f.target) : ' · no target'), '#7c3aed'));
    cards.push(card('👩', 'Women borrowers', fmt.number(f.hasBorrowers ? f.borrowers : NaN), fmt.number(f.loans) + ' loans · ' + fmt.number(f.open) + ' active', '#0891b2'));
    if (f.hasOd) {
      cards.push(card('⚠️', 'Overdue', fmt.compactCr(f.odAmt), fmt.number(f.odLoans) + ' loans behind' + (fmt.missing(f.odRate) ? '' : ' · ' + fmt.percent(f.odRate, 1) + ' of open'), '#dc2626'));
    }
    return el('div', { className: 'cd-repay-kpi-grid cd-em-kpis' }, cards);
  }

  function stack(f, cls) {
    var total = f.repaid;
    return el('div', { className: 'cd-rp-stack ' + (cls || '') }, CHANNELS.map(function (c) {
      var w = total > 0 ? f[c.key] / total * 100 : 0;
      return w > 0 ? el('div', { title: c.label + ' ' + fmt.percent(f[c.key] / total), style: { width: w + '%', backgroundColor: c.color } }) : null;
    }));
  }

  function channelPanel(n, payOn) {
    var f = n.fig;
    if (!payOn) { return null; }
    return el('div', { className: 'cd-surface cd-rp-card cd-em-channels' }, [
      el('div', { className: 'cd-pay-total-row' }, [
        el('div', {}, [el('span', { className: 'cd-metric-label' }, 'How collections were paid'),
                       el('div', { className: 'cd-num cd-rp-total' }, fmt.compactCr(f.repaid))]),
        el('div', { style: { textAlign: 'right' } }, [el('div', { className: 'cd-num cd-rp-share-on' }, pct(f.onlineShare) + ' online'),
                                                       el('div', { className: 'cd-num cd-rp-share-off' }, pct(f.cashShare) + ' manual')])
      ]),
      stack(f),
      el('div', { className: 'cd-em-legend' }, CHANNELS.map(function (c) {
        return el('span', {}, [el('i', { style: { backgroundColor: c.color } }), c.label + ' ' + fmt.compactCr(f[c.key]) +
          ' (' + pct(f.repaid > 0 ? f[c.key] / f.repaid : NaN) + ')']);
      }))
    ]);
  }

  function sortValue(n) {
    var f = n.fig;
    if (SORT === 'cash') { return fmt.missing(f.cashShare) ? -1 : f.cashShare; }
    if (SORT === 'achievement') { return fmt.missing(f.achievement) ? -1 : f.achievement; }
    if (SORT === 'collected') { return f.repaid; }
    if (SORT === 'overdue') { return fmt.missing(f.odRate) ? -1 : f.odRate; }
    return fmt.missing(f.onlineShare) ? -1 : f.onlineShare;
  }

  function personCard(n, payOn, onOpen) {
    var f = n.fig, b = BAND[payOn ? bandOf(f) : 'no-data'];
    var c = counts(n);
    function many(k, one, more) { return k + ' ' + (k === 1 ? one : more); }
    var sub = n.kind === 'dgm' ? many(c.agm, 'AGM', 'AGMs') + ' · ' + many(c.officer, 'manager', 'managers') + ' · ' + many(c.mandal, 'mandal', 'mandals')
            : n.kind === 'agm' ? many(c.officer, 'manager', 'managers') + ' · ' + many(c.mandal, 'mandal', 'mandals') + ' · ' + shortDistricts(n.districts)
            : n.kind === 'officer' ? n.role + ' · ' + many(c.mandal, 'mandal', 'mandals') + ' · ' + shortDistricts(n.districts)
            : n.role;
    var bosses = BOSSES[n.kind + '|' + n.id] || [];
    if (bosses.length > 1) {
      sub += ' · also under ' + bosses.length + (n.kind === 'officer' ? ' AGMs' : ' DGMs');
    }
    var ach = f.achievement;
    return el('div', K.withProps({ className: 'cd-em-card', style: { borderLeftColor: b.color } }, K.onActivate(onOpen)), [
      el('div', { className: 'cd-em-card-top' }, [
        el('div', { className: 'cd-em-avatar', style: { backgroundColor: b.color } }, n.kind === 'mandal' ? 'M' : initials(n.name)),
        el('div', { className: 'cd-em-who' }, [el('div', { className: 'cd-em-name', title: n.name }, n.name), el('div', { className: 'cd-em-sub', title: sub }, sub)]),
        payOn ? el('div', { className: 'cd-em-score' }, [
          el('div', { className: 'cd-em-score-v', style: { color: b.color } }, pct(f.onlineShare)),
          el('div', { className: 'cd-em-score-k' }, 'online')
        ]) : null
      ]),
      payOn ? el('div', { className: 'cd-em-pillrow' }, [
        el('span', { className: 'cd-em-pill', style: { color: b.color, backgroundColor: b.bg } }, b.label + (ratioText(f) ? ' · ' + ratioText(f) : ''))
      ]) : null,
      payOn ? stack(f, 'cd-em-mini') : null,
      el('div', { className: 'cd-em-stats' }, [
        el('div', {}, [el('span', {}, 'Collected'), el('strong', {}, fmt.compactCr(f.repaid))]),
        payOn ? el('div', {}, [el('span', {}, 'Cash / manual'), el('strong', { style: { color: '#b45309' } }, fmt.compactCr(f.manual) + ' · ' + pct(f.cashShare))]) : null,
        el('div', {}, [el('span', {}, 'Disbursed'), el('strong', {}, fmt.compactCr(f.disbursed) + (fmt.missing(ach) ? '' : ' · ' + fmt.percent(ach) + ' of target'))]),
        el('div', {}, [el('span', {}, 'Women borrowers'), el('strong', {}, fmt.number(f.hasBorrowers ? f.borrowers : NaN))]),
        f.hasOd ? el('div', {}, [el('span', {}, 'Overdue'), el('strong', { style: { color: '#b91c1c' } }, fmt.compactCr(f.odAmt) + (fmt.missing(f.odRate) ? '' : ' · ' + fmt.percent(f.odRate, 1) + ' of loans'))]) : null
      ]),
      fmt.missing(ach) ? null : el('div', { className: 'cd-em-target' }, [el('div', { style: { width: Math.min(100, Math.round(ach * 100)) + '%' } })]),
      el('div', { className: 'cd-em-open' }, n.kind === 'mandal' ? 'Open collections ›' : 'Open ›')
    ]);
  }

  function mandalRows(kids, payOn) {
    var max = 0;
    kids.forEach(function (k) { var v = sortValue(k); if (v > max) { max = v; } });
    return el('div', { className: 'cd-cv-top-list' }, kids.map(function (k, i) {
      var f = k.fig, b = BAND[payOn ? bandOf(f) : 'no-data'], v = Math.max(0, sortValue(k));
      var main = SORT === 'cash' ? pct(f.cashShare) + ' cash' : SORT === 'achievement' ? pct(f.achievement) + ' of target'
               : SORT === 'overdue' ? pct(f.odRate) + ' behind' : SORT === 'collected' ? fmt.compactCr(f.repaid) : pct(f.onlineShare) + ' online';
      var sub = fmt.compactCr(f.repaid) + ' collected' + (payOn ? ' · ' + fmt.compactCr(f.manual) + ' cash' : '') +
                ' · ' + fmt.compactCr(f.disbursed) + ' given';
      return el('div', K.withProps({ className: 'cd-cv-top-row cd-rp-rank-row', title: 'Open the collections of ' + k.name }, K.onActivate(function () {
        CeoDash.core.router.goToChapter('repayment-journey', [{ level: 'region', id: k.office.regionId }, { level: 'office', id: k.office.id }]);
      })), [
        el('span', { className: 'cd-cv-top-rank' }, String(i + 1)),
        el('span', { className: 'cd-rp-rank-who' }, [el('strong', {}, k.name), el('em', {}, k.role)]),
        el('span', { className: 'cd-cv-top-bar' }, [el('i', { style: { width: (max > 0 ? Math.max(3, v / max * 100) : 0) + '%', backgroundColor: SORT === 'cash' ? '#b45309' : SORT === 'overdue' ? '#dc2626' : b.color } })]),
        el('span', { className: 'cd-cv-top-amt' }, [el('strong', {}, main), el('em', {}, sub)]),
        payOn ? el('span', { className: 'cd-rp-band', style: { color: b.color, borderColor: b.color } }, b.label) : null
      ]);
    }));
  }

  function leagues(root, payOn, go) {
    if (!payOn) { return null; }
    var agms = [], officers = [];
    root.children.forEach(function (d) {
      d.children.forEach(function (a) {
        if (a.id !== NONE) { agms.push({ n: a, path: [{ level: 'dgm', id: d.id }, { level: 'agm', id: a.id }] }); }
        a.children.forEach(function (o) {
          if (o.id !== NONE) { officers.push({ n: o, path: [{ level: 'dgm', id: d.id }, { level: 'agm', id: a.id }, { level: 'officer', id: o.id }] }); }
        });
      });
    });
    function box(title, list) {
      var ents = list.filter(function (x) { return x.n.fig.repaid > 0; }).map(function (x) {
        return { name: x.n.name + (x.n.districts.length ? ' · ' + shortDistricts(x.n.districts) : ''), path: x.path,
                 share: x.n.fig.onlineShare, performanceState: bandOf(x.n.fig) };
      });
      return el('div', { className: 'cd-surface cd-rp-card cd-rp-half' }, [
        el('h3', { className: 'cd-rp-h3' }, title),
        CeoDash.components.EntityRanking({
          title: 'Share of collections paid online, of ' + ents.length + ' · Bottom 10 = most cash',
          entities: ents, metricAccessor: function (e) { return fmt.missing(e.share) ? 0 : e.share; },
          metricFormatter: function (v) { return fmt.percent(v); }, initialMode: 'bottom', height: 462,
          onRowClick: function (e) { go(e.path); }
        })
      ]);
    }
    return el('div', { className: 'cd-rp-row' }, [box('AGM league - online payments', agms), box('Manager league - online payments', officers)]);
  }

  /* headline counts and people mapped under more than one boss */
  function loginIndex(data) {
    var idx = {};
    (data.offices || []).forEach(function (o) {
      var of = o.officer || {}, reg = data.byId[o.regionId], dn = reg ? reg.name : '';
      function add(id, name, role, tier, path) {
        if (!id) { return; }
        var k = String(id).toUpperCase(), e = idx[k] || (idx[k] = { name: name || id, role: role, tier: tier, path: path, districts: [] });
        if (dn && e.districts.indexOf(dn) === -1) { e.districts.push(dn); }
      }
      var dg = of.dgmUserId || NONE, ag = of.agmUserId || NONE;
      add(of.userId, of.name, ex.roleLabel(of.role), 'Manager', [{ level: 'dgm', id: dg }, { level: 'agm', id: ag }, { level: 'officer', id: of.userId }]);
      add(of.agmUserId, of.agmName, 'AGM', 'AGM', [{ level: 'dgm', id: dg }, { level: 'agm', id: ag }]);
      add(of.dgmUserId, of.dgmName, 'DGM', 'DGM', [{ level: 'dgm', id: dg }]);
    });
    return idx;
  }
  function keyedCall(sy) { return { action: 'keyedBy', from: sy + '-04-01', to: (sy + 1) + '-04-01' }; }
  var KEYED_WAIT = 'Reading cash entries from SNBSAP - the first time after each refresh can take about a minute...';

  /* who keyed the cash: repayments whose bank credit was entered by a person's login */
  /* popup: who keyed the manual collections, by login, matched to the officer mapping */
  var TIER = {
    Manager: { color: '#0d9488', bg: '#ccfbf1' }, AGM: { color: '#2563eb', bg: '#dbeafe' },
    DGM: { color: '#7c3aed', bg: '#ede9fe' }, Other: { color: '#64748b', bg: '#f1f5f9' }
  };
  function keyedView(root, data, sy, go) {
    var ov = K.overlay('#b45309');
    ov.setTitle('Who keys the cash', 'Manual (cash) repayments in FY ' + ex.fyLabel(sy) + ', by the login that entered them');
    var query = '', tier = 'all';
    var holder = K.load([keyedCall(sy)], function (rs) {
      var idx = loginIndex(data);
      var rows = ((rs[0].body && rs[0].body.rows) || []).map(function (r) {
        var who = idx[String(r.login).toUpperCase()];
        return { login: r.login, txns: r.txns || 0, amount: r.amount || 0, first: r.first, last: r.last, who: who, tier: who ? who.tier : 'Other' };
      }).sort(function (a, b) { return b.amount - a.amount; });
      if (!rows.length) { return K.note('No cash entries keyed by a login in FY ' + ex.fyLabel(sy) + '.'); }
      var total = 0, entries = 0, byTier = { Manager: 0, AGM: 0, DGM: 0, Other: 0 }, countTier = { Manager: 0, AGM: 0, DGM: 0, Other: 0 };
      rows.forEach(function (r) { total += r.amount; entries += r.txns; byTier[r.tier] += r.amount; countTier[r.tier]++; });
      var top = rows[0].amount || 1;

      function tile(label, value, sub, color) {
        return el('div', { className: 'cd-kc-tile', style: { borderTopColor: color } }, [el('span', {}, label), el('strong', { style: { color: color } }, value), el('em', {}, sub)]);
      }
      var tiles = el('div', { className: 'cd-kc-tiles' }, [
        tile('Cash keyed by logins', fmt.compactCr(total), fmt.number(entries) + ' entries \u00b7 ' + rows.length + ' logins', '#b45309'),
        tile('By managers', total > 0 ? fmt.percent(byTier.Manager / total) : '\u2014', fmt.compactCr(byTier.Manager) + ' \u00b7 ' + countTier.Manager + ' logins', TIER.Manager.color),
        tile('By AGMs / DGMs', total > 0 ? fmt.percent((byTier.AGM + byTier.DGM) / total) : '\u2014', fmt.compactCr(byTier.AGM + byTier.DGM) + ' \u00b7 ' + (countTier.AGM + countTier.DGM) + ' logins', TIER.AGM.color),
        tile('Other / system logins', total > 0 ? fmt.percent(byTier.Other / total) : '\u2014', fmt.compactCr(byTier.Other) + ' \u00b7 not in the officer mapping', TIER.Other.color),
        tile('All manual collections', fmt.compactCr(root.fig.manual), 'incl. payments with no VO credit record', '#0f172a')
      ]);
      var split = el('div', { className: 'cd-kc-split' }, ['Manager', 'AGM', 'DGM', 'Other'].map(function (t) {
        var w = total > 0 ? byTier[t] / total * 100 : 0;
        return w > 0 ? el('div', { title: t + ' ' + fmt.compactCr(byTier[t]), style: { width: w + '%', backgroundColor: TIER[t].color } }) : null;
      }));
      var splitLegend = el('div', { className: 'cd-kc-legend' }, ['Manager', 'AGM', 'DGM', 'Other'].map(function (t) {
        return el('span', {}, [el('i', { style: { backgroundColor: TIER[t].color } }), (t === 'Other' ? 'Other / system' : t + 's') + ' ' + (total > 0 ? fmt.percent(byTier[t] / total) : '')]);
      }));

      var filters = el('div', { className: 'cd-kc-filters' });
      var listBox = el('div', { className: 'cd-kc-list' });
      var search = el('input', { type: 'text', className: 'cd-hv-search', placeholder: 'Find a name or login...' });
      search.onkeyup = function () { query = String(search.value || '').toLowerCase(); drawList(); };
      function drawList() {
        K.clearBox(filters);
        [['all', 'Everyone'], ['Manager', 'Managers'], ['AGM', 'AGMs'], ['DGM', 'DGMs'], ['Other', 'Other / system']].forEach(function (t) {
          filters.appendChild(el('button', { type: 'button', className: 'cd-toggle-btn' + (tier === t[0] ? ' cd-ex-on' : ''),
            onClick: function () { tier = t[0]; drawList(); } }, t[1]));
        });
        filters.appendChild(search);
        K.clearBox(listBox);
        var list = rows.filter(function (r) {
          if (tier !== 'all' && r.tier !== tier) { return false; }
          if (!query) { return true; }
          return String(r.login).toLowerCase().indexOf(query) !== -1 || (r.who && String(r.who.name).toLowerCase().indexOf(query) !== -1);
        });
        if (!list.length) { listBox.appendChild(K.note('Nobody matches.')); return; }
        list.slice(0, 60).forEach(function (r, i) {
          var t = TIER[r.tier];
          listBox.appendChild(el('div', K.withProps({ className: 'cd-kc-row' + (r.who ? '' : ' cd-kc-row--off') }, K.onActivate(function () {
            if (r.who && r.who.path) { ov.close(); go(r.who.path); }
          })), [
            el('span', { className: 'cd-kc-rank' }, String(i + 1)),
            el('div', { className: 'cd-kc-who' }, [
              el('strong', {}, r.who ? r.who.name : r.login),
              el('span', { className: 'cd-kc-tag', style: { color: t.color, backgroundColor: t.bg } }, r.who ? r.who.role : 'Other / system'),
              el('em', {}, (r.who ? r.who.districts.join(', ') + ' \u00b7 ' : '') + 'login ' + r.login + ' \u00b7 ' + (r.first || '') + ' \u2013 ' + (r.last || ''))
            ]),
            el('div', { className: 'cd-kc-bar' }, [el('div', { style: { width: Math.max(2, r.amount / top * 100) + '%', backgroundColor: t.color } })]),
            el('div', { className: 'cd-kc-amt' }, [el('strong', {}, fmt.compactCr(r.amount)), el('em', {}, fmt.number(r.txns) + ' entries \u00b7 ' + (total > 0 ? fmt.percent(r.amount / total) : '\u2014'))])
          ]));
        });
        if (list.length > 60) { listBox.appendChild(K.note('Showing the first 60 of ' + list.length + '. Use the search to find others.')); }
      }
      drawList();
      return el('div', {}, [
        tiles,
        el('div', { className: 'cd-kc-sec' }, [el('div', { className: 'cd-em-mapside-title' }, 'Share of keyed cash by role'), split, splitLegend]),
        el('div', { className: 'cd-kc-sec' }, [el('div', { className: 'cd-em-mapside-title' }, 'Logins - largest first (click a person to open their page)'), filters, listBox])
      ]);
    }, KEYED_WAIT);
    ov.setBody(el('div', { className: 'cd-kc' }, [
      el('p', { className: 'cd-text-muted cd-rp-small', style: { marginTop: 0 } }, 'Repayments not paid by UPI, POS or auto-debit are entered by a person. VO_CREDIT_INFO.CREATED_BY tells whose login entered each one; logins are matched to the manager / AGM / DGM mapping.'),
      holder
    ]));
    for (var up = holder.parentNode; up; up = up.parentNode) {
      if (String(up.className || '').indexOf('cd-lg-card') !== -1) { up.style.maxWidth = '1180px'; break; }
    }
  }

  /* profile: cash entered with this person's own login */
  function keyedForPerson(cur, data, sy) {
    if (!cur || cur.id === NONE) { return null; }
    var holder = el('div', {});
    function show() {
      K.clearBox(holder);
      holder.appendChild(K.load([keyedCall(sy)], function (rs) {
        var rows = (rs[0].body && rs[0].body.rows) || [], mine = null;
        rows.forEach(function (r) { if (String(r.login).toUpperCase() === String(cur.id).toUpperCase()) { mine = r; } });
        if (!mine) { return K.note('No cash entries were keyed with login ' + cur.id + ' in FY ' + ex.fyLabel(sy) + '.'); }
        var area = cur.fig.manual;
        return el('div', { className: 'cd-em-counts' }, [
          el('div', { className: 'cd-em-count' }, [el('strong', {}, fmt.compactCr(mine.amount)), el('span', {}, 'Cash keyed with own login'), el('em', {}, fmt.number(mine.txns) + ' entries \u00b7 ' + mine.first + ' \u2013 ' + mine.last)]),
          el('div', { className: 'cd-em-count' }, [el('strong', {}, area > 0 ? fmt.percent(Math.min(1, mine.amount / area)) : '\u2014'), el('span', {}, 'Of the cash in their area'), el('em', {}, fmt.compactCr(area) + ' collected manually in their mandals')])
        ]);
      }, KEYED_WAIT));
    }
    holder.appendChild(el('button', { type: 'button', className: 'cd-toggle-btn', onClick: show }, 'Check cash keyed with login ' + cur.id));
    return el('div', { style: { marginTop: '12px' } }, [el('div', { className: 'cd-em-mapside-title' }, 'Cash entered by this person'), holder]);
  }

  function structure(root, go, onKeyed) {
    var c = people(root);
    function tile(n, label, sub) {
      return el('div', { className: 'cd-em-count' }, [el('strong', {}, fmt.number(n)), el('span', {}, label), sub ? el('em', {}, sub) : null]);
    }
    var shared = [];
    for (var k in BOSSES) {
      if (BOSSES.hasOwnProperty(k) && BOSSES[k].length > 1) {
        var kind = k.split('|')[0], id = k.substr(kind.length + 1), first = BOSSES[k][0];
        var node = kind === 'agm' ? first.dgm.byId[id] : first.agm.byId[id];
        shared.push({ kind: kind, node: node, lines: BOSSES[k], path: kind === 'agm'
          ? [{ level: 'dgm', id: first.dgm.id }, { level: 'agm', id: id }]
          : [{ level: 'dgm', id: first.dgm.id }, { level: 'agm', id: first.agm.id }, { level: 'officer', id: id }] });
      }
    }
    var box = el('div', { className: 'cd-surface cd-rp-card cd-em-structure' }, [
      el('div', { className: 'cd-em-counts' }, [
        tile(c.dgm, 'DGMs (zones)'), tile(c.agm, 'AGMs'), tile(c.officer, 'Managers', 'incl. assistant managers'),
        tile(c.mandal, 'Mandals'), tile(c.unassigned, 'Mandals without a manager', c.unassigned ? 'see "No officer mapped"' : 'all mapped')
      ])
    ]);
    box.appendChild(el('div', { className: 'cd-em-hier-bar' }, [
      el('button', { type: 'button', className: 'cd-em-hier-btn', onClick: function () { hierarchyView(root, go, shared, 'tree'); } },
        [el('span', { className: 'cd-em-hier-ico', 'aria-hidden': 'true' }, '\u2630'), 'Detailed hierarchy view']),
      onKeyed ? el('button', { type: 'button', className: 'cd-em-hier-btn cd-em-cash-btn', onClick: onKeyed },
        [el('span', { className: 'cd-em-hier-ico', 'aria-hidden': 'true' }, '\u20b9'), 'Who keys the cash']) : null,
      shared.length ? el('button', { type: 'button', className: 'cd-em-hier-note', onClick: function () { hierarchyView(root, go, shared, 'shared'); } },
        shared.length + (shared.length === 1 ? ' person reports' : ' people report') + ' to more than one line \u203a') : null
    ]));
    return box;
  }

  /* full-screen hierarchy: DGM -> AGM -> Manager -> Mandal, and the people with more than one reporting line */
  function hierarchyView(root, go, shared, start) {
    var ov = K.overlay('#1e3a8a');
    var tab = start, query = '';
    var c = people(root);
    ov.setTitle('Organisation hierarchy', c.dgm + ' DGMs \u00b7 ' + c.agm + ' AGMs \u00b7 ' + c.officer + ' managers \u00b7 ' + c.mandal + ' mandals');
    var bodyBox = el('div', {});
    var tabsBox = el('div', { className: 'cd-ex-pills cd-hv-tabs' });
    var search = el('input', { type: 'text', className: 'cd-hv-search', placeholder: 'Find a person or mandal...' });
    search.onkeyup = function () { query = String(search.value || '').toLowerCase(); draw(); };
    function open(path) { ov.close(); go(path); }
    function band(f) { var b = BAND[bandOf(f)]; return el('i', { className: 'cd-hv-dot', style: { backgroundColor: b.color }, title: b.label }); }
    function figs(f) {
      return el('span', { className: 'cd-hv-figs' }, [
        el('span', {}, fmt.compactCr(f.repaid)),
        el('span', { className: 'cd-hv-cash' }, 'cash ' + pct(f.cashShare)),
        el('span', {}, 'target ' + pct(f.achievement))
      ]);
    }
    function matches(n) {
      if (!query) { return true; }
      var hit = false;
      (function walk(x) { if (hit) { return; } if (String(x.name).toLowerCase().indexOf(query) !== -1) { hit = true; return; } x.children.forEach(walk); })(n);
      return hit;
    }
    function tree() {
      var dgms = root.children.filter(function (d) { return d.fig.repaid > 0 || d.fig.disbursed > 0; })
        .sort(function (a, b) { return (a.id === NONE) - (b.id === NONE) || (a.name < b.name ? -1 : 1); })
        .filter(matches);
      if (!dgms.length) { return K.note('Nobody matches "' + query + '".'); }
      return el('div', { className: 'cd-hv-zones' }, dgms.map(function (d) {
        var color = zoneColor(root, d), dc = counts(d);
        var agmBox = el('div', { className: 'cd-hv-agms' });
        d.children.filter(matches).forEach(function (a) {
          var ac = counts(a);
          var mgrBox = el('div', { className: 'cd-hv-mgrs' + (query ? ' cd-hv-open' : '') });
          a.children.filter(matches).forEach(function (o) {
            var multi = (BOSSES['officer|' + o.id] || []).length > 1;
            var mandals = o.children.map(function (m) {
              return el('span', K.withProps({ className: 'cd-hv-mandal', style: { borderColor: BAND[bandOf(m.fig)].color } },
                K.onActivate(function () { ov.close(); CeoDash.core.router.goToChapter('repayment-journey', [{ level: 'region', id: m.office.regionId }, { level: 'office', id: m.office.id }]); })),
                m.name);
            });
            mgrBox.appendChild(el('div', { className: 'cd-hv-mgr' }, [
              el('div', K.withProps({ className: 'cd-hv-row cd-hv-row--mgr' }, K.onActivate(function () {
                open([{ level: 'dgm', id: d.id }, { level: 'agm', id: a.id }, { level: 'officer', id: o.id }]);
              })), [
                band(o.fig),
                el('strong', {}, o.name),
                el('span', { className: 'cd-hv-role' }, o.role + (multi ? ' \u00b7 also under another AGM' : '')),
                figs(o.fig)
              ]),
              el('div', { className: 'cd-hv-mandals' }, mandals)
            ]));
          });
          var head = el('div', { className: 'cd-hv-row cd-hv-row--agm' }, [
            el('span', { className: 'cd-hv-caret' }, query ? '\u25be' : '\u25b8'),
            band(a.fig),
            el('strong', {}, a.name),
            el('span', { className: 'cd-hv-role' }, 'AGM \u00b7 ' + ac.officer + ' managers \u00b7 ' + ac.mandal + ' mandals \u00b7 ' + a.districts.join(', ')),
            figs(a.fig),
            el('button', { type: 'button', className: 'cd-hv-open-btn', onClick: function (e) { if (e && e.stopPropagation) { e.stopPropagation(); } open([{ level: 'dgm', id: d.id }, { level: 'agm', id: a.id }]); } }, 'Open \u203a')
          ]);
          head.onclick = function () {
            var on = mgrBox.className.indexOf('cd-hv-open') === -1;
            mgrBox.className = 'cd-hv-mgrs' + (on ? ' cd-hv-open' : '');
            head.firstChild.textContent = on ? '\u25be' : '\u25b8';
          };
          agmBox.appendChild(el('div', { className: 'cd-hv-agm' }, [head, mgrBox]));
        });
        return el('div', { className: 'cd-hv-zone', style: { borderTopColor: color } }, [
          el('div', K.withProps({ className: 'cd-hv-zone-head', style: { backgroundColor: color } }, K.onActivate(function () { open([{ level: 'dgm', id: d.id }]); })), [
            el('strong', {}, d.name),
            el('span', {}, (d.id === NONE ? '' : 'DGM \u00b7 ') + dc.agm + ' AGMs \u00b7 ' + dc.officer + ' managers \u00b7 ' + dc.mandal + ' mandals'),
            el('span', { className: 'cd-hv-zone-figs' }, fmt.compactCr(d.fig.repaid) + ' collected \u00b7 cash ' + pct(d.fig.cashShare) + ' \u00b7 target ' + pct(d.fig.achievement))
          ]),
          agmBox
        ]);
      }));
    }
    function sharedList() {
      var list = shared.filter(function (x) { return !query || String(x.node ? x.node.name : '').toLowerCase().indexOf(query) !== -1; });
      if (!list.length) { return K.note(shared.length ? 'Nobody matches "' + query + '".' : 'Everyone reports to a single line.'); }
      return el('div', { className: 'cd-hv-shared' }, list.map(function (x) {
        return el('div', K.withProps({ className: 'cd-hv-card' }, K.onActivate(function () { open(x.path); })), [
          el('div', { className: 'cd-hv-card-head' }, [
            x.node ? band(x.node.fig) : null,
            el('strong', {}, x.node ? x.node.name : x.kind),
            el('span', { className: 'cd-hv-role' }, x.kind === 'agm' ? 'AGM' : (x.node ? x.node.role : 'Manager'))
          ]),
          el('div', { className: 'cd-hv-lines' }, x.lines.map(function (b, i) {
            var col = zoneColor(root, b.dgm);
            return el('div', { className: 'cd-hv-line' }, [
              el('span', { className: 'cd-hv-line-no' }, 'Line ' + (i + 1)),
              b.agm ? el('span', { className: 'cd-hv-chip', style: { borderColor: col, color: col } }, 'AGM ' + b.agm.name) : null,
              b.agm ? el('span', { className: 'cd-hv-arrow' }, '\u2192') : null,
              el('span', { className: 'cd-hv-chip cd-hv-chip--dgm', style: { backgroundColor: col } }, 'DGM ' + b.dgm.name)
            ]);
          })),
          x.node ? el('div', { className: 'cd-hv-card-figs' }, [figs(x.node.fig)]) : null
        ]);
      }));
    }
    function draw() {
      K.clearBox(tabsBox);
      [['tree', 'Hierarchy'], ['shared', 'Shared reporting (' + shared.length + ')']].filter(function (t) { return t[0] === 'tree' || shared.length; }).forEach(function (t) {
        tabsBox.appendChild(el('button', { type: 'button', className: 'cd-toggle-btn' + (tab === t[0] ? ' cd-ex-on' : ''),
          onClick: function () { tab = t[0]; draw(); } }, t[1]));
      });
      K.clearBox(bodyBox);
      bodyBox.appendChild(tab === 'tree' ? tree() : sharedList());
    }
    draw();
    var view = el('div', { className: 'cd-hv' }, [
      el('div', { className: 'cd-hv-bar' }, [tabsBox, search,
        el('div', { className: 'cd-hv-legend' }, ['healthy', 'watch', 'attention', 'critical'].map(function (k) {
          return el('span', {}, [el('i', { className: 'cd-hv-dot', style: { backgroundColor: BAND[k].color } }), BAND[k].label]);
        }).concat([el('span', { className: 'cd-hv-legend-note' }, 'band = cash share against the state')]))
      ]),
      bodyBox
    ]);
    ov.setBody(view);
    for (var up = view.parentNode; up; up = up.parentNode) {
      if (String(up.className || '').indexOf('cd-lg-card') !== -1) { up.style.maxWidth = '1280px'; break; }
    }
  }

  var ZONE_COLORS = ['#2563eb', '#0d9488', '#9333ea', '#e11d48', '#ea580c', '#65a30d', '#0891b2', '#a16207', '#4f46e5', '#be185d'];
  var MAP_MODES = [
    { id: 'zone', label: 'Zones (DGM)' }, { id: 'cash', label: 'Cash share' },
    { id: 'achievement', label: 'Disbursed vs target' }, { id: 'collected', label: 'Collected' }
  ];
  var MAP_MODE = 'zone';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function mix(a, b, t) {
    function c(h, i) { return parseInt(h.substr(i, 2), 16); }
    t = Math.max(0, Math.min(1, t));
    return 'rgb(' + Math.round(c(a, 1) + (c(b, 1) - c(a, 1)) * t) + ',' + Math.round(c(a, 3) + (c(b, 3) - c(a, 3)) * t) + ',' +
           Math.round(c(a, 5) + (c(b, 5) - c(a, 5)) * t) + ')';
  }
  function heat(t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? mix('#15803d', '#facc15', t * 2) : mix('#facc15', '#dc2626', (t - 0.5) * 2); }
  function mostOf(counts) {
    var best = null;
    for (var k in counts) { if (counts.hasOwnProperty(k) && (best === null || counts[k] > counts[best])) { best = k; } }
    return best;
  }

  function districtIndex(root, data) {
    var byId = {}, list = [];
    root.children.forEach(function (d) {
      d.children.forEach(function (a) {
        a.children.forEach(function (o) {
          o.children.forEach(function (m) {
            var slug = m.office.regionId, e = byId[slug];
            if (!e) {
              e = byId[slug] = { slug: slug, name: (data.byId[slug] || {}).name || slug, fig: blankFig(), zones: {}, agms: {} };
              list.push(e);
            }
            addAll(e.fig, m.fig);
            e.zones[d.id] = (e.zones[d.id] || 0) + 1;
            e.agms[d.id + '|' + a.id] = (e.agms[d.id + '|' + a.id] || 0) + 1;
          });
        });
      });
    });
    list.forEach(function (e) {
      finish(e.fig);
      e.dgm = root.byId[mostOf(e.zones)];
      var k = mostOf(e.agms).split('|');
      e.agm = root.byId[k[0]].byId[k[1]];
    });
    return { byId: byId, list: list };
  }
  function zoneColor(root, dgm) {
    if (!dgm || dgm.id === NONE) { return '#94a3b8'; }
    var named = root.children.filter(function (d) { return d.id !== NONE; })
                    .sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    for (var i = 0; i < named.length; i++) { if (named[i] === dgm) { return ZONE_COLORS[i % ZONE_COLORS.length]; } }
    return '#94a3b8';
  }
  function districtFill(root, e, maxRepaid) {
    var f = e ? e.fig : null;
    if (!f) { return '#e2e8f0'; }
    if (MAP_MODE === 'zone') { return zoneColor(root, e.dgm); }
    if (MAP_MODE === 'cash') {
      var r = cashRatio(f);
      return fmt.missing(r) ? '#e2e8f0' : heat((r - 0.5) / 1.5);
    }
    if (MAP_MODE === 'achievement') {
      return fmt.missing(f.achievement) || !(REF.ach > 0) ? '#e2e8f0' : heat((1.5 - f.achievement / REF.ach) / 1);
    }
    return maxRepaid > 0 ? mix('#dbeafe', '#1e3a8a', f.repaid / maxRepaid) : '#e2e8f0';
  }

  function zoneMap(root, chain, data, go) {
    var cur = chain[chain.length - 1];
    var di = districtIndex(root, data);
    var maxRepaid = 0;
    di.list.forEach(function (e) { if (e.fig.repaid > maxRepaid) { maxRepaid = e.fig.repaid; } });
    var focus = cur.kind === 'state' ? null : cur.districts;

    var mapBox = el('div', { className: 'cd-em-map' });
    mapBox.innerHTML = global.__AP_SVG_HTML || '';
    var svg = mapBox.querySelector('svg');
    if (svg) { svg.removeAttribute('id'); svg.setAttribute('class', 'cd-em-svg'); }
    var info = el('div', { className: 'cd-em-mapinfo' });
    var side = el('div', { className: 'cd-em-mapside' });
    var pills = el('div', { className: 'cd-ex-pills' });

    function line(k, v) { return el('div', { className: 'cd-em-mapinfo-row' }, [el('span', {}, k), el('strong', {}, v)]); }
    function showInfo(e) {
      K.clearBox(info);
      if (!e) {
        info.appendChild(el('div', { className: 'cd-em-mapinfo-hint' }, 'Point at a district to see who owns it; click to open its AGM.'));
        return;
      }
      var f = e.fig;
      info.appendChild(el('div', { className: 'cd-em-mapinfo-title' }, e.name));
      info.appendChild(line('DGM (zone)', e.dgm ? e.dgm.name : '—'));
      info.appendChild(line('AGM', e.agm ? e.agm.name : '—'));
      info.appendChild(line('Collected', fmt.compactCr(f.repaid)));
      info.appendChild(line('Cash / manual', pct(f.cashShare) + (ratioText(f) ? ' · ' + ratioText(f) : '')));
      info.appendChild(line('Disbursed vs target', pct(f.achievement)));
    }

    function legend() {
      K.clearBox(side);
      if (MAP_MODE === 'zone') {
        side.appendChild(el('div', { className: 'cd-em-mapside-title' }, 'Zones - click a row to open the DGM'));
        var zrows = root.children.filter(function (d) { return d.fig.repaid > 0 || d.fig.disbursed > 0; })
          .sort(function (a, b) { return (a.id === NONE) - (b.id === NONE) || (a.name < b.name ? -1 : 1); })
          .filter(function (d) { return d.id !== NONE || di.list.some(function (e) { return e.dgm === d; }); })
          .map(function (d) {
            var mine = di.list.filter(function (e) { return e.dgm === d; });
            var c = counts(d), b = BAND[bandOf(d.fig)];
            return el('tr', K.withProps({ className: 'cd-em-ztr' + (cur.kind !== 'state' && chain[1] === d ? ' cd-em-zone--on' : '') },
              K.onActivate(function () { go([{ level: 'dgm', id: d.id }]); })), [
              el('td', {}, [el('i', { className: 'cd-em-zsw', style: { backgroundColor: zoneColor(root, d) } }),
                            el('strong', {}, d.name),
                            el('span', { className: 'cd-em-zsub' }, mine.map(function (e) { return e.name; }).join(', '))]),
              el('td', { className: 'cd-num' }, c.agm + ' / ' + c.officer + ' / ' + c.mandal),
              el('td', { className: 'cd-num' }, fmt.compactCr(d.fig.repaid)),
              el('td', { className: 'cd-num', style: { color: b.color } }, pct(d.fig.cashShare) + (ratioText(d.fig) ? ' (' + ratioText(d.fig).replace(' state cash', '') + ')' : '')),
              el('td', { className: 'cd-num' }, pct(d.fig.achievement))
            ]);
          });
        side.appendChild(el('div', { className: 'cd-ex-table-wrap' }, [el('table', { className: 'cd-em-ztable' }, [
          el('thead', {}, [el('tr', {}, ['Zone (DGM) and districts', 'AGMs / Mgrs / Mandals', 'Collected', 'Cash share', 'Target'].map(function (h) { return el('th', {}, h); }))]),
          el('tbody', {}, zrows)
        ])]));
        return;
      }
      var scale = MAP_MODE === 'cash' ? ['≤ 0.5× state', 'state level', '≥ 2× state']
                : MAP_MODE === 'achievement' ? ['≥ 1.5× state', 'state level', '≤ 0.5× state'] : ['low', '', 'high'];
      side.appendChild(el('div', { className: 'cd-em-mapside-title' }, MAP_MODES.filter(function (m) { return m.id === MAP_MODE; })[0].label));
      side.appendChild(el('div', { className: 'cd-em-scale' + (MAP_MODE === 'collected' ? ' cd-em-scale--blue' : '') }));
      side.appendChild(el('div', { className: 'cd-em-scale-labels' }, scale.map(function (s) { return el('span', {}, s); })));
      var val = MAP_MODE === 'cash' ? function (e) { return fmt.missing(e.fig.cashShare) ? -1 : e.fig.cashShare; }
              : MAP_MODE === 'achievement' ? function (e) { return fmt.missing(e.fig.achievement) ? 9 : -e.fig.achievement; }
              : function (e) { return -e.fig.repaid; };
      var worst = di.list.slice().sort(function (a, b) { return val(b) - val(a); }).slice(0, 6);
      side.appendChild(el('div', { className: 'cd-em-mapside-title' }, MAP_MODE === 'collected' ? 'Smallest collections' : 'Needs attention'));
      worst.forEach(function (e) {
        var v = MAP_MODE === 'cash' ? pct(e.fig.cashShare) + ' cash' : MAP_MODE === 'achievement' ? pct(e.fig.achievement) + ' of target' : fmt.compactCr(e.fig.repaid);
        side.appendChild(el('div', K.withProps({ className: 'cd-em-zone' }, K.onActivate(function () { open(e); })), [
          el('i', { style: { backgroundColor: districtFill(root, e, maxRepaid) } }),
          el('div', {}, [el('strong', {}, e.name), el('span', {}, v + ' · AGM ' + (e.agm ? e.agm.name : '—'))])
        ]));
      });
    }

    function open(e) {
      if (e && e.dgm && e.agm) { go([{ level: 'dgm', id: e.dgm.id }, { level: 'agm', id: e.agm.id }]); }
    }

    function paint() {
      var paths = mapBox.querySelectorAll('path.dp');
      for (var i = 0; i < paths.length; i++) {
        var p = paths[i], e = di.byId[p.getAttribute('data-id')];
        p.setAttribute('fill', districtFill(root, e, maxRepaid));
        p.style.opacity = !focus || (e && focus.indexOf(e.name) !== -1) ? '1' : '0.25';
      }
      K.clearBox(pills);
      MAP_MODES.forEach(function (m) {
        pills.appendChild(el('button', { type: 'button', className: 'cd-toggle-btn' + (MAP_MODE === m.id ? ' cd-ex-on' : ''),
          onClick: function () { MAP_MODE = m.id; paint(); } }, m.label));
      });
      legend();
    }

    var paths = mapBox.querySelectorAll('path.dp');
    for (var i = 0; i < paths.length; i++) {
      (function (p) {
        var e = di.byId[p.getAttribute('data-id')];
        p.addEventListener('mouseover', function () { showInfo(e); });
        p.addEventListener('mouseout', function () { showInfo(null); });
        p.addEventListener('click', function () { open(e); });
      })(paths[i]);
    }
    paint();
    showInfo(null);

    return el('div', { className: 'cd-surface cd-rp-card cd-em-mapcard' }, [
      el('div', { className: 'cd-loan-section-head' }, [
        el('div', {}, [
          el('h3', { className: 'cd-rp-h3' }, cur.kind === 'state' ? 'Andhra Pradesh - zones and districts' : cur.name + ' - where they work'),
          el('p', { className: 'cd-text-muted cd-rp-small' }, 'Each district is coloured by the zone (DGM) that owns most of its mandals, or by the chosen measure. Click a district to open its AGM.')
        ]),
        pills
      ]),
      el('div', { className: 'cd-em-mapwrap' }, [el('div', { className: 'cd-em-mapleft' }, [mapBox, info]), side])
    ]);
  }

  function monthLabel(m) { return MON[+m.substr(5, 2) - 1] + ' ' + m.substr(2, 2); }

  function trendChart(months) {
    var ms = months.slice().sort(function (a, b) { return a.month < b.month ? -1 : a.month > b.month ? 1 : 0; });
    while (ms.length && !(ms[0].repaid > 0)) { ms.shift(); }
    if (!ms.length) { return K.note('No collections recorded in the last 24 months.'); }
    var share = ms.map(function (m) { var on = (m.upiAmount || 0) + (m.posAmount || 0) + (m.autoAmount || 0); return m.repaid > 0 ? on / m.repaid : NaN; });
    var maxR = 0, minS = 1;
    ms.forEach(function (m, i) { if (m.repaid > maxR) { maxR = m.repaid; } if (!fmt.missing(share[i]) && share[i] < minS) { minS = share[i]; } });
    var sLo = Math.max(0, Math.floor(minS * 20 - 1) / 20), sHi = 1;
    var W = 760, H = 230, L = 44, R = 54, T = 14, B = 30, iw = W - L - R, ih = H - T - B, bw = iw / ms.length;
    function ys(s) { return T + (1 - (s - sLo) / (sHi - sLo)) * ih; }
    var h = ['<svg viewBox="0 0 ' + W + ' ' + H + '" class="cd-em-trend-svg" preserveAspectRatio="xMidYMid meet">'];
    [sLo, (sLo + sHi) / 2, sHi].forEach(function (s) {
      h.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + ys(s) + '" y2="' + ys(s) + '" stroke="#e2e8f0"/>');
      h.push('<text x="' + (L - 6) + '" y="' + (ys(s) + 4) + '" text-anchor="end" class="cd-em-ax">' + Math.round(s * 100) + '%</text>');
    });
    h.push('<text x="' + (W - R + 6) + '" y="' + (T + 8) + '" class="cd-em-ax">' + fmt.compactCr(maxR) + '</text>');
    ms.forEach(function (m, i) {
      var bh = maxR > 0 ? m.repaid / maxR * ih : 0, x = L + i * bw;
      var last = i === ms.length - 1;
      h.push('<rect x="' + (x + bw * 0.18) + '" y="' + (T + ih - bh) + '" width="' + (bw * 0.64) + '" height="' + bh + '" fill="' + (last ? '#cbd5e1' : '#bfdbfe') + '">' +
             '<title>' + monthLabel(m.month) + (last ? ' (to date)' : '') + ': ' + fmt.compactCr(m.repaid) + ' collected, ' + pct(share[i]) + ' online</title></rect>');
      if (i % 3 === 0 || last) { h.push('<text x="' + (x + bw / 2) + '" y="' + (H - 10) + '" text-anchor="middle" class="cd-em-ax">' + monthLabel(m.month) + '</text>'); }
    });
    var pts = [];
    ms.forEach(function (m, i) { if (!fmt.missing(share[i])) { pts.push((L + i * bw + bw / 2) + ',' + ys(share[i])); } });
    h.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="#15803d" stroke-width="2.5"/>');
    pts.forEach(function (p) { var xy = p.split(','); h.push('<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="2.8" fill="#15803d"/>'); });
    h.push('</svg>');
    var box = el('div', { className: 'cd-em-trend' });
    box.innerHTML = h.join('');
    var n = ms.length - 2;
    function at(k) { return k >= 0 && k < share.length ? share[k] : NaN; }
    function delta(a, b) { return fmt.missing(a) || fmt.missing(b) ? '—' : ((a - b) >= 0 ? '+' : '') + (Math.round((a - b) * 1000) / 10) + ' pts'; }
    var facts = n >= 0 ? el('div', { className: 'cd-em-trend-facts' }, [
      el('div', {}, [el('span', {}, 'Online, ' + monthLabel(ms[n].month)), el('strong', {}, pct(at(n)))]),
      el('div', {}, [el('span', {}, 'vs 3 months before'), el('strong', {}, delta(at(n), at(n - 3)))]),
      el('div', {}, [el('span', {}, 'vs 12 months before'), el('strong', {}, delta(at(n), at(n - 12)))])
    ]) : null;
    return el('div', {}, [
      facts, box,
      el('div', { className: 'cd-em-legend' }, [
        el('span', {}, [el('i', { style: { backgroundColor: '#bfdbfe' } }), 'Collected per month']),
        el('span', {}, [el('i', { style: { backgroundColor: '#15803d' } }), 'Share paid online']),
        el('span', {}, [el('i', { style: { backgroundColor: '#cbd5e1' } }), 'Current month (to date)'])
      ])
    ]);
  }

  function mandalKeys(n) {
    var keys = [];
    (function walk(x) { if (x.kind === 'mandal') { keys.push(x.office.districtId + '|' + x.office.mandalId); } else { x.children.forEach(walk); } })(n);
    return keys;
  }

  function trendPanel(n, payOn) {
    if (!payOn) { return null; }
    var params = { action: 'trend' };
    if (n.kind !== 'state') { params.mandals = mandalKeys(n).join(','); }
    return el('div', { className: 'cd-surface cd-rp-card' }, [
      el('h3', { className: 'cd-rp-h3' }, n.kind === 'state' ? 'Online adoption - last 24 months' : 'Trend - last 24 months'),
      el('p', { className: 'cd-text-muted cd-rp-small' }, 'Bars: amount collected each month. Line: share of it paid online (UPI, POS, auto-debit).'),
      K.load([params], function (rs) { return trendChart((rs[0].body && rs[0].body.months) || []); }, 'Loading trend...')
    ]);
  }

  function peersOf(root, kind) {
    var out = [];
    (function walk(x) {
      if (x.kind === kind) { if (x.id !== NONE && x.fig.repaid > 0) { out.push(x); } return; }
      x.children.forEach(walk);
    })(root);
    return out;
  }
  function rankIn(list, n, val, lowerBetter) {
    var v = val(n);
    if (fmt.missing(v)) { return null; }
    var r = 1;
    list.forEach(function (x) {
      var w = val(x);
      if (x !== n && !fmt.missing(w) && (lowerBetter ? w < v : w > v)) { r++; }
    });
    return r;
  }

  function profilePanel(cur, chain, root, payOn, data) {
    var f = cur.fig, peers = peersOf(root, cur.kind), N = peers.length;
    var st = root.fig;
    var c = counts(cur);
    var emp = null;
    (data.employeesReal || []).forEach(function (e) { if (e.userId === cur.id && e.empCode) { emp = e.empCode; } });
    var reports = chain.slice(1, -1).map(function (x) { return TITLE[x.kind][0] + ' ' + x.name; });
    var lines = (BOSSES[cur.kind + '|' + cur.id] || []).map(function (b) {
      return (b.agm ? 'AGM ' + b.agm.name + ' · ' : '') + 'DGM ' + b.dgm.name;
    });
    var roleName = cur.kind === 'officer' ? cur.role : TITLE[cur.kind][0];
    var area = (cur.kind === 'dgm' ? c.agm + ' AGMs · ' : '') + (cur.kind !== 'officer' ? c.officer + ' managers · ' : '') +
               c.mandal + ' mandals · ' + cur.districts.join(', ');
    function tile(label, value, sub, color) {
      return el('div', { className: 'cd-em-score-tile' }, [el('span', {}, label), el('strong', { style: color ? { color: color } : null }, value), el('em', {}, sub)]);
    }
    function rk(val, lower) { var r = rankIn(peers, cur, val, lower); return r ? '#' + r + ' of ' + N + ' ' + TITLE[cur.kind][1].replace(' (zones)', '') : ''; }
    function pts(a, b) { return fmt.missing(a) || fmt.missing(b) ? '' : ((a - b) >= 0 ? '+' : '') + (Math.round((a - b) * 1000) / 10) + ' pts vs state'; }
    var b = BAND[payOn ? bandOf(f) : 'no-data'];
    var tiles = [];
    if (payOn) {
      tiles.push(tile('Paid online', pct(f.onlineShare), rk(function (x) { return x.fig.onlineShare; }) + ' · ' + pts(f.onlineShare, st.onlineShare), b.color));
      tiles.push(tile('Cash / manual', fmt.compactCr(f.manual), pct(f.cashShare) + (ratioText(f) ? ' · ' + ratioText(f) : ''), '#b45309'));
    }
    tiles.push(tile('Disbursed vs target', pct(f.achievement), rk(function (x) { return x.fig.achievement; }) + ' · ' + pts(f.achievement, st.achievement)));
    tiles.push(tile('Collected', fmt.compactCr(f.repaid), rk(function (x) { return x.fig.repaid; }) + ' · ' + pct(st.repaid > 0 ? f.repaid / st.repaid : NaN) + ' of state'));

    var mandals = [];
    (function walk(x) { if (x.kind === 'mandal') { mandals.push(x); } else { x.children.forEach(walk); } })(cur);
    var hot = payOn ? mandals.filter(function (m) { return m.fig.manual > 0; }).sort(function (a, z) { return z.fig.manual - a.fig.manual; }).slice(0, 6) : [];

    var keyed = payOn ? keyedForPerson(cur, data, Number(ex.getCtx(data).fy)) : null;
    return el('div', { className: 'cd-surface cd-rp-card cd-em-profile' }, [
      el('div', { className: 'cd-em-prof-head' }, [
        el('div', { className: 'cd-em-avatar cd-em-avatar--lg', style: { backgroundColor: b.color } }, initials(cur.name)),
        el('div', { className: 'cd-em-who' }, [
          el('div', { className: 'cd-em-prof-name' }, cur.name),
          el('div', { className: 'cd-em-sub' }, roleName + (emp ? ' · Emp code ' + emp : '') + (cur.id !== NONE ? ' · Login ' + cur.id : '')),
          lines.length > 1 ? el('div', { className: 'cd-em-sub cd-em-multi' }, 'Reports to ' + lines.length + ' lines: ' + lines.join('  |  '))
            : reports.length ? el('div', { className: 'cd-em-sub' }, 'Reports to ' + reports.reverse().join(' · ')) : null,
          el('div', { className: 'cd-em-sub' }, area)
        ]),
        payOn ? el('span', { className: 'cd-em-pill cd-em-pill--lg', style: { color: b.color, backgroundColor: b.bg } }, b.label) : null
      ]),
      el('div', { className: 'cd-em-score-grid' }, tiles),
      keyed,
      hot.length ? el('div', {}, [
        el('div', { className: 'cd-em-mapside-title' }, 'Where the cash is - mandals with the most manual collections'),
        el('div', { className: 'cd-em-hot' }, hot.map(function (m) {
          return el('div', K.withProps({ className: 'cd-em-hot-row' }, K.onActivate(function () {
            CeoDash.core.router.goToChapter('repayment-journey', [{ level: 'region', id: m.office.regionId }, { level: 'office', id: m.office.id }]);
          })), [
            el('strong', {}, m.name),
            el('span', {}, m.role),
            el('span', { className: 'cd-num' }, fmt.compactCr(m.fig.manual) + ' cash'),
            el('span', { className: 'cd-num', style: { color: BAND[bandOf(m.fig)].color } }, pct(m.fig.cashShare))
          ]);
        }))
      ]) : null
    ]);
  }

  function header(sy, chain, data) {
    var ctx = ex.getCtx(data);
    var fySel = el('select', { className: 'cd-loan-filter-select', 'aria-label': 'Financial year',
      onChange: function (e) { ex.setCtx({ exFy: +e.target.value, exPeriod: 'fy', exValue: null }); } },
      ctx.fys.map(function (y) { return el('option', { value: String(y), selected: y === sy ? 'selected' : undefined }, 'FY ' + ex.fyLabel(y)); }));
    fySel.value = String(sy);
    var names = chain.map(function (n) { return n.kind === 'state' ? 'Andhra Pradesh' : n.name; });
    return el('div', { className: 'cd-loan-header-bar' }, [
      el('div', { className: 'cd-loan-header-info' }, [
        el('h1', { className: 'cd-loan-page-title' }, 'Employee Performance'),
        el('p', { className: 'cd-loan-page-desc' }, names.join(' › ') + ' - FY ' + ex.fyLabel(sy)),
        el('p', { className: 'cd-loan-page-subdesc' }, 'DGM → AGM → Manager → Mandal. Ranked by the share of collections paid online; cash concentration is shown for every person.')
      ]),
      el('div', { className: 'cd-lg-period-pick' }, [
        el('div', { className: 'cd-loan-filter-field cd-lg-fy' }, [el('label', { className: 'cd-loan-filter-label' }, 'Financial year'), fySel]),
        el('div', { className: 'cd-loan-filter-field cd-lg-fy cd-xls-field' }, [el('label', { className: 'cd-loan-filter-label' }, '\u00a0'),
          ex.excelButton(function () {
            ex.download({ kind: 'employee', from: sy + '-04-01', to: (sy + 1) + '-04-01', label: 'FY ' + ex.fyLabel(sy) + ' \u00b7 all mandals with their manager, AGM and DGM' });
          })])
      ])
    ]);
  }

  function crumbs(chain, go) {
    if (chain.length < 2) { return null; }
    return el('div', { className: 'cd-lg-filters cd-surface' }, [
      el('div', { className: 'cd-lg-chips' }, [el('span', { className: 'cd-ex-chain-k' }, 'Showing:')].concat(chain.slice(1).map(function (n, i) {
        return el('button', { type: 'button', className: 'cd-lg-chip', title: 'Go back to ' + (i ? chain[i].name : 'all DGMs'),
                               onClick: function () { go(pathOf(chain.slice(0, i + 1))); } },
          [TITLE[n.kind][0] + ': ' + n.name, el('span', { className: 'cd-lg-chip-x', 'aria-hidden': 'true' }, '✕')]);
      })))
    ]);
  }

  function render(container, appState, data) {
    var ctx = ex.getCtx(data), sy = ctx.fy;
    var rng = { from: sy + '-04-01', to: (sy + 1) + '-04-01' };
    var path = appState.drillPath || [];
    function go(p) { CeoDash.core.router.goToChapter('performance-map', p); }

    var body = K.load([{ action: 'drill', group: 'MANDAL', from: rng.from, to: rng.to }], function (rs) {
      var rows = K.rowsOf(rs[0]) || [];
      var payOn = rs[0].body.payModes !== false;
      var byKey = {};
      rows.forEach(function (r) { byKey[r.districtId + '|' + r.id] = r; });
      var root = buildTree(data, function (o) { return byKey[o.districtId + '|' + o.mandalId]; });
      REF.cash = root.fig.cashShare; REF.ach = root.fig.achievement;
      BOSSES = bossIndex(root);
      var chain = resolve(root, path);
      var cur = chain[chain.length - 1];
      var kids = cur.children.filter(function (k) {
        return !(k.id === NONE && !(k.fig.repaid > 0) && !(k.fig.disbursed > 0));
      }).sort(function (a, b) {
        var na = a.id === NONE ? 1 : 0, nb = b.id === NONE ? 1 : 0;
        return na !== nb ? na - nb : sortValue(b) - sortValue(a);
      });
      var childKind = CHILD_OF[cur.kind];
      var sorts = el('div', { className: 'cd-ex-pills' }, SORTS.filter(function (s) { return (payOn || (s.id !== 'online' && s.id !== 'cash')) && (s.id !== 'overdue' || CeoDash.data.OD_READY === true); }).map(function (s) {
        return el('button', { type: 'button', className: 'cd-toggle-btn' + (SORT === s.id ? ' cd-ex-on' : ''),
                              onClick: function () { SORT = s.id; CeoDash.core.state.set({}); } }, s.label);
      }));
      var grid = childKind === 'mandal' ? el('div', { className: 'cd-cv-card' }, [mandalRows(kids, payOn)]) : el('div', { className: 'cd-em-grid' }, kids.map(function (k) {
        return personCard(k, payOn, function () {
          if (k.kind === 'mandal') {
            CeoDash.core.router.goToChapter('repayment-journey', [{ level: 'region', id: k.office.regionId }, { level: 'office', id: k.office.id }]);
          } else { go(pathOf(chain).concat([{ level: k.kind, id: k.id }])); }
        });
      }));
      var isState = cur.kind === 'state';
      return el('div', {}, [
        crumbs(chain, go),
        isState ? structure(root, go, payOn ? function () { keyedView(root, data, sy, go); } : null) : null,
        isState ? kpiCards(cur, sy, payOn) : profilePanel(cur, chain, root, payOn, data),

        isState || cur.kind === 'dgm' ? zoneMap(root, chain, data, go) : null,
        isState ? null : el('div', { className: 'cd-em-trend-row' }, [trendPanel(cur, payOn)]),
        el('div', { className: 'cd-loan-section' }, [
          el('div', { className: 'cd-loan-section-head' }, [
            el('div', {}, [
              el('h2', {}, (cur.kind === 'state' ? '' : cur.name + ' - ') + TITLE[childKind][1]),
              el('p', { className: 'cd-text-muted' }, kids.length + ' ' + TITLE[childKind][1].toLowerCase() + ' · click ' + (childKind === 'mandal' ? 'a row' : 'a card') + ' to open ' +
                (childKind === 'mandal' ? 'its collections' : 'the people under it'))
            ]),
            sorts
          ]),
          kids.length ? grid : K.note('Nobody is mapped here.')
        ]),
        cur.kind === 'state' ? leagues(root, payOn, go) : null
      ]);
    }, 'Loading employee performance...');

    container.appendChild(el('section', { className: 'cd-chapter cd-chapter--performance-map cd-chapter--lg' }, [
      header(sy, resolve(bootTree(data), path), data), body
    ]));
  }

  ex.chapters['performance-map'] = render;
  CeoDash.employees = { pathForOffice: pathForOffice, pathForDistrict: pathForDistrict, open: openFor, bootTree: bootTree, NONE: NONE,
                        tree: buildTree, zoneColor: zoneColor };
  CeoDash.data.findResponsibleAgm = function (slug, data) {
    var r = data.byId[slug];
    if (!r) { return null; }
    var o = r.officeIds && r.officeIds.length ? data.byId[r.officeIds[0]] : null;
    var of = (o && o.officer) || {};
    return { agm: ex.districtAgm(data, r), zoneName: of.dgmName || 'DGM not mapped', districtName: r.name, path: pathForDistrict(data, slug) };
  };
  CeoDash.data.findResponsibleManager = function (officeId, data) {
    var o = data.byId[officeId];
    if (!o || !o.officer || !o.officer.userId) { return null; }
    return { manager: o.officer.name, district: { id: o.regionId }, zoneName: o.officer.dgmName || 'DGM not mapped', path: pathForOffice(data, officeId) };
  };
})(window);

