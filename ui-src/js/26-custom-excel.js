/* ---------- Custom Excel: a floating button that opens a "build your own report" panel ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  var el = CeoDash.core.dom.el, fmt = CeoDash.core.format;
  var KEY = 'ceoCustomExcel.v1';
  var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var GROUPS = [
    ['DISTRICT', 'Districts', 'one row per district'], ['MANDAL', 'Mandals', 'one row per mandal'],
    ['PROJECT', 'Projects', 'by scheme'], ['MONTH', 'Months', 'month by month'],
    ['OFFICER', 'Managers', 'mandal officers'], ['AGM', 'AGMs', 'zone heads'], ['DGM', 'DGMs', 'top zone heads']
  ];
  // [section title, colour, columns]; needs: 'm' = only when the rows are places or people (not projects / months), 'o' = overdue figures exist
  var COLS = [
    ['Loans given', '#15803d', [['loans', 'Loans given'], ['given', 'Amount given'], ['avg', 'Average loan'], ['open', 'Active loans'], ['closed', 'Closed loans']]],
    ['Collections', '#2563eb', [['txns', 'Repayments'], ['collected', 'Collected'], ['upi', 'UPI'], ['pos', 'POS (Paytm)'], ['auto', 'Auto-debit'],
                                ['manual', 'Manual / cash'], ['onlinePct', 'Paid online %'], ['cashPct', 'Paid in cash %']]],
    ['Target', '#7c3aed', [['target', 'Target (for the months)'], ['achPct', 'Target achieved %']], 'm'],
    ['Overdue', '#dc2626', [['odAmt', 'Overdue amount'], ['odLoans', 'Loans in arrears'], ['odPct', 'Arrears % of open loans'], ['atRisk', 'Balance at risk'],
                            ['outstanding', 'Total outstanding'], ['parPct', 'At risk % of outstanding']], 'o']
  ];
  var PRESETS = [
    ['Basic', ['loans', 'given', 'open', 'closed', 'txns', 'collected', 'onlinePct']],
    ['Collections', ['txns', 'collected', 'upi', 'pos', 'auto', 'manual', 'onlinePct', 'cashPct']],
    ['Target', ['loans', 'given', 'target', 'achPct', 'collected']],
    ['Risk', ['given', 'open', 'odAmt', 'odLoans', 'odPct', 'atRisk', 'outstanding', 'parPct']]
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function addMonths(ym, k) {
    var y = +ym.substr(0, 4), m = +ym.substr(5, 2) - 1 + k;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  function monthLabel(ym) { return MONTH_NAMES[+ym.substr(5, 2) - 1] + ' ' + ym.substr(0, 4); }
  function fyStartOf(ym) { var y = +ym.substr(0, 4); return +ym.substr(5, 2) >= 4 ? y : y - 1; }
  function fyLabel(sy) { return sy + '-' + pad((sy + 1) % 100); }
  function sel(options, value, onChange) {
    var s = el('select', { className: 'cd-cx-select' });
    options.forEach(function (o) {
      var op = el('option', { value: o[0] }, o[1]);
      if (String(o[0]) === String(value)) { op.selected = true; }
      s.appendChild(op);
    });
    s.onchange = function () { onChange(s.value); };
    return s;
  }
  function keys(obj) { var k = []; for (var p in obj) { if (Object.prototype.hasOwnProperty.call(obj, p) && obj[p]) { k.push(p); } } return k; }

  var M = null;   // the mounted instance

  function mount(data) {
    if (M || !global.document || !global.document.body) { return; }
    var periods = data.periods || [];
    if (!periods.length) { return; }
    var winFirst = periods[0], winEnd = addMonths(periods[periods.length - 1], 1);
    var odOn = CeoDash.data.OD_READY === true;
    var fys = [];
    for (var i = periods.length - 1; i >= 0; i--) {
      var sy = fyStartOf(periods[i]);
      if (fys.indexOf(sy) === -1) { fys.push(sy); }
    }
    var curFy = fyStartOf(String(data.fyStart).substr(0, 7));

    var S = { group: 'DISTRICT', districts: {}, mandals: {}, fy: curFy, preset: 'fy', from: winFirst, to: winEnd, project: '',
              cols: {}, sort: 'given', dir: 'desc', top: '0', trend: false, title: '' };
    PRESETS[0][1].forEach(function (k) { S.cols[k] = true; });
    try {
      var saved = global.localStorage ? JSON.parse(global.localStorage.getItem(KEY) || 'null') : null;
      if (saved && typeof saved === 'object') {
        if (saved.group) { S.group = saved.group; }
        if (saved.cols) { S.cols = saved.cols; }
        if (saved.sort) { S.sort = saved.sort; }
        if (saved.dir) { S.dir = saved.dir; }
        if (saved.top !== undefined) { S.top = saved.top; }
        if (saved.trend !== undefined) { S.trend = !!saved.trend; }
        if (saved.preset) { S.preset = saved.preset; }
      }
    } catch (e) { /* private window or blocked storage: no memory, still works */ }
    function persist() {
      try {
        if (global.localStorage) {
          global.localStorage.setItem(KEY, JSON.stringify({ group: S.group, cols: S.cols, sort: S.sort, dir: S.dir, top: S.top, trend: S.trend, preset: S.preset }));
        }
      } catch (e) { /* ignore */ }
    }

    // ---- months of the chosen period
    function range() {
      var from, to, label;
      var fyFrom = S.fy + '-04', fyTo = (S.fy + 1) + '-04';
      function clip(a, b) { return [a < winFirst ? winFirst : a, b > winEnd ? winEnd : b]; }
      var r;
      if (S.preset === 'q1' || S.preset === 'q2' || S.preset === 'q3' || S.preset === 'q4') {
        var q = +S.preset.substr(1);
        r = clip(addMonths(fyFrom, 3 * (q - 1)), addMonths(fyFrom, 3 * q));
      } else if (S.preset === 'last3') { r = [addMonths(winEnd, -3), winEnd]; }
      else if (S.preset === 'last6') { r = [addMonths(winEnd, -6), winEnd]; }
      else if (S.preset === 'this') { r = [addMonths(winEnd, -1), winEnd]; }
      else if (S.preset === 'custom') { r = [S.from, S.to]; }
      else { r = clip(fyFrom, fyTo); }
      from = r[0]; to = r[1];
      label = from < to ? monthLabel(from) + (addMonths(to, -1) === from ? '' : ' – ' + monthLabel(addMonths(to, -1))) : 'no months in the data';
      return { from: from, to: to, label: label, ok: from < to && from >= winFirst && to <= winEnd };
    }

    function groupHasPlaces() { return S.group !== 'PROJECT' && S.group !== 'MONTH'; }
    function colAllowed(sec) { return !((sec[3] === 'm' && !groupHasPlaces()) || (sec[3] === 'o' && (!odOn || !groupHasPlaces()))); }

    // ---- request
    function params() {
      var r = range(), cols = [];
      COLS.forEach(function (sec) {
        if (!colAllowed(sec)) { return; }
        sec[2].forEach(function (c) { if (S.cols[c[0]]) { cols.push(c[0]); } });
      });
      var p = { group: S.group, fromMonth: r.from, toMonth: r.to, districts: keys(S.districts).join(','), mandals: keys(S.mandals).join(','),
                project: S.project, cols: cols.join(','), sort: S.sort, dir: S.dir, top: S.top === '0' ? '' : S.top, trend: S.trend ? '1' : '', title: S.title };
      if (S.group === 'MONTH') { p.project = ''; p.trend = ''; }
      return { p: p, cols: cols, range: r };
    }
    function body(p, action) {
      var a = ['action=' + action];
      for (var k in p) { if (Object.prototype.hasOwnProperty.call(p, k) && p[k] !== '') { a.push(encodeURIComponent(k) + '=' + encodeURIComponent(p[k])); } }
      if (global.__CEO_TOKEN) { a.push('t=' + encodeURIComponent(global.__CEO_TOKEN)); }
      return a.join('&');
    }
    var url = (global.__CEO_CTX || '') + '/CeoLoanIntelligence';

    // ---- floating button and panel
    var fab = el('button', { type: 'button', className: 'cd-cx-fab', title: 'Build your own Excel report', 'aria-label': 'Custom Excel' }, [
      el('span', { className: 'cd-cx-fab-ico', 'aria-hidden': 'true' }, 'XLS'),
      el('span', { className: 'cd-cx-fab-txt' }, 'Custom Excel')
    ]);
    var backdrop = el('div', { className: 'cd-cx-backdrop' });
    var panel = el('aside', { className: 'cd-cx-panel', role: 'dialog', 'aria-label': 'Build your own Excel report' });
    var status = el('div', { className: 'cd-cx-status' });
    var previewBox = el('div', { className: 'cd-cx-preview' });
    var bodyBox = el('div', { className: 'cd-cx-body' });
    var btnPreview = el('button', { type: 'button', className: 'cd-cx-btn cd-cx-btn--ghost' }, 'Preview');
    var btnGo = el('button', { type: 'button', className: 'cd-cx-btn cd-cx-btn--go' }, 'Download Excel');
    var closeBtn = el('button', { type: 'button', className: 'cd-cx-close', title: 'Close', 'aria-label': 'Close' }, '✕');
    panel.appendChild(el('div', { className: 'cd-cx-head' }, [
      el('div', {}, [el('div', { className: 'cd-cx-title' }, 'Build your own Excel'), el('div', { className: 'cd-cx-sub' }, 'Choose what you need, then download it as an Excel file.')]),
      closeBtn
    ]));
    panel.appendChild(bodyBox);
    panel.appendChild(el('div', { className: 'cd-cx-foot' }, [status, previewBox, el('div', { className: 'cd-cx-actions' }, [btnPreview, btnGo])]));
    global.document.body.appendChild(backdrop);
    global.document.body.appendChild(panel);
    global.document.body.appendChild(fab);

    global.setTimeout(function () { fab.className = 'cd-cx-fab cd-cx-fab--min'; }, 7000);
    function open() { render(); panel.className = 'cd-cx-panel cd-cx-panel--open'; backdrop.className = 'cd-cx-backdrop cd-cx-backdrop--on'; fab.style.display = 'none'; }
    function close() { panel.className = 'cd-cx-panel'; backdrop.className = 'cd-cx-backdrop'; fab.style.display = ''; fab.className = 'cd-cx-fab cd-cx-fab--min'; }
    fab.onclick = open; closeBtn.onclick = close; backdrop.onclick = close;
    global.document.addEventListener('keydown', function (e) { if ((e.keyCode === 27) && panel.className.indexOf('--open') !== -1) { close(); } }, false);

    function say(text, kind) { status.className = 'cd-cx-status' + (kind ? ' cd-cx-status--' + kind : ''); status.textContent = text || ''; }
    function section(n, title, hint, content) {
      return el('section', { className: 'cd-cx-sec' }, [
        el('div', { className: 'cd-cx-sec-head' }, [el('span', { className: 'cd-cx-num' }, String(n)), el('span', { className: 'cd-cx-sec-title' }, title),
                                                    hint ? el('span', { className: 'cd-cx-hint' }, hint) : null]),
        content
      ]);
    }
    function chip(label, on, onClick, title) {
      return el('button', { type: 'button', className: 'cd-cx-chip' + (on ? ' cd-cx-chip--on' : ''), title: title || label, onClick: onClick }, label);
    }
    function check(label, on, onChange, color) {
      var cb = el('input', { type: 'checkbox' });
      cb.checked = !!on;
      cb.onchange = function () { onChange(cb.checked); };
      var lab = el('label', { className: 'cd-cx-check' }, [cb, el('span', {}, label)]);
      if (color) { lab.style.borderColor = color; }
      return lab;
    }

    // ---- sections
    function secGroup() {
      var row = el('div', { className: 'cd-cx-chips' });
      GROUPS.forEach(function (g) {
        row.appendChild(chip(g[1], S.group === g[0], function () {
          S.group = g[0];
          if (S.group === 'PROJECT' && keys(S.mandals).length > 60) { S.mandals = {}; }
          persist(); render();
        }, g[2]));
      });
      return section(1, 'Show me', 'one row for each ...', row);
    }

    function secWhere() {
      var box = el('div', {});
      var search = el('input', { type: 'text', className: 'cd-cx-search', placeholder: 'Find a district...' });
      var list = el('div', { className: 'cd-cx-list' });
      var all = el('div', { className: 'cd-cx-linkrow' });
      var regions = data.regions.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; });
      var count = keys(S.districts).length;
      all.appendChild(el('button', { type: 'button', className: 'cd-cx-link', onClick: function () {
        regions.forEach(function (r) { S.districts[r.districtId] = true; }); S.mandals = {}; render(); } }, 'Select all'));
      all.appendChild(el('button', { type: 'button', className: 'cd-cx-link', onClick: function () { S.districts = {}; S.mandals = {}; render(); } }, 'Clear'));
      all.appendChild(el('span', { className: 'cd-cx-muted' }, count ? count + ' selected' : 'none selected = all districts'));
      regions.forEach(function (r) {
        var item = check(r.name, S.districts[r.districtId], function (on) {
          S.districts[r.districtId] = on;
          if (!on) { for (var k in S.mandals) { if (k.split('|')[0] === r.districtId) { delete S.mandals[k]; } } }
          render();
        });
        item.setAttribute('data-name', r.name.toLowerCase());
        list.appendChild(item);
      });
      search.oninput = function () {
        var q = search.value.toLowerCase();
        var items = list.childNodes;
        for (var i = 0; i < items.length; i++) { items[i].style.display = items[i].getAttribute('data-name').indexOf(q) === -1 ? 'none' : ''; }
      };
      box.appendChild(search); box.appendChild(all); box.appendChild(list);
      // mandals: when exactly one district is chosen
      var chosen = keys(S.districts);
      if (chosen.length === 1 && groupHasPlaces() || (chosen.length === 1 && S.group === 'PROJECT')) {
        var mands = (data.offices || []).filter(function (o) { return o.districtId === chosen[0]; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
        var mbox = el('div', { className: 'cd-cx-mandals' });
        mbox.appendChild(el('div', { className: 'cd-cx-muted' }, 'Only some mandals of this district? Tick them (none ticked = all ' + mands.length + ').'));
        var ml = el('div', { className: 'cd-cx-list cd-cx-list--short' });
        mands.forEach(function (o) {
          var key = o.districtId + '|' + o.mandalId;
          ml.appendChild(check(o.name, S.mandals[key], function (on) { S.mandals[key] = on; }));
        });
        mbox.appendChild(ml);
        box.appendChild(mbox);
      }
      return section(2, 'Where', 'districts', box);
    }

    function secWhen() {
      var box = el('div', {});
      var fyOpts = fys.map(function (y) { return [y, 'FY ' + fyLabel(y)]; });
      var presets = [['fy', 'Whole year'], ['q1', 'Q1 (Apr-Jun)'], ['q2', 'Q2 (Jul-Sep)'], ['q3', 'Q3 (Oct-Dec)'], ['q4', 'Q4 (Jan-Mar)'],
                     ['last3', 'Last 3 months'], ['last6', 'Last 6 months'], ['this', 'Latest month'], ['custom', 'Pick months...']];
      var row = el('div', { className: 'cd-cx-two' });
      row.appendChild(el('label', {}, [el('span', { className: 'cd-cx-lab' }, 'Financial year'), sel(fyOpts, S.fy, function (v) { S.fy = +v; render(); })]));
      row.appendChild(el('label', {}, [el('span', { className: 'cd-cx-lab' }, 'Months'), sel(presets, S.preset, function (v) { S.preset = v; persist(); render(); })]));
      box.appendChild(row);
      if (S.preset === 'custom') {
        var mo = periods.map(function (p) { return [p, monthLabel(p)]; });
        var row2 = el('div', { className: 'cd-cx-two' });
        row2.appendChild(el('label', {}, [el('span', { className: 'cd-cx-lab' }, 'From'), sel(mo, S.from, function (v) { S.from = v; render(); })]));
        var mo2 = periods.map(function (p) { return [addMonths(p, 1), monthLabel(p)]; });
        row2.appendChild(el('label', {}, [el('span', { className: 'cd-cx-lab' }, 'To (last month)'), sel(mo2, S.to, function (v) { S.to = v; render(); })]));
        box.appendChild(row2);
      }
      var r = range();
      box.appendChild(el('div', { className: 'cd-cx-range' + (r.ok ? '' : ' cd-cx-range--bad') }, r.ok ? 'Showing: ' + r.label : 'Those months are not in the data. Data covers ' + monthLabel(winFirst) + ' – ' + monthLabel(addMonths(winEnd, -1)) + '.'));
      return section(3, 'When', 'months', box);
    }

    function secProject() {
      var opts = [['', 'All Stree Nidhi projects']].concat((data.projectTypes || []).map(function (t) { return [t.type, t.name]; }));
      var s = sel(opts, S.project, function (v) { S.project = v; render(); });
      var wrap = el('div', {}, [s]);
      if (S.group === 'MONTH') { s.disabled = true; wrap.appendChild(el('div', { className: 'cd-cx-muted' }, 'The month view shows all projects together.')); }
      return section(4, 'Project', 'optional', wrap);
    }

    function secCols() {
      var box = el('div', {});
      var pr = el('div', { className: 'cd-cx-chips cd-cx-chips--small' });
      pr.appendChild(el('span', { className: 'cd-cx-muted' }, 'Quick pick:'));
      PRESETS.forEach(function (p) {
        pr.appendChild(chip(p[0], false, function () { S.cols = {}; p[1].forEach(function (k) { S.cols[k] = true; }); persist(); render(); }));
      });
      pr.appendChild(chip('Everything', false, function () { S.cols = {}; COLS.forEach(function (sec) { sec[2].forEach(function (c) { S.cols[c[0]] = true; }); }); persist(); render(); }));
      pr.appendChild(chip('Clear', false, function () { S.cols = {}; persist(); render(); }));
      box.appendChild(pr);
      COLS.forEach(function (sec) {
        var ok = colAllowed(sec);
        var g = el('div', { className: 'cd-cx-colgroup' + (ok ? '' : ' cd-cx-colgroup--off') });
        g.appendChild(el('div', { className: 'cd-cx-colhead', style: { color: sec[1] } }, sec[0] +
          (!ok ? (sec[3] === 'o' && !odOn ? ' – not available yet' : ' – not for this grouping') : '')));
        var grid = el('div', { className: 'cd-cx-colgrid' });
        sec[2].forEach(function (c) {
          var item = check(c[1], S.cols[c[0]] && ok, function (on) { S.cols[c[0]] = on; persist(); renderSortOnly(); }, ok ? sec[1] : null);
          if (!ok) { item.firstChild.disabled = true; }
          grid.appendChild(item);
        });
        g.appendChild(grid);
        box.appendChild(g);
      });
      return section(5, 'Columns', 'tick what you need', box);
    }

    var sortHolder = el('div', {});
    function renderSortOnly() {
      while (sortHolder.firstChild) { sortHolder.removeChild(sortHolder.firstChild); }
      var p = params(), opts = [['name', 'Name (A to Z)']];
      COLS.forEach(function (sec) { sec[2].forEach(function (c) { if (p.cols.indexOf(c[0]) !== -1) { opts.push([c[0], c[1]]); } }); });
      if (S.sort !== 'name' && p.cols.indexOf(S.sort) === -1) { S.sort = p.cols.length ? p.cols[0] : 'name'; }
      var row = el('div', { className: 'cd-cx-two' });
      row.appendChild(el('label', {}, [el('span', { className: 'cd-cx-lab' }, 'Sort by'), sel(opts, S.sort, function (v) { S.sort = v; persist(); })]));
      row.appendChild(el('label', {}, [el('span', { className: 'cd-cx-lab' }, 'Order'), sel([['desc', 'Highest first'], ['asc', 'Lowest first']], S.dir, function (v) { S.dir = v; persist(); })]));
      sortHolder.appendChild(row);
      if (S.group === 'MONTH') { sortHolder.appendChild(el('div', { className: 'cd-cx-muted' }, 'Months are always listed in order.')); }
    }
    function secOrder() {
      var box = el('div', {});
      renderSortOnly();
      box.appendChild(sortHolder);
      box.appendChild(el('div', { className: 'cd-cx-two' }, [
        el('label', {}, [el('span', { className: 'cd-cx-lab' }, 'How many rows'), sel([['0', 'All'], ['10', 'Top 10'], ['25', 'Top 25'], ['50', 'Top 50'], ['100', 'Top 100']], S.top, function (v) { S.top = v; persist(); })]),
        el('label', {}, [el('span', { className: 'cd-cx-lab' }, 'Report title (optional)'), el('input', { type: 'text', className: 'cd-cx-input', maxLength: 80, value: S.title,
          onInput: function (e) { S.title = e.target.value; } })])
      ]));
      var tr = check('Add a second sheet with month-by-month totals', S.trend, function (on) { S.trend = on; persist(); });
      if (S.group === 'MONTH' || S.project) { tr.firstChild.disabled = true; }
      box.appendChild(tr);
      return section(6, 'Order and size', null, box);
    }

    function render() {
      var top = bodyBox.scrollTop;
      while (bodyBox.firstChild) { bodyBox.removeChild(bodyBox.firstChild); }
      bodyBox.appendChild(secGroup());
      bodyBox.appendChild(secWhere());
      bodyBox.appendChild(secWhen());
      bodyBox.appendChild(secProject());
      bodyBox.appendChild(secCols());
      bodyBox.appendChild(secOrder());
      bodyBox.scrollTop = top;
      say(''); clearPreview();
    }
    function clearPreview() { while (previewBox.firstChild) { previewBox.removeChild(previewBox.firstChild); } }

    // ---- preview and download
    function post(action, p, done) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      try { xhr.timeout = 60000; xhr.ontimeout = function () { done(null, 'The server took too long. Try fewer months or districts.'); }; } catch (te) { /* old browsers */ }
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) { return; }
        var b = null;
        try { b = JSON.parse(xhr.responseText); } catch (pe) { b = null; }
        if (xhr.status === 200 && b) { done(b, null); }
        else if (xhr.status === 0) { done(null, 'Could not reach the dashboard server.'); }
        else { done(null, (b && b.message) || ('The server returned ' + xhr.status + '.')); }
      };
      xhr.send(body(p, action));
    }
    function check2() {
      var q = params();
      if (!q.cols.length) { say('Tick at least one column.', 'bad'); return null; }
      if (!q.range.ok) { say('Choose months that are in the data.', 'bad'); return null; }
      return q;
    }
    function showPreview(b) {
      clearPreview();
      var t = el('table', { className: 'cd-cx-table' });
      var thead = el('tr', {});
      b.head.forEach(function (h, i) { thead.appendChild(el('th', { className: i < 2 ? '' : 'cd-cx-r' }, h)); });
      t.appendChild(el('thead', {}, [thead]));
      var tb = el('tbody', {});
      function cell(v, i, h) {
        if (v === null || v === undefined) { return el('td', { className: i < 2 ? '' : 'cd-cx-r' }, ''); }
        if (typeof v === 'number') {
          var pctCol = /%/.test(h);
          return el('td', { className: 'cd-cx-r' }, pctCol ? v.toFixed(1) + '%' : fmt.number(v));
        }
        return el('td', {}, String(v));
      }
      b.rows.forEach(function (r) { tb.appendChild(el('tr', {}, r.map(function (v, i) { return cell(v, i, b.head[i]); }))); });
      var tot = el('tr', { className: 'cd-cx-tot' }, b.total.map(function (v, i) { return cell(v, i, b.head[i]); }));
      tb.appendChild(tot);
      t.appendChild(tb);
      previewBox.appendChild(el('div', { className: 'cd-cx-prevhead' }, 'First ' + Math.min(8, b.count) + ' of ' + b.count + ' rows (the Excel file has all of them)'));
      previewBox.appendChild(el('div', { className: 'cd-cx-prevscroll' }, [t]));
    }
    btnPreview.onclick = function () {
      var q = check2(); if (!q) { return; }
      say('Preparing the preview...'); clearPreview();
      post('customPreview', q.p, function (b, err) {
        if (err) { say(err, 'bad'); return; }
        say(b.count + ' rows ready' + (b.notes && b.notes.length ? ' · ' + b.notes.join('; ') : ''), 'ok');
        showPreview(b);
      });
    };
    btnGo.onclick = function () {
      var q = check2(); if (!q) { return; }
      say('Checking your choices...');
      post('customPreview', q.p, function (b, err) {
        if (err) { say(err, 'bad'); return; }
        var name = 'cd-cx-frame';
        var fr = global.document.getElementById(name);
        if (!fr) {
          fr = el('iframe', { id: name, name: name, style: { display: 'none' } });
          global.document.body.appendChild(fr);
        }
        var f = el('form', { method: 'post', action: url, target: name, style: { display: 'none' } });
        function hid(k, v) { var i = el('input', { type: 'hidden', name: k }); i.value = v; f.appendChild(i); }
        hid('action', 'custom');
        for (var k in q.p) { if (Object.prototype.hasOwnProperty.call(q.p, k) && q.p[k] !== '') { hid(k, q.p[k]); } }
        if (global.__CEO_TOKEN) { hid('t', global.__CEO_TOKEN); }
        global.document.body.appendChild(f);
        f.submit();
        global.setTimeout(function () { if (f.parentNode) { f.parentNode.removeChild(f); } }, 2000);
        persist();
        say('Your Excel file is downloading (' + b.count + ' rows).', 'ok');
      });
    };

    M = { open: open, close: close };
  }

  CeoDash.customExcel = { mount: mount, open: function () { if (M) { M.open(); } } };
})(window);

