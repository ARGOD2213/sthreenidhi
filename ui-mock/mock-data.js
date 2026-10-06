/* =====================================================================================
   FAKE DATA for the dashboard preview. Everything here is made up. ES5 only (runs in Chrome, Edge, IE11 and Node).
   Used by:  ui-mock/index.html (opens straight from the folder, no server)   and   devtools/mock/server.js (Node).
   Never part of the deployed application.
   ===================================================================================== */
(function (root) {
  'use strict';

  var DEFAULT_DISTRICTS = [
    { slug: 'srikakulam', name: 'Srikakulam' },
    { slug: 'parvathipuram-manyam', name: 'Parvathipuram Manyam' },
    { slug: 'vizianagaram', name: 'Vizianagaram' },
    { slug: 'visakhapatnam', name: 'Visakhapatnam' },
    { slug: 'alluri-sitharama-raju', name: 'Alluri Sitharama Raju' },
    { slug: 'polavaram', name: 'Polavaram' },
    { slug: 'anakapalli', name: 'Anakapalli' },
    { slug: 'kakinada', name: 'Kakinada' },
    { slug: 'east-godavari', name: 'East Godavari' },
    { slug: 'konaseema', name: 'Konaseema' },
    { slug: 'eluru', name: 'Eluru' },
    { slug: 'west-godavari', name: 'West Godavari' },
    { slug: 'ntr', name: 'NTR' },
    { slug: 'krishna', name: 'Krishna' },
    { slug: 'guntur', name: 'Guntur' },
    { slug: 'palnadu', name: 'Palnadu' },
    { slug: 'bapatla', name: 'Bapatla' },
    { slug: 'prakasam', name: 'Prakasam' },
    { slug: 'markapuram', name: 'Markapuram' },
    { slug: 'sri-potti-sriramulu-nellore', name: 'SPSR Nellore' },
    { slug: 'kurnool', name: 'Kurnool' },
    { slug: 'nandyal', name: 'Nandyal' },
    { slug: 'anantapur', name: 'Ananthapuramu' },
    { slug: 'sri-sathya-sai', name: 'Sri Sathya Sai' },
    { slug: 'ysr-kadapa', name: 'YSR Kadapa' },
    { slug: 'annamayya', name: 'Annamayya' },
    { slug: 'tirupati', name: 'Tirupati' },
    { slug: 'chittoor', name: 'Chittoor' }
  ];

  var SCENARIOS = {
    normal:        'Everything present (default)',
    nooverdue:     'Data from the previous release: no overdue fields at all',
    overduefailed: 'The overdue query failed: overdueReady = 0, all overdue values 0',
    empty:         'No districts in the data',
    notready:      'The server is still building the data ("being prepared" screen)',
    slow:          'Normal data, but every answer takes 1.5 seconds (loading states)',
    servererror:   'Normal page, but every drill / member / SHG call fails with 500 (error states)'
  };

  function create(DISTRICTS) {
  function rnd(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = ((h * 16777619) % 4294967296) >>> 0; } return h >>> 0; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var MAN = ['Rajesh Kumar', 'Lakshmi Devi', 'Suresh Babu', 'Anitha Rani', 'Venkata Rao', 'Padma Priya', 'Ramesh', 'Sujatha', 'Naresh', 'Kavitha', 'Srinivas', 'Madhavi'];
  var VILL = ['Rampuram', 'Gollapalem', 'Kothapeta', 'Peddapuram', 'Chinthalapudi', 'Vemulapalli', 'Atchutapuram', 'Nandigama', 'Ramavaram', 'Konduru'];
  var TYPES = [['SN1', 'Stree Nidhi Regular'], ['SN2', 'Stree Nidhi Micro'], ['SN3', 'Stree Nidhi Dairy'], ['SN4', 'Stree Nidhi Enterprise']];
  var PURPOSES = ['Dairy / Livestock', 'Petty business', 'Agriculture', 'Tailoring', 'Education', 'Housing repair', 'Health'];

  var now = new Date(2026, 9, 5), months = [];
  for (var i = 23; i >= 0; i--) { var d0 = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(d0.getFullYear() + '-' + pad(d0.getMonth() + 1)); }

  var districts = [], mandals = [], monthly = [], daily = {}, projects = [], purposes = [], employees = [];
  var totals = { activeMembers: 0, membersWithLoans: 0, membersLoanSide: 0, membersRepaySide: 0, loanCount: 0, disbursed: 0, openLoans: 0, closedLoans: 0, repayTxns: 0, repaid: 0, targetAmount: 0 };
  var DGMS = ['K. Prasad', 'M. Sailaja', 'P. Ravi Teja', 'S. Hemalatha', 'B. Murali'], AGMS = [];
  for (var a = 0; a < 14; a++) { AGMS.push(MAN[a % 12] + ' (AGM)'); }
  DISTRICTS.forEach(function (ds, di) {
    var id = pad(di + 1), r = rnd(hash(ds.slug)), size = 0.5 + r() * 1.3;
    var row = { id: id, name: ds.name.toUpperCase(), slug: ds.slug, activeMembers: Math.round(120000 * size), membersWithLoans: 0, membersLoanSide: 0, membersRepaySide: 0, loanCount: 0, disbursed: 0, openLoans: 0, closedLoans: 0, repayTxns: 0, repaid: 0, repaidClosed: 0, repaidUnprocessed: 0, repaidAdjustment: 0, targetAmount: Math.round(150 * size * 10) / 10 };
    var ach = 0.7 + r() * 0.45;
    months.forEach(function (mo, mi) {
      var season = 0.8 + 0.4 * Math.sin(mi / 2.2 + di), loans = Math.round(900 * size * season * (0.8 + r() * 0.4));
      var disb = loans * (42000 + r() * 16000), txns = Math.round(loans * 3.1), rep = disb * (0.55 + 0.35 * ach / 1.2) * (0.9 + r() * 0.2);
      monthly.push({ districtId: id, month: mo, loanCount: loans, disbursed: Math.round(disb), repayTxns: txns, repaid: Math.round(rep) });
      if (mo >= '2026-04') { row.loanCount += loans; row.disbursed += Math.round(disb); row.repayTxns += txns; row.repaid += Math.round(rep); }
    });
    row.membersLoanSide = row.membersWithLoans = Math.round(row.loanCount * 0.82); row.membersRepaySide = Math.round(row.membersLoanSide * 0.7);
    row.openLoans = Math.round(row.loanCount * 0.64); row.closedLoans = row.loanCount - row.openLoans; row.repaidClosed = Math.round(row.repaid * 0.4);
    districts.push(row);
    Object.keys(totals).forEach(function (k) { totals[k] += row[k] || 0; });
    var dl = [], day = new Date(2026, 3, 1);
    while (day <= now) { var iso = day.getFullYear() + '-' + pad(day.getMonth() + 1) + '-' + pad(day.getDate()), wk = day.getDay() === 0 ? 0.2 : 1;
      var l = Math.round(30 * size * wk * (0.5 + r())); dl.push([iso, l, Math.round(l * 50000 * (0.8 + r() * 0.4)), Math.round(l * 3), Math.round(l * 41000 * (0.8 + r() * 0.5))]); day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1); }
    daily[id] = dl;
    TYPES.forEach(function (t, ti) { projects.push({ districtId: id, projectType: t[0], projectName: t[1], loanCount: Math.round(row.loanCount * [.5, .25, .15, .1][ti]), disbursed: Math.round(row.disbursed * [.5, .25, .15, .1][ti]), openLoans: Math.round(row.openLoans * [.5, .25, .15, .1][ti]), members: Math.round(row.membersLoanSide * [.5, .25, .15, .1][ti]) }); });
    PURPOSES.forEach(function (p, pi) { var f = [.3, .25, .15, .1, .08, .07, .05][pi]; purposes.push({ districtId: id, purpose: p, loanCount: Math.round(row.loanCount * f), disbursed: Math.round(row.disbursed * f), members: Math.round(row.membersLoanSide * f) }); });
    var nm = 7 + Math.round(r() * 7), dgm = DGMS[di % 5], dgmId = 'D' + (di % 5);
    for (var k = 0; k < nm; k++) {
      var mid = pad(k + 1), ag = (di + k) % 14, off = 'O' + di + '_' + k;
      var f = 1 / nm * (0.7 + r() * 0.6), mrow = { districtId: id, mandalId: mid, name: VILL[(di + k) % 10] + (k > 9 ? ' Rural' : ''), loanCount: Math.round(row.loanCount * f), disbursed: Math.round(row.disbursed * f), openLoans: Math.round(row.openLoans * f), closedLoans: Math.round(row.closedLoans * f), membersLoanSide: Math.round(row.membersLoanSide * f), repayTxns: Math.round(row.repayTxns * f), repaid: Math.round(row.repaid * f), targetAmount: Math.round(row.targetAmount * f * 100) / 100, officerUserId: off, officerName: MAN[(di * 3 + k) % 12] + ' ' + String.fromCharCode(65 + k), officerRole: k % 4 === 0 ? 'APM' : 'MANDAL COORDINATOR', agmUserId: 'A' + ag, agmName: AGMS[ag], dgmUserId: dgmId, dgmName: dgm };
      mandals.push(mrow);
      employees.push({ userId: off, empCode: 'E' + (1000 + employees.length), officerName: mrow.officerName, officerRole: mrow.officerRole, agmUserId: mrow.agmUserId, agmName: mrow.agmName, dgmUserId: dgmId, dgmName: dgm, districtIds: id, mandalCount: 1, loanCount: mrow.loanCount, disbursed: mrow.disbursed, repayTxns: mrow.repayTxns, repaid: mrow.repaid, targetAmount: mrow.targetAmount });
    }
  });
  totals.activeMembers = districts.reduce(function (s, d) { return s + d.activeMembers; }, 0);
  purposes.push.apply(purposes, PURPOSES.map(function (p, pi) { var f = [.3, .25, .15, .1, .08, .07, .05][pi]; return { districtId: 'ALL', purpose: p, loanCount: Math.round(totals.loanCount * f), disbursed: Math.round(totals.disbursed * f), members: Math.round(totals.membersLoanSide * f) }; }));


  // overdue fields (mock numbers)
  function addOd(o, base, seed) { var r = rnd(hash(seed)), open = Math.round((base.openLoans || 1000) * 0.95), od = Math.round(open * (0.08 + r() * 0.08)), out = Math.round(open * 52000 * (0.8 + r() * 0.3)), amt = Math.round(od * 7000 * (0.7 + r() * 0.6));
    var l1 = Math.round(od * 0.52), l2 = Math.round(od * 0.30), l3 = od - l1 - l2, a1 = Math.round(amt * 0.25), a2 = Math.round(amt * 0.30);
    o.statusLoans = open; o.overdueLoans = od; o.overdueAmount = amt; o.outstanding = out; o.overdueOutstanding = Math.round(out * 0.085);
    o.od1Loans = l1; o.od1Amount = a1; o.od2Loans = l2; o.od2Amount = a2; o.od3Loans = l3; o.od3Amount = amt - a1 - a2; }
  districts.forEach(function (d) { addOd(d, d, 'd' + d.id); });
  mandals.forEach(function (m) { addOd(m, m, 'm' + m.districtId + m.mandalId); });
  employees.forEach(function (e) { addOd(e, e, 'e' + e.userId); });
  ['statusLoans','overdueLoans','overdueAmount','outstanding','overdueOutstanding','od1Loans','od1Amount','od2Loans','od2Amount','od3Loans','od3Amount'].forEach(function (k) { totals[k] = districts.reduce(function (s, d) { return s + d[k]; }, 0); });
  totals.overdueReady = 1;

  var ODK = ['statusLoans','overdueLoans','overdueAmount','outstanding','overdueOutstanding','od1Loans','od1Amount','od2Loans','od2Amount','od3Loans','od3Amount'];
  var boot = { ready: true, fyLabel: '2026-27', fyStart: '2026-04-01', fyEnd: '2027-04-01', builtAtMillis: Date.now() - 3600000, fyList: ['2026-27', '2025-26'], targetUnit: 'crore', totals: totals, districts: districts, months: months, monthly: monthly, daily: daily, projects: projects, purposes: purposes, mandals: mandals, employees: employees };

  // ---- drill: fake rows for any level ----
  function units(q) {
    var g = (q.group || '').toUpperCase(), out = [];
    if (g === 'DISTRICT') { districts.forEach(function (d) { out.push([d.id, d.name, '', d.id]); }); }
    else if (g === 'MANDAL') { mandals.forEach(function (x) { if (!q.districtId || q.districtId === x.districtId) { out.push([x.mandalId, x.name, '', x.districtId]); } }); }
    else if (g === 'VO') { var r = rnd(hash('vo' + q.districtId + q.mandalId)), n = 5 + Math.floor(r() * 6); for (var i = 0; i < n; i++) { out.push(['VO' + q.mandalId + '_' + i, VILL[i % 10] + ' Mahila Samakhya', '']); } }
    else if (g === 'SHG') { var r2 = rnd(hash('shg' + (q.voId || q.mandalId))), n2 = 6 + Math.floor(r2() * 6); for (var j = 0; j < n2; j++) { out.push(['SHG' + (q.voId || q.mandalId) + '_' + j, VILL[(j + 3) % 10] + ' ' + ['Sri Lakshmi', 'Durga', 'Annapurna', 'Sai Baba', 'Ganga'][j % 5] + ' SHG', q.voId || '']); } }
    else if (g === 'MEMBER') { var r3 = rnd(hash('mem' + q.shgId)), n3 = 8 + Math.floor(r3() * 5); for (var t = 0; t < n3; t++) { out.push(['M' + q.shgId + '_' + t, MAN[(t + 5) % 12] + ' ' + VILL[t % 10].charAt(0) + '.', '']); } }
    else if (g === 'PROJECT') { TYPES.forEach(function (t) { out.push([t[0], t[1], '']); }); }
    else if (g === 'CATEGORY') { ['SC', 'ST', 'BC', 'OC', 'Minority'].forEach(function (c) { out.push([c, c, '']); }); }
    else { PURPOSES.forEach(function (p) { out.push([p, p, '']); }); }
    return out;
  }
  function drill(q) {
    var days = (new Date(q.to) - new Date(q.from)) / 86400000, scale = Math.max(0.01, days / 365), g = (q.group || '').toUpperCase();
    var rows = units(q).map(function (u) {
      var r = rnd(hash(u[0] + g)), big = g === 'DISTRICT' ? 1 : g === 'MANDAL' ? 0.12 : g === 'VO' ? 0.015 : g === 'SHG' ? 0.002 : 0.0003;
      var loans = Math.max(1, Math.round(9000 * big * scale * (0.4 + r() * 1.2))), disb = loans * (38000 + r() * 22000), txns = Math.round(loans * (2 + r() * 2)), rep = disb * (0.5 + r() * 0.5);
      var pos = rep * r() * 0.15, upi = rep * r() * 0.35, auto = rep * r() * 0.3;
      var o = { id: u[0], name: u[1], districtId: u[3] || q.districtId || null, activeMembers: Math.round(loans * 1.3), loanCount: loans, disbursed: +disb.toFixed(2), openLoans: Math.round(loans * 0.65), closedLoans: Math.round(loans * 0.35), borrowers: Math.round(loans * 0.9), repayTxns: txns, repaid: +rep.toFixed(2), payers: Math.round(loans * 0.8), openAmount: +(disb - rep * 0.8).toFixed(2), posAmount: +pos.toFixed(2), upiAmount: +upi.toFixed(2), autoAmount: +auto.toFixed(2), posTxns: Math.round(txns * 0.1), upiTxns: Math.round(txns * 0.3), autoTxns: Math.round(txns * 0.25), targetCr: (g === 'DISTRICT' || g === 'MANDAL') ? +(disb * 1.1 / 1e7).toFixed(2) : null };
      if (u[2]) { o.parentId = u[2]; }
      if (g === 'VO' || g === 'SHG' || g === 'MEMBER') { var od = Math.round(loans * 0.9), bh = Math.round(od * (0.05 + r() * 0.12)); o.od = { open: od, loans: bh, amount: bh * 6500, outstanding: od * 47000, atRisk: bh * 52000 }; }
      return o;
    });
    return { source: 'mock', payModes: true, rows: rows };
  }

    function bootFor(scenario) {
      var b = JSON.parse(JSON.stringify(boot));
      if (scenario === 'nooverdue') {
        [b.districts, b.mandals, b.employees, [b.totals]].forEach(function (l) { l.forEach(function (o) { ODK.forEach(function (k) { delete o[k]; }); delete o.overdueReady; }); });
      } else if (scenario === 'overduefailed') {
        [b.districts, b.mandals, b.employees, [b.totals]].forEach(function (l) { l.forEach(function (o) { ODK.forEach(function (k) { o[k] = 0; }); }); });
        b.totals.overdueReady = 0;
      } else if (scenario === 'empty') {
        b.districts = []; b.mandals = []; b.employees = []; b.monthly = []; b.daily = {}; b.projects = []; b.purposes = [];
      } else if (scenario === 'notready') {
        return { ready: false };
      }
      return b;
    }

    // the answer to one call of the dashboard: { status, json: true|false, body }
    function answer(a, q, scenario) {
      function ok(o) { return { status: 200, json: true, body: JSON.stringify(o) }; }
      if (scenario === 'servererror' && /^(drill|member|shg|trend|keyedBy)$/.test(a)) {
        return { status: 500, json: true, body: JSON.stringify({ status: 'error', message: 'Unable to load this level (mock error).' }) };
      }
      if (a === 'status') { return { status: 200, json: false, body: 'ready=' + (scenario !== 'notready') + '\nloading=false\n' }; }
      if (a === 'drill') { return ok(drill(q)); }
      if (a === 'trend') { return ok({ payModes: true, months: months.map(function (mo) { var r = rnd(hash(mo + (q.districtId || ''))); var l = Math.round(2500 * (0.7 + r() * 0.6)); return { month: mo, loanCount: l, disbursed: l * 50000, repayTxns: l * 3, repaid: l * 41000, posAmount: l * 3000, upiAmount: l * 9000, autoAmount: l * 7000 }; }) }); }
      if (a === 'keyedBy') { var rr = []; for (var i = 0; i < 25; i++) { rr.push({ login: 'user' + (100 + i), txns: 40 + i * 7, amount: 120000 + i * 31000, first: '2026-04-0' + (1 + i % 9), last: '2026-10-0' + (1 + i % 5) }); } return ok({ rows: rr }); }
      if (a === 'shg') { return ok({ shg: { id: q.shgId, name: 'Sri Lakshmi SHG', voName: 'Rampuram Mahila Samakhya', registered: '2014-06-12', members: 10, category: 'BC', village: 'Rampuram', wellbeing: 'Poor', grade: 'A', bank: 'SBI', branch: 'Rampuram', disabled: 'No', minority: 'No', mobileLast4: '1234' } }); }
      if (a === 'member') {
        var lo = [];
        for (var k = 0; k < 3; k++) {
          lo.push({ id: 'LN' + k, shgLoanAccNo: 'SL' + k, projectType: 'SN1', projectName: 'Stree Nidhi Regular', purpose: PURPOSES[k], amount: 50000 + k * 10000, status: k ? 'CLOSED' : 'OPEN',
                    arrears: k ? undefined : 6200, emi: k ? undefined : 2400, balance: k ? undefined : 31000, dueDate: '2026-10-01', issuedDate: '2026-0' + (4 + k) + '-12', repaid: 20000 + k * 10000, repayTxns: 4, lastRepaymentDate: '2026-09-28',
                    repayments: [{ id: 'C1', date: '2026-09-28', amount: 5000, status: 'PAID', processed: 'Y', adjustType: '', creditedDate: '2026-09-29', mode: 'UPI' }] });
        }
        return ok({ member: { id: q.memberId, name: 'Lakshmi Devi', shgId: 'x', surname: 'K', fatherHusband: 'Ramesh K', birthYear: 1988, marital: 'Married', category: 'BC', education: 'SSC', wellbeing: 'Poor', village: 'Rampuram', registered: '2014-06-12', disabled: 'No', mobileLast4: '4321' }, loans: lo });
      }
      if (a === 'getBorrowers') { return ok([]); }
      if (a === 'customPreview') {
        var cols = (q.cols || 'loans').split(','), head = ['#', 'District'].concat(cols), rows2 = [];
        for (var i2 = 0; i2 < 8; i2++) { rows2.push([i2 + 1, DISTRICTS[i2].name].concat(cols.map(function (c, k2) { return /Pct/.test(c) ? 41.5 + i2 : 1234567 * (i2 + 1) + k2; }))); }
        return ok({ status: 'ok', count: 28, head: head, rows: rows2, total: [null, 'Total'].concat(cols.map(function () { return 98765432; })), notes: [] });
      }
      if (a === 'custom' || a === 'export') { return { status: 200, json: false, body: 'Preview only: the real server builds the Excel file here.' }; }
      return { status: 404, json: true, body: JSON.stringify({ status: 'error', message: 'Unknown action in the preview: ' + a }) };
    }

    return { boot: boot, bootFor: bootFor, answer: answer };
  }

  root.CeoMock = { create: create, DISTRICTS: DEFAULT_DISTRICTS, SCENARIOS: SCENARIOS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = root.CeoMock; }
})(typeof window !== 'undefined' ? window : this);
