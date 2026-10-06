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
