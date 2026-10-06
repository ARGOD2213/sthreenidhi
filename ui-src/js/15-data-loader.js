/* ---------- Data loader - reads the snapshot the JSP writes into the page ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.data = CeoDash.data || {};

  var DISTRICTS = [
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
  CeoDash.data.DISTRICTS = DISTRICTS;

  var TARGET_TO_RUPEES = 10000000;
  var NA = NaN;

  function naSeries(n) { var a = []; for (var i = 0; i < n; i++) { a.push(NA); } return a; }
  function zeroSeriesN(n) { var a = []; for (var i = 0; i < n; i++) { a.push(0); } return a; }
  function num(v) { return (v === null || v === undefined || v === '') ? 0 : Number(v); }

  function titleCase(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s(.\/-])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); });
  }

  // overdue (arrears) of today's open loans; null when the server could not provide it
  function overdueOf(src) {
    if (CeoDash.data.OD_READY !== true || src.overdueAmount === undefined || src.overdueAmount === null) { return null; }
    return {
      open: num(src.statusLoans), loans: num(src.overdueLoans), amount: num(src.overdueAmount),
      outstanding: num(src.outstanding), atRisk: num(src.overdueOutstanding),
      bands: [ { loans: num(src.od1Loans), amount: num(src.od1Amount) },
               { loans: num(src.od2Loans), amount: num(src.od2Amount) },
               { loans: num(src.od3Loans), amount: num(src.od3Amount) } ]
    };
  }

  function realMetrics(src, monthly) {
    var target = num(src.targetAmount);
    var loans = num(src.loanCount), open = num(src.openLoans);
    return {
      disbursed: num(src.disbursed),
      disbursedTarget: target > 0 ? target * TARGET_TO_RUPEES : NA,
      expectedRepayment: NA, receivedRepayment: num(src.repaid),
      outstanding: NA, overdue: NA, od: overdueOf(src),
      cash: NA, online: NA, pos: NA, bank: NA,
      turnaroundDaysSum: NA, turnaroundDaysCount: 0,
      recoveryRateSum: NA, recoveryRateCount: 0,
      activeBorrowers: src.membersLoanSide === undefined ? NA : num(src.membersLoanSide),
      totalLoans: loans,
      closedLoans: src.closedLoans === undefined ? (src.openLoans === undefined ? NA : loans - open) : num(src.closedLoans),
      pendingLoans: src.openLoans === undefined ? NA : open,
      monthly: monthly,
      turnaroundDays: NA, collectionRatio: NA, repaymentRate: NA, cashShare: NA, digitalShare: NA,
      activeMembers: src.activeMembers === undefined ? NA : num(src.activeMembers),
      membersWithLoans: src.membersWithLoans === undefined ? NA : num(src.membersWithLoans),
      membersRepaySide: src.membersRepaySide === undefined ? NA : num(src.membersRepaySide),
      repayTxns: num(src.repayTxns)
    };
  }

  function monthlyBlock(n) {
    return { disbursed: zeroSeriesN(n), received: zeroSeriesN(n), loanCount: zeroSeriesN(n), repayTxns: zeroSeriesN(n),
             expected: naSeries(n), cash: naSeries(n), online: naSeries(n), pos: naSeries(n), bank: naSeries(n) };
  }

  function buildFromBoot(boot) {
    CeoDash.data.OD_READY = !!(boot.totals && Number(boot.totals.overdueReady) === 1);
    var periods = (boot.months || []).slice();
    var P = periods.length;
    var periodIdx = {};
    for (var pi = 0; pi < P; pi++) { periodIdx[periods[pi]] = pi; }

    var canonicalName = {};
    for (var cn = 0; cn < DISTRICTS.length; cn++) { canonicalName[DISTRICTS[cn].slug] = DISTRICTS[cn].name; }

    var regions = [], officesByRegion = {}, byId = {}, slugByDistrictId = {};
    var regionMonthly = {};
    var bd = boot.districts || [];
    for (var di = 0; di < bd.length; di++) {
      var d = bd[di];
      slugByDistrictId[d.id] = d.slug;
      regionMonthly[d.slug] = monthlyBlock(P);
    }
    var bm = boot.monthly || [];
    for (var mi = 0; mi < bm.length; mi++) {
      var row = bm[mi], slug = slugByDistrictId[row.districtId], idx = periodIdx[row.month];
      if (!slug || idx === undefined) { continue; }
      var blk = regionMonthly[slug];
      blk.disbursed[idx] += num(row.disbursed);
      blk.received[idx]  += num(row.repaid);
      blk.loanCount[idx] += num(row.loanCount);
      blk.repayTxns[idx] += num(row.repayTxns);
    }
    var dailyByDistrict = boot.daily || {};
    for (var dj = 0; dj < bd.length; dj++) {
      var dr = bd[dj];
      var region = {
        id: dr.slug, name: canonicalName[dr.slug] || titleCase(dr.name), level: 'region',
        districtId: dr.id, dbName: dr.name, officeIds: [], performanceState: 'no-data',
        metrics: realMetrics(dr, regionMonthly[dr.slug]),
        realDaily: indexDaily(dailyByDistrict[dr.id])
      };
      regions.push(region);
      officesByRegion[region.id] = [];
      byId[region.id] = region;
    }

    var offices = [], vosByOffice = {};
    var bmd = boot.mandals || [];
    for (var oi = 0; oi < bmd.length; oi++) {
      var m = bmd[oi], rslug = slugByDistrictId[m.districtId];
      if (!rslug) { continue; }
      var office = {
        id: rslug + '-m' + m.mandalId, name: m.name || ('Mandal ' + m.mandalId), level: 'office',
        regionId: rslug, districtId: m.districtId, mandalId: m.mandalId, voIds: [], performanceState: 'no-data',
        officer: { userId: m.officerUserId, name: m.officerName, role: m.officerRole,
                   agmUserId: m.agmUserId, agmName: m.agmName, dgmUserId: m.dgmUserId, dgmName: m.dgmName },
        metrics: realMetrics(m, {
          disbursed: naSeries(P), received: naSeries(P), loanCount: naSeries(P), repayTxns: naSeries(P),
          expected: naSeries(P), cash: naSeries(P), online: naSeries(P), pos: naSeries(P), bank: naSeries(P)
        })
      };
      offices.push(office);
      byId[office.id] = office;
      byId[rslug].officeIds.push(office.id);
      officesByRegion[rslug].push(office.id);
      vosByOffice[office.id] = [];
    }

    var orgMonthly = monthlyBlock(P);
    var orgDaily = {};
    for (var rk = 0; rk < regions.length; rk++) {
      var rm = regions[rk].metrics.monthly;
      for (var k = 0; k < P; k++) {
        orgMonthly.disbursed[k] += rm.disbursed[k];
        orgMonthly.received[k]  += rm.received[k];
        orgMonthly.loanCount[k] += rm.loanCount[k];
        orgMonthly.repayTxns[k] += rm.repayTxns[k];
      }
      var rdaily = regions[rk].realDaily;
      for (var day in rdaily) {
        if (!Object.prototype.hasOwnProperty.call(rdaily, day)) { continue; }
        var acc = orgDaily[day] || (orgDaily[day] = [0, 0, 0, 0]);
        for (var c = 0; c < 4; c++) { acc[c] += rdaily[day][c]; }
      }
    }
    var org = {
      id: 'org', name: 'AP Stree Nidhi', level: 'org', performanceState: 'no-data',
      metrics: realMetrics(boot.totals || {}, orgMonthly),
      realDaily: orgDaily,
      loanTypeComposition: compositionFromPurposes((boot.purposes || []).filter(function (r) { return r.districtId === 'ALL'; })),
      projectComposition: compositionFromProjects(boot.projects || []),
      socialCategoryComposition: []
    };

    var compositionByRegion = {};
    regions.forEach(function (rg) {
      compositionByRegion[rg.id] = {
        projects: compositionFromProjects((boot.projects || []).filter(function (r) { return r.districtId === rg.districtId; })),
        purposes: compositionFromPurposes((boot.purposes || []).filter(function (r) { return r.districtId === rg.districtId; }))
      };
    });

    CeoDash.data.REAL = true;
    CeoDash.data.REAL_DAILY_RANGE = { from: boot.fyStart, to: lastDayBefore(boot.fyEnd) };
    var built = new Date(Number(boot.builtAtMillis || 0));
    var builtKey = built.getFullYear() + '-' + (built.getMonth() < 9 ? '0' : '') + (built.getMonth() + 1);
    CeoDash.data.REAL_RUNNING_LAST = periods.length > 0 && periods[periods.length - 1] === builtKey;

    var model = {
      real: true,
      fyLabel: boot.fyLabel, fyStart: boot.fyStart, fyEnd: boot.fyEnd, builtAtMillis: boot.builtAtMillis,
      targetUnit: boot.targetUnit,
      periods: periods,
      org: org,
      regions: regions, offices: offices, vos: [], shgs: [],
      byId: byId,
      officesByRegion: officesByRegion, vosByOffice: vosByOffice, shgsByVo: {},
      getBorrowers: realBorrowers,
      loanTypes: org.loanTypeComposition.map(function (x) { return x.type; }),
      employeesReal: boot.employees || [],
      projectTypes: projectTypesOf(boot.projects || []),
      compositionByRegion: compositionByRegion,
      storyRoles: {
        decliningRegionId: null, decliningOfficeId: null, decliningVoIds: [], decliningShgIds: [],
        highCashOfficeId: null, highCashVoIds: [], slowTurnaroundOfficeIds: []
      }
    };

    model.ensureChildren = function (entity) {
      if (!entity || (entity.level !== 'office' && entity.level !== 'vo') || entity.childrenLoaded || entity.childrenLoading) { return; }
      var isOffice = entity.level === 'office';
      var url = (window.__CEO_CTX || '') + '/CeoLoanIntelligence?action=drill&group=' + (isOffice
        ? 'VO&districtId=' + encodeURIComponent(entity.districtId) + '&mandalId=' + encodeURIComponent(entity.mandalId)
        : 'SHG&voId=' + encodeURIComponent(entity.id)) +
        '&from=' + encodeURIComponent(String(boot.fyStart).substr(0, 10)) + '&to=' + encodeURIComponent(String(boot.fyEnd).substr(0, 10));
      entity.childrenLoading = true;
      getJsonAsync(url, function (body) {
      entity.childrenLoading = false;
      var rows = body && body.rows ? body.rows : null;
      if (rows === null) { entity.childrenError = true; return; }
      entity.childrenLoaded = true;
      entity.childrenError = false;
      rows.forEach(function (r) {
        var id = String(r.id);
        var child = model.byId[id];
        if (!child) {
          child = {
            id: id, name: r.name || id, level: isOffice ? 'vo' : 'shg',
            regionId: entity.regionId, districtId: entity.districtId,
            officeId: isOffice ? entity.id : entity.officeId,
            performanceState: 'no-data',
            metrics: realMetrics({
              loanCount: r.loanCount, disbursed: r.disbursed, openLoans: r.openLoans, closedLoans: r.closedLoans,
              membersLoanSide: r.borrowers === null ? undefined : r.borrowers, repaid: r.repaid, repayTxns: r.repayTxns,
              membersRepaySide: r.payers === null ? undefined : r.payers,
              activeMembers: r.activeMembers === null ? undefined : r.activeMembers
            }, naMonthly(P))
          };
          if (isOffice) {
            child.shgIds = []; child.shgCount = NA;
            model.vos.push(child); model.shgsByVo[id] = [];
          } else {
            child.voId = entity.id; child.code = id; child.memberCount = num(r.activeMembers);
            child.flags = { declining: false, highCash: false, overdue: false, riskyRepeat: false, topPerformer: false };
            child.loanCycles = []; child.riskLevel = 'no-data';
            model.shgs.push(child);
          }
          model.byId[id] = child;
        }
        if (isOffice) { entity.voIds.push(id); model.vosByOffice[entity.id].push(id); }
        else { entity.shgIds.push(id); model.shgsByVo[entity.id].push(id); }
      });
      CeoDash.core.state.set({});
      });
    };
    REAL_MODEL = model;
    return model;
  }

  function naMonthly(n) {
    return { disbursed: naSeries(n), received: naSeries(n), loanCount: naSeries(n), repayTxns: naSeries(n),
             expected: naSeries(n), cash: naSeries(n), online: naSeries(n), pos: naSeries(n), bank: naSeries(n) };
  }

  function getJsonAsync(url, done) {
    var finished = false;
    function finish(v) { if (!finished) { finished = true; done(v); } }
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url + (window.__CEO_TOKEN ? (url.indexOf('?') < 0 ? '?' : '&') + 't=' + encodeURIComponent(window.__CEO_TOKEN) : ''), true);
      try { xhr.timeout = 60000; xhr.ontimeout = function () { finish(null); }; } catch (te) {  }
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) { return; }
        var body = null;
        try { body = xhr.status === 200 ? JSON.parse(xhr.responseText) : null; } catch (pe) { body = null; }
        finish(body);
      };
      xhr.send(null);
    } catch (e) { finish(null); }
  }

  function indexDaily(rows) {
    var out = {};
    for (var i = 0; rows && i < rows.length; i++) {
      out[rows[i][0]] = [num(rows[i][1]), num(rows[i][2]), num(rows[i][3]), num(rows[i][4])];
    }
    return out;
  }

  function lastDayBefore(isoDate) {
    var p = String(isoDate || '').split('-');
    if (p.length !== 3) { return isoDate; }
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) - 1);
    var mm = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
  }

  function compositionFromPurposes(rows) {
    var total = 0;
    rows.forEach(function (r) { total += num(r.disbursed); });
    return rows.map(function (r) {
      var amount = num(r.disbursed), loans = num(r.loanCount);
      return {
        type: r.purpose, name: r.purpose, amount: amount, loanCount: loans,
        share: total ? amount / total : 0, avgSize: loans ? Math.round(amount / loans) : 0,
        borrowers: r.members === undefined ? NA : num(r.members),
        receivedRepayment: NA, closedLoans: NA, pendingLoans: NA, recoveryRate: NA
      };
    });
  }

  function projectTypesOf(rows) {
    var amt = {}, name = {}, out = [];
    rows.forEach(function (r) {
      var t = String(r.projectType);
      if (amt[t] === undefined) { amt[t] = 0; name[t] = r.projectName || ('Project ' + t); out.push(t); }
      amt[t] += num(r.disbursed);
    });
    out.sort(function (a, b) { return amt[b] - amt[a]; });
    return out.map(function (t) { return { type: t, name: name[t] }; });
  }

  function compositionFromProjects(rows) {
    var byName = {}, order = [], total = 0;
    rows.forEach(function (r) {
      var name = r.projectName || ('Project ' + r.projectType);
      if (!byName[name]) { byName[name] = { amount: 0, loans: 0, open: 0, members: 0 }; order.push(name); }
      byName[name].amount += num(r.disbursed);
      byName[name].loans += num(r.loanCount);
      byName[name].open += num(r.openLoans);
      byName[name].members += num(r.members);
      total += num(r.disbursed);
    });
    order.sort(function (a, b) { return byName[b].amount - byName[a].amount; });
    return order.map(function (name) {
      var x = byName[name];
      return {
        project: name, type: name, name: name, share: total ? x.amount / total : 0, amount: x.amount,
        loanCount: x.loans, pendingLoans: x.open, closedLoans: x.loans - x.open,
        avgSize: x.loans ? Math.round(x.amount / x.loans) : 0,
        borrowers: x.members, receivedRepayment: NA, recoveryRate: NA
      };
    });
  }

  function normalizeBorrower(b) {
    var NR = '—';
    b.level = 'borrower';
    b.occupation = NR; b.village = NR; b.aadhaarLast4 = NR; b.phone = NR;
    b.loans = b.loans || [];
    b.cycleNumber = b.loans.length;
    var first = null;
    b.loans.forEach(function (l) {
      l.expectedRepayment = NA;
      if (l.issuedDate && (!first || l.issuedDate < first)) { first = l.issuedDate; }
    });
    b.joinYear = first ? first.substr(0, 4) : NR;
  }

  var REAL_MODEL = null;
  var realBorrowerCache = {};
  var realBorrowerPending = {};
  function realBorrowers(shgId) {
    if (realBorrowerCache[shgId]) { return realBorrowerCache[shgId]; }
    if (!realBorrowerPending[shgId]) {
      realBorrowerPending[shgId] = true;
      getJsonAsync((window.__CEO_CTX || '') + '/CeoLoanIntelligence?action=getBorrowers&shgId=' + encodeURIComponent(shgId), function (list) {
        delete realBorrowerPending[shgId];
        if (!list || typeof list.length !== 'number') { return; }
        var shgEnt = REAL_MODEL && REAL_MODEL.byId[shgId];
        list.forEach(function (b) { normalizeBorrower(b); b.shgName = shgEnt ? shgEnt.name : ''; });
        realBorrowerCache[shgId] = list;
      });
    }
    return [];
  }

  CeoDash.data.load = function (callback) {
    try {
      var boot = (typeof window !== 'undefined') ? window.__CEO_BOOT_DATA : null;
      if (boot) {
        if (!boot.ready || !boot.districts || !boot.districts.length) {
          var notReady = new Error(window.__CEO_SNAPSHOT_MESSAGE || 'Dashboard data is being prepared from SNBSAP.');
          notReady.notReady = true;
          callback(notReady, null);
          return;
        }
        callback(null, buildFromBoot(boot));
        return;
      }
      var missing = new Error('The dashboard data could not be loaded. Please reload the page; if this repeats, inform the dashboard team.');
      missing.notReady = true;
      callback(missing, null);
    } catch (err) {
      callback(err, null);
    }
  };
})(window);
