/*
 * CEO Loan Intelligence Dashboard - front end (ES5, runs in IE11)
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
var CEO_ASSET_BASE = (window.__CEO_CTX || '') + '/Assets/Images/';

/* ---------- DOM helpers ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  function isNode(x) {
    return x && typeof x === 'object' && typeof x.nodeType === 'number';
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);

    if (attrs) {
      for (var key in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, key)) { continue; }
        var value = attrs[key];
        if (value === undefined || value === null || value === false) { continue; }
        if (key === 'className') {
          node.className = value;
        } else if (key === 'style' && typeof value === 'object') {
          for (var styleKey in value) {
            if (Object.prototype.hasOwnProperty.call(value, styleKey)) { node.style[styleKey] = value[styleKey]; }
          }
        } else if (key.indexOf('on') === 0 && typeof value === 'function') {
          var evtName = key.substring(2).toLowerCase();
          if (node.addEventListener) { node.addEventListener(evtName, value, false); }
          else { node.attachEvent('on' + evtName, value); }
        } else if (key === 'html') {
          node.innerHTML = value;
        } else {
          node.setAttribute(key, value);
        }
      }
    }

    if (children !== undefined && children !== null) {
      function appendChildItem(c) {
        if (c === undefined || c === null || c === false) { return; }
        if (Object.prototype.toString.call(c) === '[object Array]') {
          for (var j = 0; j < c.length; j++) { appendChildItem(c[j]); }
        } else if (isNode(c)) {
          node.appendChild(c);
        } else {
          node.appendChild(document.createTextNode(String(c)));
        }
      }
      appendChildItem(children);
    }

    return node;
  }

  function clear(node) {
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  function text(str) { return document.createTextNode(str); }

  CeoDash.core.dom = { el: el, clear: clear, text: text };
})(window);
/* ---------- Popups: every popup closes on navigation ---------- */
(function (global) {
  'use strict';
  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};
  var openList = [];
  function add(close) {
    openList.push(close);
    return function () {
      for (var i = 0; i < openList.length; i++) { if (openList[i] === close) { openList.splice(i, 1); return; } }
    };
  }
  function closeAll() {
    var list = openList.slice();
    openList = [];
    for (var i = 0; i < list.length; i++) {
      try { list[i](); } catch (e) { if (global.console) { global.console.error(e); } }
    }
  }
  CeoDash.core.overlays = { add: add, closeAll: closeAll };
})(window);
/* ---------- Number, money and date formatting ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  function indianGroup(numStr) {
    var isNeg = numStr.charAt(0) === '-';
    if (isNeg) { numStr = numStr.substring(1); }
    var lastThree = numStr.substring(numStr.length - 3);
    var rest = numStr.substring(0, numStr.length - 3);
    if (rest !== '') {
      lastThree = ',' + lastThree;
      rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    }
    var result = rest + lastThree;
    return isNeg ? '-' + result : result;
  }

  var NA_TEXT = '—';
  function missing(v) { return v === null || v === undefined || typeof v !== 'number' || !isFinite(v); }

  function rupees(amount) {
    if (missing(amount)) { return NA_TEXT; }
    var whole = Math.round(amount);
    return 'Rs. ' + indianGroup(String(Math.abs(whole))) + (whole < 0 ? '' : '');
  }

  function compactCr(amount) {
    if (missing(amount)) { return NA_TEXT; }
    var abs = Math.abs(amount);
    var sign = amount < 0 ? '-' : '';
    if (abs >= 10000000) { return sign + '₹' + (abs / 10000000).toFixed(2) + ' Cr'; }
    if (abs >= 100000) { return sign + '₹' + (abs / 100000).toFixed(2) + ' L'; }
    if (abs >= 1000) { return sign + '₹' + (abs / 1000).toFixed(1) + ' K'; }
    return sign + '₹' + Math.round(abs);
  }

  function percent(fraction, decimals) {
    if (missing(fraction)) { return NA_TEXT; }
    var d = decimals === undefined ? 1 : decimals;
    return (fraction * 100).toFixed(d) + '%';
  }

  function signedPercent(fraction, decimals) {
    if (missing(fraction)) { return NA_TEXT; }
    var val = fraction * 100;
    var d = decimals === undefined ? 1 : decimals;
    return (val >= 0 ? '+' : '') + val.toFixed(d) + '%';
  }

  function number(n) {
    if (missing(n)) { return NA_TEXT; }
    return indianGroup(String(Math.round(n)));
  }

  function performanceState(pct, kind) {
    if (pct === null || pct === undefined || isNaN(pct)) { return 'no-data'; }
    if (kind === 'repayment') {
      if (pct >= 92) { return 'healthy'; }
      if (pct >= 90) { return 'watch'; }
      if (pct >= 88) { return 'attention'; }
      return 'critical';
    }
    if (pct >= 95) { return 'healthy'; }
    if (pct >= 85) { return 'watch'; }
    if (pct >= 70) { return 'attention'; }
    return 'critical';
  }
  var STATE_ROLE = { healthy: 'repay', watch: 'primary', attention: 'primary', critical: 'risk', 'no-data': 'textDim' };
  var STATE_LABEL = { healthy: 'Strong', watch: 'Good', attention: 'Attention', critical: 'Concern', 'no-data': 'No data' };
  function stateRole(state) { return STATE_ROLE[state] || STATE_ROLE['no-data']; }
  function stateLabel(state) { return STATE_LABEL[state] || STATE_LABEL['no-data']; }

  function targetBlock(target, actual) {
    var achievementPct = (target > 0 && !missing(actual)) ? (actual / target) * 100 : NaN;
    return {
      target: target,
      actual: actual,
      achievementPct: achievementPct,
      gap: actual - target,
      state: performanceState(achievementPct)
    };
  }

  CeoDash.core.format = {
    missing: missing,
    NA_TEXT: NA_TEXT,
    rupees: rupees,
    compactCr: compactCr,
    percent: percent,
    signedPercent: signedPercent,
    number: number,
    performanceState: performanceState,
    stateRole: stateRole,
    stateLabel: stateLabel,
    targetBlock: targetBlock
  };
})(window);
/* ---------- A loan's arrears line (shown on a woman's loans) ---------- */
(function (global) {
  'use strict';
  var CeoDash = global.CeoDash = global.CeoDash || {};
  // l.arrears / l.balance / l.emi come from the daily loan status table; absent for closed loans or when overdue is not available
  CeoDash.core.arrearsLine = function (l) {
    if (!l || l.arrears === undefined || l.arrears === null) { return null; }
    var fmt = CeoDash.core.format, behind = l.arrears > 0;
    return CeoDash.core.dom.el('div', { className: 'cd-lg-arrears ' + (behind ? 'cd-lg-arrears--bad' : 'cd-lg-arrears--ok') },
      behind ? 'Overdue ' + fmt.rupees(l.arrears) + ' \u00b7 balance ' + fmt.rupees(l.balance) + (l.emi > 0 ? ' \u00b7 instalment ' + fmt.rupees(l.emi) : '')
             : 'Up to date \u00b7 balance ' + fmt.rupees(l.balance));
  };
})(window);
/* ---------- Small SVG chart helpers ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (var key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) {
          node.setAttribute(key, attrs[key]);
        }
      }
    }
    return node;
  }

  function createSvg(width, height, extraAttrs) {
    var attrs = {
      xmlns: SVG_NS,
      viewBox: '0 0 ' + width + ' ' + height,
      width: width,
      height: height,
      preserveAspectRatio: 'xMidYMid meet'
    };
    if (extraAttrs) {
      for (var k in extraAttrs) {
        if (Object.prototype.hasOwnProperty.call(extraAttrs, k)) { attrs[k] = extraAttrs[k]; }
      }
    }
    return el('svg', attrs);
  }

  function textEl(x, y, str, opts) {
    opts = opts || {};
    var t = el('text', {
      x: x, y: y,
      'text-anchor': opts.anchor || 'start',
      'font-size': opts.fontSize || 12,
      'font-family': opts.fontFamily || "'Segoe UI', Tahoma, Arial, sans-serif",
      fill: opts.fill || 'currentColor',
      'font-weight': opts.weight || 'normal'
    });
    t.appendChild(document.createTextNode(str));
    return t;
  }

  function progressRing(cx, cy, r, strokeWidth, fraction, color, trackColor) {
    var group = el('g', {});
    var circumference = 2 * Math.PI * r;
    var clamped = Math.max(0, Math.min(1, fraction));

    var track = el('circle', {
      cx: cx, cy: cy, r: r, fill: 'none',
      stroke: trackColor || '#e2e5ea',
      'stroke-width': strokeWidth
    });

    var progress = el('circle', {
      cx: cx, cy: cy, r: r, fill: 'none',
      stroke: color,
      'stroke-width': strokeWidth,
      'stroke-linecap': 'round',
      'stroke-dasharray': circumference,
      'stroke-dashoffset': circumference * (1 - clamped),
      transform: 'rotate(-90 ' + cx + ' ' + cy + ')'
    });

    group.appendChild(track);
    group.appendChild(progress);
    return group;
  }

  function sparkline(values, width, height, color, opts) {
    opts = opts || {};
    var padding = opts.padding || 2;
    if (!values || !values.length) { return el('g', {}); }

    var min = values[0], max = values[0], i;
    for (i = 1; i < values.length; i++) {
      if (values[i] < min) { min = values[i]; }
      if (values[i] > max) { max = values[i]; }
    }
    var range = (max - min) || 1;
    var step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

    var points = [];
    for (i = 0; i < values.length; i++) {
      var x = padding + step * i;
      var y = height - padding - ((values[i] - min) / range) * (height - padding * 2);
      points.push(x.toFixed(2) + ',' + y.toFixed(2));
    }

    var line = el('polyline', {
      points: points.join(' '),
      fill: 'none',
      stroke: color,
      'stroke-width': opts.strokeWidth || 2,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    });

    var group = el('g', {});
    group.appendChild(line);

    if (opts.showLastPoint) {
      var lastCoords = points[points.length - 1].split(',');
      group.appendChild(el('circle', {
        cx: lastCoords[0], cy: lastCoords[1], r: opts.pointRadius || 3, fill: color
      }));
    }
    return group;
  }

  function flowRibbon(x1, yTop1, yBottom1, x2, yTop2, yBottom2, color, opacity) {
    var midX = (x1 + x2) / 2;
    var d = [
      'M', x1, yTop1,
      'C', midX, yTop1, midX, yTop2, x2, yTop2,
      'L', x2, yBottom2,
      'C', midX, yBottom2, midX, yBottom1, x1, yBottom1,
      'Z'
    ].join(' ');

    return el('path', {
      d: d,
      fill: color,
      'fill-opacity': opacity !== undefined ? opacity : 0.55,
      stroke: 'none'
    });
  }

  function node(cx, cy, r, color, opts) {
    opts = opts || {};
    return el('circle', {
      cx: cx, cy: cy, r: r,
      fill: color,
      stroke: opts.stroke || 'none',
      'stroke-width': opts.strokeWidth || 0
    });
  }

  function arcSegment(cx, cy, rOuter, rInner, startDeg, endDeg, color) {
    function point(r, deg) {
      var rad = (deg - 90) * Math.PI / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }
    var largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
    var p1 = point(rOuter, startDeg), p2 = point(rOuter, endDeg);
    var p3 = point(rInner, endDeg), p4 = point(rInner, startDeg);

    var d = [
      'M', p1.x, p1.y,
      'A', rOuter, rOuter, 0, largeArc, 1, p2.x, p2.y,
      'L', p3.x, p3.y,
      'A', rInner, rInner, 0, largeArc, 0, p4.x, p4.y,
      'Z'
    ].join(' ');

    return el('path', { d: d, fill: color });
  }

  CeoDash.core.svg = {
    NS: SVG_NS,
    el: el,
    createSvg: createSvg,
    text: textEl,
    progressRing: progressRing,
    sparkline: sparkline,
    flowRibbon: flowRibbon,
    node: node,
    arcSegment: arcSegment
  };
})(window);
/* ---------- Application state ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  var listeners = [];

  var current = {
    chapter: 'pulse',
    drillPath: [],
    filters: {},
    themeId: 'executive'
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function notify() {
    var snapshot = clone(current);
    for (var i = 0; i < listeners.length; i++) {
      listeners[i](snapshot);
    }
  }

  var State = {
    get: function () {
      return clone(current);
    },
    set: function (partial, options) {
      var silent = options && options.silent;
      if (partial.chapter !== undefined) { current.chapter = partial.chapter; }
      if (partial.drillPath !== undefined) { current.drillPath = partial.drillPath; }
      if (partial.filters !== undefined) { current.filters = partial.filters; }
      if (partial.themeId !== undefined) { current.themeId = partial.themeId; }
      if (!silent) { notify(); }
    },
    setFilter: function (name, value) {
      current.filters[name] = value;
      notify();
    },
    clearFilters: function () {
      current.filters = {};
      notify();
    },
    subscribe: function (fn) {
      listeners.push(fn);
      return function unsubscribe() {
        var idx = listeners.indexOf(fn);
        if (idx !== -1) { listeners.splice(idx, 1); }
      };
    }
  };

  CeoDash.core.state = State;
})(window);
/* ---------- Hash router (#/chapter/level/id ...) ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  var CHAPTER_IDS = [
    'pulse', 'member-profile', 'loan-journey', 'repayment-journey',
    'payment-behavior', 'performance-map', 'calendar'
  ];

  function isKnownChapter(id) {
    for (var i = 0; i < CHAPTER_IDS.length; i++) {
      if (CHAPTER_IDS[i] === id) { return true; }
    }
    return false;
  }

  function parseHash(hash) {
    var raw = hash.replace(/^#\/?/, '');
    var parts = raw.length ? raw.split('/') : [];
    var chapter = parts.length ? decodeURIComponent(parts[0]) : 'pulse';
    if (!isKnownChapter(chapter)) { chapter = 'pulse'; }

    var drillPath = [];
    var i = 1;
    while (i + 1 < parts.length + 1 && parts[i] !== undefined && parts[i + 1] !== undefined) {
      drillPath.push({
        level: decodeURIComponent(parts[i]),
        id: decodeURIComponent(parts[i + 1])
      });
      i += 2;
    }

    return { chapter: chapter, drillPath: drillPath };
  }

  function buildHash(chapter, drillPath) {
    var segments = [encodeURIComponent(chapter)];
    for (var i = 0; i < drillPath.length; i++) {
      segments.push(encodeURIComponent(drillPath[i].level));
      segments.push(encodeURIComponent(drillPath[i].id));
    }
    return '#/' + segments.join('/');
  }

  var applyingFromHash = false;

  function onHashChange() {
    var parsed = parseHash(global.location.hash);
    var now = CeoDash.core.state.get();
    if (now.chapter === parsed.chapter && JSON.stringify(now.drillPath) === JSON.stringify(parsed.drillPath)) { return; }
    applyingFromHash = true;
    CeoDash.core.state.set({ chapter: parsed.chapter, drillPath: parsed.drillPath, filters: {} });
    applyingFromHash = false;
  }

  var Router = {
    CHAPTER_IDS: CHAPTER_IDS,

    init: function () {
      var first = global.__CEO_INITIAL_CHAPTER;
      var chapter = first && isKnownChapter(first) ? first : 'pulse';
      var hash = buildHash(chapter, []);
      if (global.location.hash !== hash && global.location.replace) {
        var href = String(global.location.href).split('#')[0];
        global.location.replace(href + hash);
      }
      CeoDash.core.state.set({ chapter: chapter, drillPath: [], filters: {} });
      if (global.addEventListener) {
        global.addEventListener('hashchange', onHashChange, false);
      } else if (global.attachEvent) {
        global.attachEvent('onhashchange', onHashChange);
      }
    },

    navigate: function (chapter, drillPath) {
      var hash = buildHash(chapter, drillPath || []);
      if (global.location.hash === hash) {
        CeoDash.core.state.set({ chapter: chapter, drillPath: drillPath || [], filters: {} });
        return;
      }
      global.location.hash = hash;
    },

    drillInto: function (level, id) {
      var current = CeoDash.core.state.get();
      var nextPath = current.drillPath.concat([{ level: level, id: id }]);
      Router.navigate(current.chapter, nextPath);
    },

    drillToDepth: function (depth) {
      var current = CeoDash.core.state.get();
      Router.navigate(current.chapter, current.drillPath.slice(0, depth));
    },

    goToChapter: function (chapter, drillPath) {
      Router.navigate(chapter, drillPath || []);
    },

    replaceRoute: function (chapter, drillPath) {
      var hash = buildHash(chapter, drillPath || []);
      if (global.location.hash !== hash && global.location.replace) {
        global.location.replace(String(global.location.href).split('#')[0] + hash);
      }
      CeoDash.core.state.set({ chapter: chapter, drillPath: drillPath || [], filters: {} });
    }
  };

  CeoDash.core.router = Router;
})(window);
/* ---------- Context shared between chapters ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  var context = {
    periodType: 'yearly',
    periodValue: null,
    districtId: null,
    mandalId: null,
    voId: null,
    shgId: null,
    womanId: null
  };

  var listeners = [];

  function get() { return context; }

  function set(patch) {
    var key;
    for (key in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) { context[key] = patch[key]; }
    }
    for (var i = 0; i < listeners.length; i++) { listeners[i](context); }
  }

  function subscribe(fn) { listeners.push(fn); }

  CeoDash.core.context = { get: get, set: set, subscribe: subscribe };
})(window);
/* ---------- Theme ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  var THEMES = {
    executive: {
      id: 'executive',
      name: 'Executive Light',
      description: 'High-contrast Stree Nidhi executive dashboard with emerald, sapphire and amber accents.',
      colors: {
        bg: '#FFFFFF', bg2: '#F8FAFC', bgGlow: '#FFFFFF',
        surface: '#FFFFFF', surface2: '#F1F5F9', surfaceHover: '#E2E8F0',
        border: '#cbd5e1', borderStrong: '#94a3b8',
        primary: '#b45309', primarySoft: 'rgba(217,119,6,0.14)', primaryHover: '#b45309', primaryInk: '#0f172a',
        loan: '#2563eb', loanSoft: 'rgba(37,99,235,0.12)',
        repay: '#059669', repaySoft: 'rgba(5,150,105,0.13)',
        risk: '#dc2626', riskSoft: 'rgba(220,38,38,0.12)',
        text: '#0f172a', textMuted: '#334155', textDim: '#64748b'
      }
    }
  };

  var FONT_DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif";
  var FONT_BODY = "'IBM Plex Sans', 'Segoe UI', Tahoma, Arial, sans-serif";
  var FONT_MONO = "'IBM Plex Mono', 'Consolas', 'Courier New', monospace";

  var ROLE_KEYS = [
    'bg', 'bg2', 'bgGlow', 'surface', 'surface2', 'surfaceHover',
    'border', 'borderStrong',
    'primary', 'primarySoft', 'primaryHover', 'primaryInk',
    'loan', 'loanSoft', 'repay', 'repaySoft', 'risk', 'riskSoft',
    'text', 'textMuted', 'textDim'
  ];

  function kebab(key) {
    return key.replace(/([A-Z])/g, function (m, c) { return '-' + c.toLowerCase(); });
  }

  function hexToRgba(hex, alpha) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) { return hex; }
    var r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function buildCss(theme) {
    var c = theme.colors;
    var rules = [];
    var i, key, kebabKey, value;

    for (i = 0; i < ROLE_KEYS.length; i++) {
      key = ROLE_KEYS[i];
      value = c[key];
      kebabKey = kebab(key);
      rules.push('[data-cd-role~="text-' + kebabKey + '"]{color:' + value + ';}');
      rules.push('[data-cd-role~="bg-' + kebabKey + '"]{background-color:' + value + ';}');
      rules.push('[data-cd-role~="border-' + kebabKey + '"]{border-color:' + value + ';}');
      rules.push('[data-cd-role~="fill-' + kebabKey + '"]{fill:' + value + ';}');
      rules.push('[data-cd-role~="stroke-' + kebabKey + '"]{stroke:' + value + ';}');
    }

    rules.push('html, body {background-color:' + c.bg + ';}');
    rules.push('body {background-image:-ms-radial-gradient(15% 0%, ellipse farthest-corner, ' + c.bgGlow + ' 0%, ' + c.bg + ' 45%, ' + c.bg2 + ' 100%);' +
      'background-image:radial-gradient(120% 140% at 15% 0%, ' + c.bgGlow + ' 0%, ' + c.bg + ' 45%, ' + c.bg2 + ' 100%);' +
      'color:' + c.text + '; font-family:' + FONT_BODY + ';}');
    rules.push('h1, h2, h3, .cd-display {font-family:' + FONT_DISPLAY + ';}');
    rules.push('.cd-num {font-family:' + FONT_MONO + '; font-variant-numeric:tabular-nums;}');
    rules.push('::selection {background:' + c.primarySoft + ';}');

    rules.push('.cd-surface {background-color:' + c.surface + '; border-color:' + c.border + '; box-shadow:0 1px 2px rgba(28,26,20,0.05), 0 1px 8px rgba(28,26,20,0.04);}');
    rules.push('.cd-surface:hover {background-color:' + c.surfaceHover + '; border-color:' + c.borderStrong + '; box-shadow:0 4px 14px rgba(28,26,20,0.08);}');
    rules.push('.cd-surface-2 {background-color:' + c.surface2 + ';}');
    rules.push('.cd-text-muted {color:' + c.textMuted + ';}');
    rules.push('.cd-text-dim {color:' + c.textDim + ';}');
    rules.push('.cd-border {border-color:' + c.border + ';}');
    rules.push('a.cd-link, .cd-link {color:' + c.primary + ';}');

    rules.push('.cd-brand-mark {background-image:conic-gradient(from 210deg, ' + c.primary + ', ' + c.loan + ', ' + c.repay + ', ' + c.primary + '); color:' + c.primaryInk + ';}');

    rules.push('.cd-chapter-nav {background-color:' + c.surface + '; border-color:' + c.border + ';}');
    rules.push('.cd-chapter-nav__item {color:' + c.textMuted + ';}');
    rules.push('.cd-chapter-nav__item:hover {color:' + c.text + '; background-color:' + c.surfaceHover + ';}');
    rules.push('.cd-chapter-nav__item--active {color:' + c.primaryInk + '; background-color:' + c.primary + ';}');

    rules.push('.cd-breadcrumb .cd-breadcrumb__segment {color:' + c.textMuted + ';}');
    rules.push('.cd-breadcrumb .cd-breadcrumb__segment:hover {background-color:' + c.surface + '; color:' + c.text + ';}');
    rules.push('.cd-breadcrumb .cd-breadcrumb__segment--current {color:' + c.primary + ';}');
    rules.push('.cd-breadcrumb .cd-breadcrumb__segment--current:hover {background-color:transparent;}');
    rules.push('.cd-breadcrumb__sep {color:' + c.textDim + ';}');

    rules.push('.cd-pulse-hero__value {color:' + c.primary + ';}');
    rules.push('.cd-pulse-hero__chip {background-color:' + c.repaySoft + '; color:' + c.repay + ';}');
    rules.push('.cd-insight-statement .cd-risk-word {color:' + c.risk + ';}');
    rules.push('.cd-insight-statement strong {color:' + c.text + ';}');

    rules.push('.cd-cta {background-color:' + c.primary + '; color:' + c.bg + ';}');
    rules.push('.cd-cta:hover {background-color:' + c.primaryHover + ';}');

    rules.push('.cd-toggle-btn {color:' + c.textMuted + ';}');
    rules.push('.cd-toggle-btn--active {background-color:' + c.surface2 + '; color:' + c.text + ';}');

    rules.push('.cd-h-row:hover {background-color:' + c.surfaceHover + ';}');
    rules.push('.cd-h-divider {background-color:' + c.border + ';}');
    rules.push('.cd-h-chevron {color:' + c.textDim + ';}');

    rules.push('.cd-flow-node {background-color:' + c.surface2 + '; border-color:' + c.border + ';}');
    rules.push('.cd-flow-node:hover {background-color:' + c.surfaceHover + '; border-color:' + c.primary + ';}');
    rules.push('.cd-flow-node--origin {background-color:' + c.primarySoft + '; border-color:' + c.primary + ';}');
    rules.push('.cd-flow-node--origin:hover {background-color:' + c.primarySoft + ';}');
    rules.push('.cd-flow-node__amt {color:' + c.primary + ';}');

    rules.push('.cd-wf-bar--expected {background-image:linear-gradient(180deg,' + c.loan + ',' + hexToRgba(c.loan, 0.35) + ');}');
    rules.push('.cd-wf-bar--received {background-image:linear-gradient(180deg,' + c.repay + ',' + hexToRgba(c.repay, 0.35) + ');}');
    rules.push('.cd-wf-bar--outstanding {background-image:linear-gradient(180deg,' + c.primary + ',' + hexToRgba(c.primary, 0.35) + ');}');
    rules.push('.cd-wf-bar--overdue {background-image:linear-gradient(180deg,' + c.risk + ',' + hexToRgba(c.risk, 0.35) + ');}');

    rules.push('.cd-attention-card {background-color:' + c.riskSoft + '; border-color:' + hexToRgba(c.risk, 0.35) + ';}');
    rules.push('.cd-attention-card strong {color:' + c.risk + ';}');

    rules.push('.cd-repay-command {background-color:rgba(255,255,255,0.78); border-color:' + c.border + '; box-shadow:0 18px 45px rgba(28,49,36,0.10);}');
    rules.push('.cd-repay-command__summary, .cd-repay-command__evidence {border-color:' + c.border + '; background-color:rgba(255,255,255,0.42);}');
    rules.push('.cd-repay-kicker {color:' + c.repay + ';}');
    rules.push('.cd-repay-hero-value {color:' + c.risk + ';}');
    rules.push('.cd-repay-hero-label {color:' + c.textMuted + ';}');
    rules.push('.cd-repay-stat, .cd-repay-node, .cd-repay-mini, .cd-repay-evidence-card {background-color:rgba(255,255,255,0.78); border-color:' + c.border + '; box-shadow:0 8px 24px rgba(28,49,36,0.06);}');
    rules.push('.cd-repay-stage {background-image:linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,249,236,0.50)), repeating-linear-gradient(90deg, rgba(49,184,95,0.045) 0 1px, transparent 1px 82px); border-color:' + c.border + '; box-shadow:inset 0 1px 0 rgba(255,255,255,0.8);}');
    rules.push('.cd-repay-pill {background-color:' + c.repaySoft + '; color:' + c.repay + ';}');
    rules.push('.cd-repay-node__value {color:' + c.textMuted + ';}');
    rules.push('.cd-repay-bar-dot {background-color:' + c.repaySoft + '; color:' + c.repay + ';}');
    rules.push('.cd-repay-bar-track {background-color:#E7E4D9;}');
    rules.push('.cd-repay-bar-fill {background-image:linear-gradient(90deg,' + c.repay + ',' + c.primary + ');}');

    return rules.join('\n');
  }

  var STYLE_TAG_ID = 'ceo-dash-theme';

  function ensureStyleTag() {
    var tag = document.getElementById(STYLE_TAG_ID);
    if (!tag) {
      tag = document.createElement('style');
      tag.id = STYLE_TAG_ID;
      tag.type = 'text/css';
      document.getElementsByTagName('head')[0].appendChild(tag);
    }
    return tag;
  }

  function setStyleContent(tag, css) {
    if (tag.styleSheet) {
      tag.styleSheet.cssText = css;
    } else {
      tag.innerHTML = '';
      tag.appendChild(document.createTextNode(css));
    }
  }

  var listeners = [];

  var Theme = {
    get: function (themeId) {
      return THEMES[themeId] || THEMES.executive;
    },

    getTokens: function () {
      var current = CeoDash.core.state.get().themeId;
      return Theme.get(current).colors;
    },

    apply: function (themeId) {
      var theme = Theme.get(themeId);
      var tag = ensureStyleTag();
      setStyleContent(tag, buildCss(theme));

      var root = document.documentElement;
      root.className = root.className.replace(/\bcd-theme-[a-z]+\b/g, '').replace(/\s+$/, '');
      root.className = (root.className + ' cd-theme-' + theme.id).replace(/^\s+/, '');

      CeoDash.core.state.set({ themeId: theme.id });

      for (var i = 0; i < listeners.length; i++) { listeners[i](theme); }
    },

    onChange: function (fn) {
      listeners.push(fn);
    }
  };

  CeoDash.core.theme = Theme;
})(window);
/* ---------- Page transitions ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  function prefersReducedMotion() {
    if (!global.matchMedia) { return false; }
    var mq = global.matchMedia('(prefers-reduced-motion: reduce)');
    return !!(mq && mq.matches);
  }

  function rect(el) {
    var r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  function snapshot(el) {
    if (!el) { return null; }
    return rect(el);
  }

  function playFlip(el, firstRect, duration) {
    if (!el || !firstRect || prefersReducedMotion()) { return; }
    duration = duration || 320;

    var last = rect(el);
    var dx = firstRect.left - last.left;
    var dy = firstRect.top - last.top;
    var sx = last.width ? firstRect.width / last.width : 1;
    var sy = last.height ? firstRect.height / last.height : 1;

    el.style.transformOrigin = 'top left';
    el.style.transition = 'none';
    el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
    el.style.opacity = '0.6';

    el.offsetHeight;

    el.style.transition = 'transform ' + duration + 'ms ease, opacity ' + duration + 'ms ease';
    el.style.transform = 'translate(0,0) scale(1,1)';
    el.style.opacity = '1';

    global.setTimeout(function () {
      el.style.transition = '';
      el.style.transform = '';
      el.style.transformOrigin = '';
    }, duration + 30);
  }

  function fadeIn(el, duration) {
    if (!el) { return; }
    duration = duration || 220;
    if (prefersReducedMotion()) { el.style.opacity = '1'; return; }
    el.style.opacity = '0';
    el.style.transition = 'opacity ' + duration + 'ms ease';
    global.setTimeout(function () {
      el.style.opacity = '1';
    }, 10);
    global.setTimeout(function () {
      el.style.transition = '';
    }, duration + 30);
  }

  function slideIn(el, fromSide, duration) {
    if (!el) { return; }
    duration = duration || 260;
    if (prefersReducedMotion()) { el.style.transform = ''; el.style.opacity = '1'; return; }
    var offset = fromSide === 'left' ? '-16px' : '16px';
    el.style.opacity = '0';
    el.style.transform = 'translateX(' + offset + ')';
    el.style.transition = 'none';
    el.offsetHeight;
    el.style.transition = 'transform ' + duration + 'ms ease, opacity ' + duration + 'ms ease';
    el.style.transform = 'translateX(0)';
    el.style.opacity = '1';
    global.setTimeout(function () {
      el.style.transition = '';
    }, duration + 30);
  }

  function staggerChildren(container, selector, maxItems) {
    if (!container || prefersReducedMotion()) { return; }
    maxItems = maxItems || 12;
    var items = selector ? container.querySelectorAll(selector) : container.children;
    if (!items || !items.length) { return; }
    for (var i = 0; i < items.length && i < maxItems; i++) {
      var item = items[i];
      if (!item) { continue; }
      item.className = (item.className + ' cd-stagger-item cd-stagger-' + (i + 1)).replace(/^\s+/, '');
    }
  }

  function countUp(node, targetNum, prefix, suffix, duration) {
    if (!node) { return; }
    prefix = prefix || '';
    suffix = suffix || '';
    if (prefersReducedMotion()) {
      node.textContent = prefix + targetNum + suffix;
      return;
    }
    duration = duration || 600;
    var startTime = null;
    var startVal = 0;
    var parsed = parseFloat(String(targetNum).replace(/[^0-9.-]/g, '')) || 0;
    var isDecimal = String(targetNum).indexOf('.') !== -1;

    function step(timestamp) {
      if (!startTime) { startTime = timestamp; }
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 3);
      var current = startVal + (parsed - startVal) * ease;
      node.textContent = prefix + (isDecimal ? current.toFixed(1) : Math.round(current)) + suffix;
      if (progress < 1) {
        if (global.requestAnimationFrame) { global.requestAnimationFrame(step); }
        else { global.setTimeout(function () { step(new Date().getTime()); }, 16); }
      } else {
        node.textContent = prefix + targetNum + suffix;
      }
    }

    if (global.requestAnimationFrame) { global.requestAnimationFrame(step); }
    else { global.setTimeout(function () { step(new Date().getTime()); }, 16); }
  }

  function triggerRipple(e, hostEl) {
    if (!hostEl || prefersReducedMotion()) { return; }
    var rect = hostEl.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 1.5;
    var clickX = (e && typeof e.clientX === 'number') ? e.clientX : (rect.left + rect.width / 2);
    var clickY = (e && typeof e.clientY === 'number') ? e.clientY : (rect.top + rect.height / 2);
    var x = clickX - rect.left - (size / 2);
    var y = clickY - rect.top - (size / 2);

    if (hostEl.className.indexOf('cd-ripple-host') === -1) {
      hostEl.className = (hostEl.className + ' cd-ripple-host').replace(/^\s+/, '');
    }

    var wave = document.createElement('span');
    wave.className = 'cd-ripple-wave';
    wave.style.width = size + 'px';
    wave.style.height = size + 'px';
    wave.style.left = x + 'px';
    wave.style.top = y + 'px';
    hostEl.appendChild(wave);

    global.setTimeout(function () {
      if (wave && wave.parentNode) {
        wave.parentNode.removeChild(wave);
      }
    }, 550);
  }

  CeoDash.core.transitions = {
    prefersReducedMotion: prefersReducedMotion,
    snapshot: snapshot,
    playFlip: playFlip,
    fadeIn: fadeIn,
    slideIn: slideIn,
    staggerChildren: staggerChildren,
    countUp: countUp,
    triggerRipple: triggerRipple
  };
})(window);
/* ---------- Toast messages ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};
  var el = CeoDash.core.dom.el;

  var container = null;
  function ensureContainer() {
    if (!container || !container.parentNode) {
      container = document.getElementById('cd-toast-container');
      if (!container) {
        container = el('div', { id: 'cd-toast-container', role: 'region', 'aria-live': 'polite' });
        document.body.appendChild(container);
      }
    }
    return container;
  }

  var TYPE_ICONS = {
    success: '\u2713',
    info: '\u2139',
    warning: '\u26A0',
    danger: '\u2715'
  };

  function show(opts) {
    if (typeof opts === 'string') {
      opts = { title: 'Notification', message: opts, type: 'info' };
    }
    opts = opts || {};
    var type = opts.type || 'success';
    var title = opts.title || (type === 'success' ? 'Done' : 'Alert');
    var message = opts.message || '';
    var duration = typeof opts.duration === 'number' ? opts.duration : 4200;

    var root = ensureContainer();

    var iconEl = el('div', { className: 'cd-toast__icon' }, TYPE_ICONS[type] || '\u2713');
    var titleEl = el('div', { className: 'cd-toast__title' }, title);
    var descEl = el('div', { className: 'cd-toast__desc' }, message);
    var bodyEl = el('div', { className: 'cd-toast__body' }, [titleEl, descEl]);

    var progressFill = el('div', {
      className: 'cd-toast__progress-fill',
      style: { animationDuration: (duration / 1000) + 's' }
    });
    var progressEl = el('div', { className: 'cd-toast__progress' }, [progressFill]);

    var toastEl;
    function dismiss() {
      if (!toastEl || !toastEl.parentNode) { return; }
      toastEl.style.animation = 'cdToastFadeOut 0.24s ease-out forwards';
      global.setTimeout(function () {
        if (toastEl && toastEl.parentNode) {
          toastEl.parentNode.removeChild(toastEl);
        }
      }, 250);
    }

    var closeBtn = el('button', {
      type: 'button',
      className: 'cd-toast__close',
      'aria-label': 'Close',
      onClick: dismiss
    }, '\u00D7');

    toastEl = el('div', {
      className: 'cd-toast cd-toast--' + type,
      role: 'alert'
    }, [iconEl, bodyEl, closeBtn, progressEl]);

    root.appendChild(toastEl);

    if (duration > 0) {
      global.setTimeout(dismiss, duration);
    }

    return { dismiss: dismiss };
  }

  CeoDash.core.toast = {
    show: show,
    success: function (title, msg) { return show({ title: title, message: msg, type: 'success' }); },
    info: function (title, msg) { return show({ title: title, message: msg, type: 'info' }); },
    warning: function (title, msg) { return show({ title: title, message: msg, type: 'warning' }); },
    danger: function (title, msg) { return show({ title: title, message: msg, type: 'danger' }); }
  };
})(window);
/* ---------- Virtual list for long rankings ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  function VirtualList(container, options) {
    this.container = container;
    this.items = options.items || [];
    this.itemHeight = options.itemHeight || 40;
    this.renderRow = options.renderRow;
    this.overscan = options.overscan || 6;
    this._build();
  }

  VirtualList.prototype._build = function () {
    while (this.container.firstChild) { this.container.removeChild(this.container.firstChild); }
    this.container.className = (this.container.className + ' cd-virtual-viewport').replace(/^\s+/, '');

    this.sizer = document.createElement('div');
    this.sizer.style.position = 'relative';
    this.sizer.style.height = (this.items.length * this.itemHeight) + 'px';

    this.content = document.createElement('div');
    this.content.style.position = 'absolute';
    this.content.style.left = '0';
    this.content.style.right = '0';
    this.content.style.top = '0';

    this.sizer.appendChild(this.content);
    this.container.appendChild(this.sizer);

    var self = this;
    this._onScroll = function () { self._render(); };
    if (this.container.addEventListener) {
      this.container.addEventListener('scroll', this._onScroll, false);
    } else if (this.container.attachEvent) {
      this.container.attachEvent('onscroll', this._onScroll);
    }
    this._render();
  };

  VirtualList.prototype._render = function () {
    var scrollTop = this.container.scrollTop;
    var viewportHeight = this.container.clientHeight || 400;
    var start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan);
    var visibleCount = Math.ceil(viewportHeight / this.itemHeight) + this.overscan * 2;
    var end = Math.min(this.items.length, start + visibleCount);

    this.content.style.top = (start * this.itemHeight) + 'px';
    while (this.content.firstChild) { this.content.removeChild(this.content.firstChild); }

    for (var i = start; i < end; i++) {
      var rowEl = this.renderRow(this.items[i], i);
      rowEl.style.height = this.itemHeight + 'px';
      rowEl.style.boxSizing = 'border-box';
      this.content.appendChild(rowEl);
    }
  };

  VirtualList.prototype.setItems = function (items) {
    this.items = items || [];
    this.sizer.style.height = (this.items.length * this.itemHeight) + 'px';
    this.container.scrollTop = 0;
    this._render();
  };

  VirtualList.prototype.refresh = function () {
    this._render();
  };

  VirtualList.prototype.destroy = function () {
    if (this.container.removeEventListener) {
      this.container.removeEventListener('scroll', this._onScroll, false);
    } else if (this.container.detachEvent) {
      this.container.detachEvent('onscroll', this._onScroll);
    }
  };

  CeoDash.core.VirtualList = VirtualList;
})(window);
/* ---------- Hierarchy lookups ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  var LEVEL_ORDER = ['org', 'region', 'office', 'vo', 'shg', 'borrower'];

  function resolve(data, drillPath) {
    var parent = data.org;
    var depth = drillPath.length;

    for (var i = 0; i < depth; i++) {
      if (data.ensureChildren) { data.ensureChildren(parent); }
      parent = data.byId[drillPath[i].id];
      if (!parent) { parent = data.org; break; }
    }
    if (data.ensureChildren) { data.ensureChildren(parent); }

    var childLevel = LEVEL_ORDER[LEVEL_ORDER.indexOf(parent.level) + 1];
    var children;

    if (childLevel === 'region') { children = data.regions; }
    else if (childLevel === 'office') { children = parent.officeIds.map(function (id) { return data.byId[id]; }); }
    else if (childLevel === 'vo') { children = parent.voIds.map(function (id) { return data.byId[id]; }); }
    else if (childLevel === 'shg') { children = parent.shgIds.map(function (id) { return data.byId[id]; }); }
    else if (childLevel === 'borrower') { children = data.getBorrowers(parent.id); }
    else { children = []; }

    return { parent: parent, children: children, childLevel: childLevel };
  }

  function findDistrictId(drillPath) {
    for (var i = 0; i < drillPath.length; i++) {
      if (drillPath[i].level === 'region') { return drillPath[i].id; }
    }
    return null;
  }

  CeoDash.core.hierarchy = { resolve: resolve, LEVEL_ORDER: LEVEL_ORDER, findDistrictId: findDistrictId };
})(window);
/* ---------- Chapter navigation bar ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};
  var el = CeoDash.core.dom.el;

  var CHAPTERS = [
    {
      id: 'pulse',
      label: 'Overview',
      iconImg: 'overview-icon.png',
      iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>'
    },
    {
      id: 'loan-journey',
      label: 'Loans Given',
      iconImg: 'money_bag_dark_icon.png',
      iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>'
    },
    {
      id: 'repayment-journey',
      label: 'Repayment & Payments',
      iconImg: 'Path 99035.png',
      iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>'
    },
    {
      id: 'performance-map',
      label: 'Employee Performance',
      iconImg: 'person_icon.png',
      iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'
    },
    {
      id: 'calendar',
      label: 'Calendar',
      iconImg: 'calendar_icon.png',
      iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'
    }
  ];

  function render(container, activeChapterId) {
    while (container.firstChild) { container.removeChild(container.firstChild); }

    var items = CHAPTERS.map(function (chapter) {
      var isActive = chapter.id === activeChapterId;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-item-custom' + (isActive ? ' active' : '');
      if (isActive) { btn.setAttribute('aria-current', 'page'); }
      btn.innerHTML =
        '<span class="nav-item-icon">' +
        '  <span style="display:inline-block;">' + chapter.iconSvg + '</span>' +
        '</span>' +
        '<span>' + chapter.label + '</span>';
      btn.onclick = function () {
        CeoDash.core.context.set({ districtId: null, focusManager: null, focusZoneId: null });
        CeoDash.core.router.goToChapter(chapter.id, []);
      };
      return btn;
    });

    for (var i = 0; i < items.length; i++) {
      container.appendChild(items[i]);
    }
  }

  CeoDash.core.chapterNav = { render: render, CHAPTERS: CHAPTERS };
})(window);

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
/* ---------- Drill list rows and status badges ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.components = CeoDash.components || {};
  var dom = CeoDash.core.dom, el = dom.el, svg = CeoDash.core.svg, fmt = CeoDash.core.format;

  var STATE_LABEL = { healthy: 'Healthy', watch: 'Watch', attention: 'Attention', critical: 'Critical' };
  var STATE_ROLE = { healthy: 'repay', watch: 'primary', attention: 'primary', critical: 'risk' };

  function stateBadge(state) {
    state = state || 'healthy';
    var role = STATE_ROLE[state];
    return el('span', { className: 'cd-state-badge', 'data-cd-role': 'text-' + role + ' border-' + role }, STATE_LABEL[state]);
  }

  function JourneyView(options) {
    var children = options.children || [];
    var metrics = options.metrics || [{ label: 'Disbursed', accessor: function (e) { return fmt.compactCr(e.metrics.disbursed); } }];
    var tokens = CeoDash.core.theme.getTokens();
    var roleForIndex = ['primary', 'loan', 'repay', 'risk'];

    var rows = children.map(function (child, index) {
      var state = child.performanceState || child.riskLevel;
      var cycleStatus = options.cycleAccessor ? options.cycleAccessor(child) : null;
      var badgeRole = roleForIndex[index % roleForIndex.length];

      var metricEls = metrics.map(function (m) {
        return el('div', { className: 'cd-h-metric' }, [
          el('div', { className: 'cd-h-metric__label cd-text-dim' }, m.label),
          el('div', { className: 'cd-h-metric__value cd-num' }, m.accessor(child))
        ]);
      });

      return el('div', {
        className: 'cd-h-row', role: 'button', tabIndex: '0',
        onClick: function () { options.onDrill(child); },
        onKeydown: function (evt) { if (evt.keyCode === 13 || evt.keyCode === 32) { options.onDrill(child); } }
      }, [
        el('div', { className: 'cd-h-row-left' }, [
          el('div', {
            className: 'cd-h-badge cd-display',
            'data-cd-role': 'bg-' + badgeRole + '-soft text-' + badgeRole
          }, child.name.charAt(0)),
          el('div', {}, [
            el('div', { className: 'cd-h-name' }, [child.name, state ? stateBadge(state) : null, cycleStatus ? cycleTag(cycleStatus) : null]),
            el('div', { className: 'cd-h-sub cd-text-dim' }, describeChildren(child))
          ])
        ]),
        el('div', { className: 'cd-h-metrics' }, metricEls),
        el('div', { className: 'cd-h-chevron', 'aria-hidden': 'true' }, '->')
      ]);
    });

    var withDividers = [];
    rows.forEach(function (row, i) {
      if (i > 0) { withDividers.push(el('div', { className: 'cd-h-divider' })); }
      withDividers.push(row);
    });

    return el('div', { className: 'cd-hierarchy-panel cd-surface' }, withDividers);
  }

  function describeChildren(entity) {
    if (entity.officeIds) { return entity.officeIds.length + ' offices'; }
    if (entity.voIds) { return entity.voIds.length + ' VOs'; }
    if (entity.shgIds) { return entity.shgIds.length + ' SHGs'; }
    if (entity.memberCount !== undefined) { return entity.memberCount + ' members'; }
    return '';
  }

  var CYCLE_COLOR_ROLE = { cleared: 'repay', active: 'primary', overdue: 'risk' };

  function loanCycleDiagram(shg, options) {
    options = options || {};
    var width = options.width || 420, height = options.height || 70;
    var tokens = CeoDash.core.theme.getTokens();
    var cycles = shg.loanCycles || [];
    var svgRoot = svg.createSvg(width, height);
    var laneY = height / 2;

    svgRoot.appendChild(svg.el('line', { x1: 10, y1: laneY, x2: width - 10, y2: laneY, stroke: tokens.border, 'stroke-width': 2 }));

    var span = 24;
    var usableWidth = width - 40;

    for (var i = 0; i < cycles.length; i++) {
      var cycle = cycles[i];
      var x = 20 + (cycle.startPeriodIndex / span) * usableWidth;
      var role = CYCLE_COLOR_ROLE[cycle.status] || 'primary';
      var color = tokens[role];

      if (cycle.overlapsPrevious) {
        svgRoot.appendChild(svg.el('circle', { cx: x, cy: laneY, r: 9, fill: 'none', stroke: tokens.risk, 'stroke-width': 2, 'stroke-dasharray': '2,2' }));
      }
      svgRoot.appendChild(svg.node(x, laneY, 6, color));
      svgRoot.appendChild(svg.text(x, laneY - 14, 'Cycle ' + (cycle.cycleIndex + 1), { fill: tokens.textDim, fontSize: 10, anchor: 'middle' }));
    }

    var wrap = el('div', { className: 'cd-loan-cycle-diagram' }, svgRoot);
    var legend = el('div', { className: 'cd-loan-cycle-diagram__legend cd-text-dim' },
      'Solid ring = cycle start | Dashed ring = overlapped the previous cycle (repeat borrowing before clearing)');
    return el('div', {}, [wrap, legend]);
  }

  function cycleTag(cycleStatus) {
    if (cycleStatus === 'healthy') { return el('span', { className: 'cd-cycle-tag', 'data-cd-role': 'text-repay bg-repay-soft' }, 'Healthy cycle'); }
    if (cycleStatus === 'risky') { return el('span', { className: 'cd-cycle-tag', 'data-cd-role': 'text-primary bg-primary-soft' }, 'Risky cycle'); }
    return el('span', { className: 'cd-cycle-tag', 'data-cd-role': 'text-risk bg-risk-soft' }, 'High-risk cycle');
  }

  CeoDash.components.JourneyView = JourneyView;
  CeoDash.components.JourneyView.loanCycleDiagram = loanCycleDiagram;
  CeoDash.components.JourneyView.stateBadge = stateBadge;
  CeoDash.components.JourneyView.cycleTag = cycleTag;
})(window);
/* ---------- Top 10 / Bottom 10 rankings ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.components = CeoDash.components || {};
  var el = CeoDash.core.dom.el;
  var fmt = CeoDash.core.format;

  function EntityRanking(options) {
    var entities = options.entities || [];
    var metricAccessor = options.metricAccessor;
    var formatter = options.metricFormatter || function (v) { return fmt.compactCr(v); };
    var trendAccessor = options.trendAccessor;

    var toggleBar = el('div', { className: 'cd-entity-ranking__toggle' });
    var listEl = el('div', { className: 'cd-entity-ranking__list' });
    listEl.style.height = (options.height || 320) + 'px';

    var modes = [{ id: 'top', label: 'Top 10' }, { id: 'bottom', label: 'Bottom 10' }];
    if (trendAccessor) {
      modes.push({ id: 'improving', label: 'Fastest Improving' }, { id: 'declining', label: 'Fastest Declining' });
    }

    var buttons = {};
    var vlist = null;

    function computeList(modeId) {
      var sorted;
      if (modeId === 'top' || modeId === 'bottom') {
        sorted = entities.slice().sort(function (a, b) { return metricAccessor(b) - metricAccessor(a); });
        sorted = modeId === 'top' ? sorted.slice(0, 10) : sorted.slice(-10).reverse();
      } else {
        sorted = entities.slice().sort(function (a, b) { return trendAccessor(b) - trendAccessor(a); });
        sorted = modeId === 'improving' ? sorted.slice(0, 10) : sorted.slice(-10).reverse();
      }
      return sorted;
    }

    function renderRow(entity, index) {
      var value = metricAccessor(entity);
      var state = entity.performanceState || entity.riskLevel;
      return el('div', {
        className: 'cd-ranking-row',
        role: 'button', tabIndex: '0',
        onClick: function () { if (options.onRowClick) { options.onRowClick(entity); } },
        onKeydown: function (evt) {
          if ((evt.keyCode === 13 || evt.keyCode === 32) && options.onRowClick) { options.onRowClick(entity); }
        }
      }, [
        el('span', { className: 'cd-ranking-row__rank cd-text-muted' }, String(index + 1)),
        el('span', { className: 'cd-ranking-row__name' }, entity.name),
        state ? CeoDash.components.JourneyView.stateBadge(state) : null,
        el('span', { className: 'cd-ranking-row__value' }, formatter(value))
      ]);
    }

    function setMode(modeId) {
      for (var k in buttons) {
        if (Object.prototype.hasOwnProperty.call(buttons, k)) {
          buttons[k].className = 'cd-toggle-btn' + (k === modeId ? ' cd-toggle-btn--active' : '');
        }
      }
      var items = computeList(modeId);
      if (!vlist) {
        vlist = new CeoDash.core.VirtualList(listEl, { items: items, itemHeight: 44, renderRow: renderRow });
      } else {
        vlist.setItems(items);
      }
    }

    modes.forEach(function (m) {
      var btn = el('button', {
        type: 'button', className: 'cd-toggle-btn',
        onClick: function () { setMode(m.id); }
      }, m.label);
      buttons[m.id] = btn;
      toggleBar.appendChild(btn);
    });

    setMode(options.initialMode || 'top');

    var children = [toggleBar, listEl];
    if (options.title) { children.unshift(el('div', { className: 'cd-entity-ranking__title' }, options.title)); }

    return el('div', { className: 'cd-entity-ranking' }, children);
  }

  CeoDash.components.EntityRanking = EntityRanking;
})(window);
/* ---------- Breadcrumb ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.components = CeoDash.components || {};
  var el = CeoDash.core.dom.el;

  function ContextBreadcrumb(options) {
    var drillPath = options.drillPath || [];
    var segments = [];

    var backBtn = null;
    if (drillPath.length > 0) {
      var prevName = drillPath.length === 1
        ? (options.orgName || 'All Andhra Pradesh')
        : (options.byId[drillPath[drillPath.length - 2].id] ? options.byId[drillPath[drillPath.length - 2].id].name : 'Previous Level');

      backBtn = el('button', {
        type: 'button',
        className: 'cd-breadcrumb__back-btn',
        title: 'Go back to ' + prevName,
        onClick: function () { options.onNavigate(drillPath.length - 1); }
      }, [
        el('span', { 'aria-hidden': 'true' }, '<-'),
        el('span', {}, 'Back to ' + prevName)
      ]);
    }

    segments.push(el('button', {
      type: 'button',
      className: 'cd-breadcrumb__segment' + (drillPath.length === 0 ? ' cd-breadcrumb__segment--current' : ''),
      onClick: function () { options.onNavigate(0); }
    }, options.orgName || 'Statewide'));

    for (var i = 0; i < drillPath.length; i++) {
      var step = drillPath[i];
      var entity = options.byId[step.id];
      var depth = i + 1;
      segments.push(el('span', { className: 'cd-breadcrumb__sep', 'aria-hidden': 'true' }, '/'));
      segments.push(el('button', {
        type: 'button',
        className: 'cd-breadcrumb__segment' + (depth === drillPath.length ? ' cd-breadcrumb__segment--current' : ''),
        onClick: function (d) { return function () { options.onNavigate(d); }; }(depth)
      }, entity ? entity.name : step.id));
    }

    var resetBtn = null;
    if (drillPath.length > 1) {
      resetBtn = el('button', {
        type: 'button',
        className: 'cd-breadcrumb__reset-btn',
        title: 'Reset to Statewide View',
        onClick: function () { options.onNavigate(0); }
      }, 'Statewide View');
    }

    var navEl = el('nav', { className: 'cd-breadcrumb', 'aria-label': 'Breadcrumb' }, segments);
    return el('div', { className: 'cd-breadcrumb-wrap' }, [
      backBtn,
      navEl,
      resetBtn
    ]);
  }

  CeoDash.components.ContextBreadcrumb = ContextBreadcrumb;
})(window);
/* ---------- Modal dialog ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.components = CeoDash.components || {};
  var el = CeoDash.core.dom.el, clear = CeoDash.core.dom.clear;

  var modalRoot = null;
  function ensureRoot() {
    if (!modalRoot || !modalRoot.parentNode) {
      modalRoot = document.getElementById('cd-modal-root');
      if (!modalRoot) {
        modalRoot = el('div', { id: 'cd-modal-root' });
        document.body.appendChild(modalRoot);
      }
    }
    return modalRoot;
  }

  var current = null;

  function open(opts) {
    opts = opts || {};
    if (current) { current.close(); }
    var root = ensureRoot();
    clear(root);
    root.style.display = '';

    var handle = { close: close };
    function close() {
      if (current === handle) { current = null; } else if (current) { return; }
      if (unreg) { unreg(); }
      clear(root);
      root.style.display = 'none';
      if (global.document.removeEventListener) {
        global.document.removeEventListener('keydown', onKey, false);
      }
      if (opts.onClose) { opts.onClose(); }
    }
    var unreg = CeoDash.core.overlays.add(close);

    function onKey(evt) {
      if (evt.keyCode === 27) { close(); }
    }

    var backdrop = el('div', { className: 'cd-modal-backdrop', onClick: close });

    var badgeEl = null;
    if (opts.badge) {
      var bType = opts.badgeType || 'blue';
      badgeEl = el('span', { className: 'cd-badge-high-contrast cd-badge-high-contrast--' + bType, style: { marginBottom: '6px' } }, [
        el('span', { className: 'cd-pulse-beacon cd-pulse-beacon--' + (bType === 'red' ? '' : (bType === 'green' ? 'green' : 'blue')) }),
        opts.badge
      ]);
    }

    var titleEl = el('h2', { className: 'cd-modal-title' }, opts.title || 'Executive Action');
    var subEl = opts.subtitle ? el('div', { className: 'cd-modal-subtitle' }, opts.subtitle) : null;
    var closeBtn = el('button', {
      type: 'button',
      className: 'cd-modal-close-btn',
      'aria-label': 'Close dialog',
      onClick: close
    }, '\u2715');

    var headerEl = el('div', {
      className: 'cd-modal-header' + (opts.badgeType === 'red' ? ' cd-modal-header--danger' : (opts.badgeType === 'green' ? ' cd-modal-header--success' : (opts.badgeType === 'amber' ? ' cd-modal-header--warning' : '')))
    }, [
      el('div', { style: { flex: '1', minWidth: '0' } }, [badgeEl, titleEl, subEl].filter(Boolean)),
      closeBtn
    ]);

    var bodyChildren = [];

    if (opts.stats && opts.stats.length) {
      var statBoxes = opts.stats.map(function (s) {
        return el('div', { className: 'cd-modal-stat-box' }, [
          el('div', { className: 'cd-modal-stat-lbl' }, s.label),
          el('div', { className: 'cd-modal-stat-val', style: s.color ? { color: s.color } : {} }, s.value)
        ]);
      });
      bodyChildren.push(el('div', { className: 'cd-modal-stat-grid' }, statBoxes));
    }

    if (opts.body) {
      if (typeof opts.body === 'string') {
        bodyChildren.push(el('div', { style: { fontSize: '13px', lineHeight: '1.55', color: '#334155', marginBottom: '16px' } }, opts.body));
      } else {
        bodyChildren.push(opts.body);
      }
    }

    if (opts.content) {
      bodyChildren.push(opts.content);
    }

    if (opts.actions && opts.actions.length) {
      bodyChildren.push(el('div', { className: 'cd-modal-section-title' }, 'Actions'));
      var actionBtns = opts.actions.map(function (act) {
        var actType = act.type || 'primary';
        var btn = el('button', {
          type: 'button',
          className: 'cd-modal-btn cd-modal-btn--' + actType,
          onClick: function () {
            if (act.onClick) {
              act.onClick(close);
            } else {
              close();
            }
          }
        }, [
          el('span', {}, act.label),
          act.badge ? el('span', { className: 'cd-modal-btn-badge' }, act.badge) : el('span', { style: { fontSize: '15px' } }, '\u2192')
        ]);
        return btn;
      });
      bodyChildren.push(el('div', { className: 'cd-modal-actions' }, actionBtns));
    }

    var bodyEl = el('div', { className: 'cd-modal-body' }, bodyChildren);

    var cardEl = el('div', {
      className: 'cd-modal-card',
      role: 'dialog',
      'aria-modal': 'true'
    }, [headerEl, bodyEl]);

    root.appendChild(backdrop);
    root.appendChild(cardEl);

    if (global.document.addEventListener) {
      global.document.addEventListener('keydown', onKey, false);
    }

    current = handle;
    return handle;
  }

  CeoDash.components.ActionModal = {
    open: open
  };
})(window);

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

