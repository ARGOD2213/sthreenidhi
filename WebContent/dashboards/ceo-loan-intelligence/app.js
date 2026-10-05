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

  function realMetrics(src, monthly) {
    var target = num(src.targetAmount);
    var loans = num(src.loanCount), open = num(src.openLoans);
    return {
      disbursed: num(src.disbursed),
      disbursedTarget: target > 0 ? target * TARGET_TO_RUPEES : NA,
      expectedRepayment: NA, receivedRepayment: num(src.repaid),
      outstanding: NA, overdue: NA,
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

/* ---------- Chapter: Overview ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.chapters = CeoDash.chapters || {};
  var el = CeoDash.core.dom.el;
  var svg = CeoDash.core.svg;
  var fmt = CeoDash.core.format;

  function pulseBackground() {
    var svgRoot = svg.createSvg(900, 420, { preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' });
    var tokens = CeoDash.core.theme.getTokens();

    var defs = svg.el('defs', {});
    var glow = svg.el('radialGradient', { id: 'cd-pulse-glow', cx: '50%', cy: '35%', r: '60%' });
    glow.appendChild(svg.el('stop', { offset: '0%', 'stop-color': tokens.primary, 'stop-opacity': '0.14' }));
    glow.appendChild(svg.el('stop', { offset: '100%', 'stop-color': tokens.primary, 'stop-opacity': '0' }));
    defs.appendChild(glow);
    svgRoot.appendChild(defs);

    svgRoot.appendChild(svg.el('circle', { cx: 450, cy: 150, r: 260, fill: 'url(#cd-pulse-glow)' }));
    for (var i = 0; i < 5; i++) {
      svgRoot.appendChild(svg.el('circle', {
        cx: 450, cy: 150, r: 90 + i * 38, fill: 'none',
        stroke: tokens.primarySoft, 'stroke-width': 1
      }));
    }
    return svgRoot;
  }

  window.__AP_SVG_HTML = '<svg id="ap-map" viewBox="0 0 1115 921" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-label="AP 28 Districts Map">\n  <defs>\n    <filter id="dist-shadow" x="-10%" y="-10%" width="120%" height="120%">\n      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f261c" flood-opacity="0.22"/>\n    </filter>\n  </defs>\n  <g id="district-polygons">\n    <path id="dist-srikakulam" class="dp" data-id="srikakulam" data-name="Srikakulam" d="M936.8,134.1L933.9,138.8L937.4,141.3L936.6,142.4L939.1,141.7L939.6,143.2L943.5,143.2L950.6,146.8L945.8,148.5L942.9,158.7L940.7,157.0L936.3,158.7L937.7,161.7L936.5,166.4L939.1,169.1L938.9,171.3L942.0,172.3L944.4,176.0L958.8,167.8L999.0,149.4L1006.8,144.1L1009.5,136.7L1016.2,129.7L1037.3,111.7L1038.8,106.8L1048.6,97.7L1055.3,87.3L1063.6,80.3L1069.5,68.3L1080.5,57.5L1092.3,41.7L1083.9,36.5L1083.5,33.0L1085.2,31.0L1080.0,29.9L1079.1,34.8L1069.5,34.5L1073.7,40.8L1078.0,39.7L1079.6,42.0L1078.2,43.8L1072.5,43.4L1070.2,48.9L1067.6,48.2L1067.8,42.4L1066.4,42.4L1055.9,48.3L1053.8,53.8L1046.1,49.3L1050.3,55.4L1047.4,56.4L1046.6,58.9L1048.4,62.9L1047.1,64.4L1045.6,63.2L1045.9,66.0L1040.4,65.1L1042.9,66.7L1042.3,68.8L1037.9,66.4L1040.8,68.7L1039.8,70.9L1034.8,67.0L1036.1,72.6L1038.4,74.2L1034.0,76.7L1035.8,78.8L1033.4,79.2L1032.7,80.9L1028.3,78.5L1028.0,80.1L1025.0,81.3L1019.9,79.2L1015.8,80.2L1015.1,82.1L1011.5,80.5L1008.4,82.1L1007.9,84.3L1004.7,83.5L1001.5,84.9L995.1,77.0L984.9,77.1L982.6,78.4L978.3,75.3L974.4,77.7L973.4,76.9L974.7,79.7L967.3,82.6L972.0,83.7L974.9,88.8L972.0,86.6L968.1,89.3L968.2,94.4L975.1,101.6L975.2,106.2L979.3,108.8L976.7,110.8L978.3,113.5L976.4,114.8L973.4,112.0L969.7,114.9L966.1,111.8L966.9,109.4L965.4,109.9L960.8,107.0L961.8,105.0L958.7,108.9L960.8,113.8L963.1,113.1L961.1,118.3L965.1,122.4L964.2,127.3L967.6,130.1L965.9,132.3L967.0,134.5L963.6,133.1L962.7,136.6L958.5,136.0L953.5,128.6L951.4,129.3L952.6,128.4L951.5,126.2L949.4,127.2L949.8,134.6L940.2,135.6L936.8,134.1Z"/>\n    <path id="dist-parvathipuram-manyam" class="dp" data-id="parvathipuram-manyam" data-name="Parvathipuram Manyam" d="M951.1,53.2L950.4,51.4L953.3,49.3L949.3,48.9L944.0,41.3L944.3,38.9L942.2,36.4L943.2,34.8L940.8,34.6L940.9,31.7L939.3,30.4L938.1,33.8L935.6,34.7L937.2,39.3L933.9,40.6L933.8,44.5L931.0,44.5L930.7,40.8L929.0,41.4L930.1,44.8L928.0,46.7L927.3,51.0L922.4,49.3L921.9,47.5L924.5,48.4L925.0,47.0L924.0,42.8L922.5,44.1L919.9,41.7L920.2,39.9L918.1,39.7L919.5,41.6L917.9,41.5L917.4,43.7L920.2,47.9L919.6,51.2L915.7,50.9L916.4,53.4L918.1,53.4L917.5,58.2L915.2,57.9L914.2,55.4L911.0,53.7L911.7,52.2L909.1,51.0L905.8,52.0L904.6,50.1L901.3,49.8L900.7,52.7L897.0,52.4L898.1,55.9L900.3,56.4L900.7,59.4L898.9,60.6L900.2,62.3L902.1,62.1L902.5,56.6L904.5,57.1L905.1,59.9L907.3,61.2L906.0,62.2L905.0,60.0L902.6,60.8L904.7,64.5L908.1,64.6L906.6,66.8L911.0,69.1L909.8,73.3L906.1,75.0L904.3,73.3L899.4,76.7L899.6,78.2L893.5,79.3L891.7,83.9L885.4,82.4L885.9,85.1L883.8,88.4L883.0,85.6L873.7,81.2L865.0,91.8L863.1,97.2L857.6,99.2L858.0,101.2L855.2,103.4L858.6,107.4L862.4,105.8L862.5,107.4L859.3,109.5L861.4,113.5L866.3,112.1L868.1,113.2L858.1,125.3L860.8,127.3L861.0,129.5L863.3,127.8L864.3,128.7L863.9,131.5L866.1,132.4L869.4,131.1L865.5,137.1L866.1,140.0L867.8,140.6L869.6,138.6L875.8,140.8L878.8,136.5L882.0,135.1L879.5,134.7L883.6,130.0L881.1,125.4L881.9,122.7L884.9,123.6L884.2,120.9L885.7,117.3L891.0,113.8L891.1,109.6L888.2,107.6L892.6,102.4L894.1,103.3L897.7,100.3L900.9,100.0L901.3,104.6L903.6,106.9L906.0,106.3L905.4,103.9L907.5,104.9L910.9,102.7L912.8,105.0L914.7,103.6L915.9,99.3L917.8,103.5L921.2,104.7L918.7,110.0L924.5,114.7L924.4,116.7L927.3,115.7L928.2,114.1L926.3,111.7L928.4,108.2L931.9,106.9L929.0,106.5L929.2,99.2L930.7,96.9L928.0,94.4L927.6,91.0L932.1,93.2L932.4,95.9L936.6,98.2L940.6,105.2L944.4,108.3L953.5,110.4L956.3,107.8L957.1,110.2L959.1,110.5L959.2,107.3L961.8,105.0L960.8,107.0L965.4,109.9L966.9,109.4L966.1,111.8L969.7,114.9L973.4,112.0L976.4,114.8L978.2,113.7L976.7,110.8L979.3,108.8L975.2,106.2L975.1,101.6L970.4,98.1L968.0,92.4L968.1,89.3L971.6,86.7L974.9,88.8L972.0,83.7L967.3,82.0L974.7,79.7L973.2,78.3L975.1,75.5L969.6,71.0L969.1,64.0L966.0,63.3L965.9,58.0L962.0,49.8L959.7,49.9L960.3,51.1L955.4,53.6L957.2,58.9L958.6,58.3L960.6,61.1L961.1,63.5L959.8,64.1L956.4,62.2L953.7,53.8L951.1,53.2ZM940.0,115.0L938.9,110.9L932.7,110.2L930.1,111.9L931.5,115.2L940.0,115.0Z"/>\n    <path id="dist-vizianagaram" class="dp" data-id="vizianagaram" data-name="Vizianagaram" d="M889.8,149.2L891.1,157.4L886.5,154.5L887.6,159.1L884.6,156.3L885.2,161.0L880.9,160.0L878.6,155.8L873.1,162.8L869.4,161.1L871.1,163.6L869.7,165.2L871.2,165.7L869.0,168.4L871.7,170.2L869.4,171.7L872.6,172.9L865.4,174.9L864.5,176.6L857.2,179.6L856.2,189.5L862.4,191.3L864.6,193.9L870.1,194.6L872.3,202.9L874.8,203.8L874.9,207.2L876.9,207.8L880.2,206.2L882.8,206.9L883.6,202.3L886.3,203.1L887.4,199.3L890.3,197.8L886.5,196.2L885.4,193.7L887.9,193.1L892.0,185.5L894.5,186.9L894.1,185.3L897.6,185.7L896.2,182.3L897.9,183.0L900.1,180.3L902.7,179.9L903.3,177.8L905.6,179.5L909.5,178.7L908.0,184.1L911.4,184.4L912.2,186.2L909.9,191.4L914.8,196.9L915.8,196.5L914.0,193.5L915.8,193.8L915.9,191.8L917.8,191.0L920.1,193.3L926.2,193.4L931.7,185.0L944.4,176.0L942.0,172.3L938.9,171.3L939.1,169.1L936.5,166.4L937.7,161.7L936.3,158.7L940.7,157.0L942.9,158.7L945.8,148.5L950.6,146.9L943.5,143.2L939.6,143.2L939.1,141.7L936.6,142.4L937.4,141.3L933.9,138.9L934.3,137.8L936.8,134.1L940.2,135.6L949.8,134.6L949.4,127.2L951.4,126.2L952.6,127.8L951.4,129.3L953.5,128.6L958.5,136.0L962.7,136.6L963.6,133.1L967.0,134.5L965.9,132.3L967.6,130.1L964.2,127.3L965.1,122.4L961.1,118.3L963.1,113.1L960.8,113.8L956.3,107.8L953.2,110.4L942.6,107.4L938.7,100.6L928.5,91.0L928.0,94.4L930.7,96.9L929.2,99.2L929.0,106.5L931.9,106.9L928.3,108.3L926.0,112.3L928.2,114.1L924.5,116.7L924.5,114.7L918.7,110.0L921.2,104.7L917.8,103.5L915.9,99.3L914.7,103.6L912.8,105.0L910.9,102.7L907.5,104.9L905.4,103.9L906.0,106.3L903.6,106.9L901.3,104.6L900.7,99.9L897.7,100.3L894.1,103.3L892.6,102.4L888.2,107.6L891.1,109.6L890.4,115.3L885.7,117.3L884.2,120.9L884.9,123.6L883.1,122.1L881.1,124.8L883.6,130.0L879.5,134.7L882.2,134.8L877.2,138.0L875.4,142.3L877.2,142.4L878.3,144.5L881.3,142.1L884.9,141.7L883.6,148.2L889.8,149.2ZM940.0,115.0L931.5,115.2L930.1,111.9L932.7,110.2L938.9,110.9L940.0,115.0Z"/>\n    <path id="dist-visakhapatnam" class="dp" data-id="visakhapatnam" data-name="Visakhapatnam" d="M876.0,222.2L875.3,224.3L871.7,224.8L871.4,227.4L870.0,227.8L875.9,230.3L870.4,247.4L877.1,245.5L887.1,238.7L888.6,236.9L887.3,238.1L886.3,236.5L888.4,236.4L894.9,230.1L895.3,228.6L891.5,227.5L892.6,227.4L890.7,225.1L892.9,227.4L893.3,225.1L893.4,228.2L896.4,228.3L895.6,227.2L901.7,223.3L903.0,218.9L910.4,211.8L911.2,206.0L914.9,203.5L917.4,198.8L925.8,193.5L920.1,193.3L917.8,191.0L915.9,191.8L915.8,193.8L914.0,193.5L915.8,196.5L914.8,196.9L909.9,191.4L912.2,186.2L911.8,184.6L908.0,184.1L909.5,178.7L905.6,179.5L903.3,177.8L902.7,179.9L900.1,180.3L897.9,183.0L896.2,182.3L897.6,185.7L894.1,185.3L894.5,186.9L892.0,185.5L887.9,193.1L885.4,193.7L886.5,196.2L890.3,197.8L887.4,199.3L886.3,203.1L883.6,202.3L882.8,206.9L877.3,206.7L877.3,219.0L876.0,222.2ZM887.5,237.5L887.5,237.5ZM877.2,245.5L877.2,245.5ZM887.5,237.5L887.5,237.5Z"/>\n    <path id="dist-alluri-sitharama-raju" class="dp" data-id="alluri-sitharama-raju" data-name="Alluri Sitharama Raju" d="M875.8,160.9L874.6,159.6L876.5,159.6L878.6,155.8L880.7,159.8L883.3,161.1L885.5,160.6L884.2,159.4L884.6,156.3L887.6,159.1L886.5,154.5L891.1,157.4L890.0,149.3L883.6,148.2L884.9,141.7L881.3,142.1L878.3,144.5L873.4,139.6L869.6,138.6L867.8,140.6L866.1,140.0L865.5,137.1L869.4,131.1L867.2,131.3L862.4,135.6L858.1,133.9L854.8,134.7L851.2,138.3L844.6,136.1L843.7,137.0L840.9,134.3L841.5,129.7L835.4,130.0L830.8,126.0L826.2,128.8L828.4,131.8L825.1,140.8L813.1,145.7L807.3,146.0L808.6,153.1L806.6,154.7L799.9,149.3L801.4,145.5L799.2,144.3L802.9,142.5L801.9,139.3L804.4,138.2L800.9,134.2L793.7,132.7L796.5,126.4L793.9,125.1L793.5,126.9L790.7,123.8L792.8,122.3L792.6,118.0L786.4,115.6L785.7,114.0L787.3,113.3L786.2,112.7L770.2,129.8L772.8,137.1L766.6,142.7L769.2,144.0L773.4,142.4L773.8,146.5L770.9,149.1L767.3,148.9L766.3,154.0L764.7,155.2L766.3,156.5L762.9,159.0L763.6,161.9L768.5,163.4L771.1,166.5L769.9,168.4L766.6,166.5L765.9,170.3L768.3,176.1L767.3,178.7L764.3,178.5L764.1,180.5L761.2,179.0L762.0,177.2L757.8,178.8L756.3,181.0L757.7,185.0L754.7,187.4L748.5,184.0L745.2,183.9L743.8,179.6L739.6,180.6L739.1,178.5L734.8,178.5L731.5,176.4L730.0,179.0L726.6,178.9L725.7,177.2L722.2,178.7L722.4,182.4L718.4,185.1L720.7,186.4L722.0,191.0L725.1,194.7L721.4,199.8L723.7,208.0L722.4,209.6L722.1,207.2L719.6,206.2L715.9,211.1L711.0,212.2L702.4,219.5L704.9,221.2L712.5,221.5L717.4,220.4L715.8,218.9L719.3,217.5L723.3,219.6L722.6,221.6L725.5,225.5L721.3,234.8L723.2,237.6L724.2,235.8L728.0,234.3L728.7,235.4L733.1,232.5L737.2,232.7L742.9,238.7L745.4,239.0L751.4,234.9L754.4,237.6L758.2,236.8L758.0,238.5L761.9,241.5L768.9,243.3L767.8,244.3L770.1,243.6L782.9,239.2L783.2,235.9L779.4,235.3L778.6,233.0L775.7,234.5L774.0,233.6L776.2,232.0L774.4,230.5L772.0,231.6L772.9,233.2L771.2,235.2L769.2,235.3L767.0,233.4L768.5,232.3L767.6,229.7L774.6,229.0L782.7,221.6L788.1,224.7L789.8,223.6L787.6,225.6L788.1,227.6L791.8,226.3L796.4,220.4L796.6,217.3L802.2,217.7L800.8,216.1L803.7,214.9L803.5,216.1L806.4,216.4L805.6,214.6L807.2,214.0L804.5,207.7L806.0,209.0L812.3,205.7L814.1,206.7L814.8,204.6L817.2,204.2L810.4,199.7L815.2,200.0L815.6,197.2L818.4,195.7L816.1,193.6L816.8,192.6L821.9,193.7L822.2,192.0L825.5,196.5L825.0,194.7L828.4,197.1L829.8,195.1L833.3,195.1L833.2,193.3L835.9,191.7L834.2,190.3L835.1,188.6L831.0,187.6L834.8,185.5L836.5,186.6L840.1,183.0L840.2,185.1L847.2,185.4L847.8,188.1L852.7,184.4L852.5,182.5L856.0,179.2L855.6,176.6L858.6,174.1L859.4,176.0L864.3,176.7L865.4,174.9L872.3,173.3L872.6,171.9L869.4,171.7L871.7,171.0L869.0,168.4L871.2,165.7L869.7,165.2L871.1,163.6L869.4,161.1L873.1,162.8L875.8,160.9Z"/>\n    <path id="dist-polavaram" class="dp" data-id="polavaram" data-name="Polavaram" d="M723.5,237.6L721.3,235.3L725.5,225.5L722.6,221.6L723.3,219.6L719.3,217.5L715.8,218.9L717.4,220.4L712.5,221.5L704.9,221.2L702.4,219.5L711.0,212.2L715.9,211.1L719.6,206.2L722.1,207.2L722.4,209.6L723.7,208.0L721.4,199.8L725.1,194.7L718.4,184.5L704.5,190.9L695.7,192.9L693.0,197.0L682.5,203.7L681.1,199.8L679.4,201.8L676.3,201.9L669.8,210.2L663.9,208.3L662.8,209.7L652.9,211.7L650.4,208.2L646.4,210.0L645.0,209.1L642.7,211.5L640.2,210.7L638.9,213.9L633.7,211.7L620.9,211.7L612.6,207.0L608.2,206.2L598.8,211.9L598.4,213.6L600.9,217.1L594.7,222.3L592.3,220.3L585.7,220.0L583.3,216.1L575.8,220.3L573.4,219.7L571.5,228.9L574.7,230.0L573.5,234.9L579.7,235.7L583.3,233.5L587.5,233.7L588.7,240.5L601.4,237.1L603.9,241.9L606.4,243.2L622.4,245.0L627.5,254.8L635.7,253.6L637.9,254.1L639.8,257.5L646.4,258.9L653.6,256.1L655.1,256.8L657.9,261.5L662.4,261.6L665.3,266.1L669.1,266.0L668.1,270.9L669.5,276.5L677.8,279.9L678.1,281.5L675.2,283.9L678.9,284.0L678.3,289.4L683.4,290.9L683.3,289.3L688.1,289.2L689.6,287.2L694.2,287.9L695.2,285.7L697.8,285.9L697.9,279.1L703.4,282.0L705.3,280.8L705.5,278.3L709.4,279.9L711.2,278.6L710.5,283.2L716.4,281.4L717.6,278.4L726.0,279.5L727.5,282.9L729.9,281.0L730.9,282.3L733.7,281.7L728.2,278.4L729.5,275.9L728.1,270.3L731.9,268.0L731.1,266.7L732.7,268.5L734.3,266.8L734.6,268.8L737.3,268.9L733.5,274.1L735.6,275.1L734.5,277.0L737.5,277.5L737.9,274.3L740.4,274.5L738.0,280.1L742.8,280.0L747.1,277.7L741.1,278.3L744.0,274.6L742.0,272.8L747.9,270.3L755.6,262.3L759.0,261.1L760.2,256.1L765.9,252.1L765.2,245.9L766.9,241.9L761.9,241.5L758.0,238.5L758.2,236.8L754.4,237.6L751.4,234.9L745.4,239.0L742.9,238.7L737.2,232.7L733.1,232.5L728.7,235.4L728.0,234.3L724.2,235.8L723.5,237.6Z"/>\n    <path id="dist-anakapalli" class="dp" data-id="anakapalli" data-name="Anakapalli" d="M794.3,270.4L796.9,274.8L795.7,277.1L793.0,276.7L792.9,279.6L790.6,280.6L793.9,287.3L820.2,272.3L854.2,257.3L857.8,252.7L870.4,247.4L875.9,230.3L870.0,227.8L871.4,227.4L871.7,224.8L875.3,224.3L876.3,222.0L877.0,208.1L874.9,207.2L874.8,203.8L872.3,202.9L870.1,194.6L864.6,193.9L862.4,191.3L856.2,189.5L857.2,179.6L862.1,177.9L861.3,176.1L858.8,175.6L859.1,173.8L855.6,176.6L856.0,179.2L852.5,182.5L852.7,184.4L847.8,188.1L847.2,185.4L840.2,185.1L840.3,183.0L836.5,186.6L834.8,185.5L831.0,187.6L835.1,188.6L834.2,190.3L835.9,191.7L833.2,193.3L833.3,195.1L829.8,195.1L828.4,197.1L825.0,194.7L825.5,196.5L822.2,192.0L821.9,193.7L816.8,192.6L816.1,193.6L818.4,195.7L815.6,197.2L815.2,200.0L810.4,199.7L817.2,204.2L814.8,204.6L814.1,206.7L812.3,205.7L806.0,209.0L804.5,207.7L807.2,214.0L805.6,214.6L806.4,216.4L803.5,216.1L803.7,214.9L800.8,216.1L802.2,217.7L796.6,217.3L796.4,220.4L791.8,226.3L788.1,227.6L787.6,225.6L789.8,223.6L788.1,224.7L782.7,221.6L774.6,229.0L767.6,229.7L768.5,232.3L767.0,233.4L769.2,235.3L772.9,233.2L772.1,231.5L775.4,230.6L776.2,232.0L774.0,233.6L775.7,234.5L778.6,233.0L779.4,235.3L782.9,235.5L783.3,237.9L782.9,239.2L767.9,244.3L768.9,243.3L767.3,242.7L765.2,245.9L765.6,253.1L767.4,254.3L771.5,252.1L771.1,256.3L776.2,258.0L781.7,256.2L781.4,252.1L783.5,252.0L783.7,248.7L786.5,253.6L793.2,252.7L795.3,249.9L796.4,254.8L802.2,259.6L794.3,270.4Z"/>\n    <path id="dist-kakinada" class="dp" data-id="kakinada" data-name="Kakinada" d="M733.6,336.9L735.1,338.8L732.3,340.6L733.1,343.0L734.6,341.7L736.1,342.9L735.1,348.7L737.5,353.0L741.4,354.1L737.9,357.8L740.8,357.5L740.6,360.4L748.3,359.1L746.1,356.0L748.7,356.3L751.5,352.7L752.3,353.5L750.2,356.5L752.3,357.7L760.1,357.4L762.1,354.5L761.4,350.6L764.2,350.6L766.6,358.8L768.8,340.6L763.1,340.8L757.4,337.2L754.4,333.1L755.2,329.0L754.0,328.6L757.4,328.4L761.0,316.5L765.4,311.1L782.5,295.5L793.9,287.3L790.6,280.6L792.9,279.6L793.0,276.7L796.3,276.2L797.0,273.7L794.1,270.4L802.2,259.6L796.4,254.8L795.3,249.9L793.2,252.7L786.5,253.6L783.7,248.7L783.5,252.0L781.4,252.1L781.7,256.2L776.2,258.0L771.1,256.3L771.5,252.1L767.4,254.3L765.4,252.2L760.2,256.1L759.0,261.1L755.6,262.3L747.9,270.3L742.0,272.8L744.0,274.6L741.1,278.3L747.1,277.6L742.8,280.0L738.0,280.1L740.1,274.3L737.9,274.3L737.5,277.5L734.5,277.0L735.6,275.1L733.5,274.1L737.3,268.9L734.6,268.8L734.3,266.8L732.7,268.5L731.1,266.7L731.9,268.0L728.1,270.3L729.5,275.9L728.2,278.4L733.7,281.7L724.7,282.1L722.2,285.3L716.6,285.5L714.5,287.2L712.6,293.7L709.8,294.4L707.9,297.1L710.2,298.6L710.4,305.9L711.0,306.9L715.5,304.8L720.9,304.6L727.3,308.4L725.2,315.6L731.1,315.0L731.6,316.5L729.2,319.0L731.0,326.6L728.6,334.4L731.0,334.4L731.1,336.1L733.6,336.9ZM768.6,340.3L769.5,326.4L765.4,321.6L764.7,322.6L768.5,326.0L769.5,329.1L768.6,340.3Z"/>\n    <path id="dist-east-godavari" class="dp" data-id="east-godavari" data-name="East Godavari" d="M717.8,351.5L723.2,351.6L724.8,346.0L722.0,341.8L724.4,340.6L724.1,337.8L727.1,338.6L727.6,336.8L730.8,337.2L731.0,334.4L728.6,333.9L731.0,326.6L729.2,319.0L731.5,315.5L725.2,315.6L727.3,308.4L721.2,304.7L715.5,304.8L711.0,306.9L710.2,298.6L707.9,297.1L709.8,294.4L712.6,293.7L714.7,287.0L716.6,285.5L721.6,285.6L723.9,282.4L726.2,281.9L726.0,279.5L722.4,278.2L717.6,278.4L716.4,281.4L711.0,283.2L709.8,283.1L711.2,278.6L709.4,279.9L705.5,278.3L705.3,280.8L703.4,282.0L697.9,279.1L697.8,285.9L695.2,285.7L694.2,287.9L689.6,287.2L688.1,289.2L683.3,289.3L683.4,290.9L678.3,289.4L678.9,284.0L675.2,283.9L672.8,290.5L675.7,297.7L673.9,298.4L667.0,296.7L666.2,292.1L660.3,291.8L653.8,293.6L647.7,299.3L650.0,298.5L650.7,303.2L649.6,305.3L646.7,306.1L648.2,307.9L647.7,310.1L644.6,311.4L647.5,314.9L647.9,319.6L646.2,319.2L644.5,314.7L640.2,314.4L636.5,316.5L636.1,322.5L632.1,321.9L628.8,324.3L631.3,325.2L628.8,324.9L626.1,329.0L631.3,330.3L631.9,334.3L639.1,333.2L639.8,338.9L647.4,336.1L646.2,334.0L650.0,334.5L651.9,332.9L652.6,324.4L656.4,327.8L659.2,327.6L663.6,333.9L668.3,333.6L671.0,335.8L672.2,340.3L674.8,340.7L670.7,348.2L678.2,352.7L684.3,351.4L683.6,357.1L687.9,357.2L689.1,364.5L694.8,361.6L692.9,353.2L688.8,349.6L689.4,342.9L685.8,336.4L686.1,327.9L692.3,329.2L695.4,339.2L698.5,337.6L700.7,338.2L701.0,341.1L709.8,343.1L709.4,345.4L711.3,345.6L710.8,349.4L703.7,354.6L709.8,359.6L719.1,362.6L720.4,360.8L717.8,358.9L721.2,355.4L719.8,354.8L720.2,352.7L717.3,352.7L717.8,351.5Z"/>\n    <path id="dist-konaseema" class="dp" data-id="konaseema" data-name="Konaseema" d="M704.5,353.1L708.7,351.9L710.8,349.4L711.3,345.6L709.4,345.4L709.8,343.1L701.0,341.1L700.7,338.2L698.5,337.6L695.4,339.2L692.3,329.2L686.1,327.9L685.8,336.4L689.4,342.9L688.8,349.6L692.9,353.2L694.8,361.6L699.4,364.1L702.4,373.4L700.3,389.8L693.8,392.1L687.6,398.9L685.6,398.5L683.7,394.9L681.2,397.2L680.5,399.8L683.1,406.7L681.9,412.8L683.7,413.3L701.5,404.8L713.2,402.0L761.1,378.4L763.7,375.4L763.7,368.5L770.5,356.2L767.0,355.0L765.8,358.7L764.2,350.6L761.4,350.6L763.2,357.2L760.8,360.0L748.1,358.5L740.6,360.4L740.8,357.5L737.9,357.8L741.4,354.1L737.4,352.9L735.1,348.7L735.7,346.8L734.5,346.7L735.9,342.4L733.1,343.0L732.3,340.6L735.1,338.5L731.1,336.1L730.8,337.2L727.4,336.9L727.1,338.6L724.1,337.8L724.4,340.6L722.0,341.8L724.8,346.2L723.2,351.6L717.8,351.5L717.3,352.7L720.2,352.7L719.8,354.8L721.2,355.4L717.8,358.9L720.4,360.8L719.1,362.6L713.2,359.7L710.5,360.1L703.7,354.6L704.5,353.1Z"/>\n    <path id="dist-eluru" class="dp" data-id="eluru" data-name="Eluru" d="M569.9,359.5L574.6,359.1L577.9,364.4L580.7,364.8L588.4,379.6L597.4,377.7L600.1,374.3L601.9,375.6L602.4,378.2L600.1,380.3L601.3,380.7L600.3,384.2L602.7,386.1L602.1,387.8L598.9,388.4L598.0,390.1L599.4,392.1L597.8,397.0L595.9,395.6L593.0,396.7L592.9,398.4L598.1,403.5L601.6,402.8L605.7,404.4L608.3,400.6L610.3,400.9L610.2,403.0L614.3,403.7L616.0,398.5L618.0,397.5L618.2,399.5L621.0,400.8L627.8,396.0L626.2,394.0L629.1,393.2L630.6,395.3L629.7,398.6L632.9,400.4L638.8,399.9L640.7,396.1L636.9,393.4L636.7,388.1L631.3,386.4L633.5,380.7L633.3,375.4L634.8,374.5L630.6,371.0L631.0,362.4L634.3,362.0L634.3,363.8L632.5,364.4L632.9,366.6L646.5,365.8L648.4,363.7L646.1,361.4L648.4,359.6L645.9,353.3L651.4,353.4L650.3,350.3L653.7,345.6L652.2,345.2L650.6,338.8L648.2,338.1L648.6,334.2L646.2,334.0L647.5,336.0L645.7,337.3L639.8,338.9L639.1,333.2L631.9,334.3L631.3,330.3L626.1,329.0L628.8,324.9L631.3,325.2L628.8,324.3L632.1,321.9L636.1,322.5L636.5,316.5L640.2,314.4L644.5,314.7L646.2,319.2L647.9,319.6L647.5,314.9L644.6,311.4L647.7,310.1L648.3,308.3L646.7,306.1L649.6,305.3L650.7,303.2L650.0,298.5L647.7,299.3L653.8,293.6L660.3,291.8L666.2,292.1L667.0,296.7L675.7,297.7L672.8,290.5L678.0,280.4L669.5,276.5L668.1,270.9L669.1,266.0L665.3,266.1L662.4,261.6L657.9,261.5L653.7,256.1L646.4,258.9L639.8,257.5L637.9,254.1L635.7,253.6L627.5,254.8L623.3,245.5L617.4,243.5L614.8,245.0L606.4,243.2L603.9,241.9L601.4,237.1L591.7,240.7L588.2,240.2L587.9,234.4L586.5,233.2L579.7,235.7L573.5,234.9L567.7,236.1L567.9,240.0L582.5,240.3L589.5,250.9L600.1,253.0L604.0,250.1L606.0,255.1L608.3,255.7L606.8,258.5L610.5,258.4L610.0,260.4L612.7,262.2L614.0,262.4L614.4,260.3L628.6,265.7L630.2,270.4L623.6,278.1L612.3,277.3L610.6,281.8L611.9,287.3L609.8,289.6L597.5,291.8L594.2,290.5L591.0,295.1L586.2,295.0L576.0,291.1L576.7,299.4L570.7,299.1L569.1,304.0L570.3,306.2L569.1,310.1L570.4,311.2L566.1,315.3L559.6,312.4L557.3,317.2L563.5,321.5L563.3,330.0L567.5,332.2L566.1,335.9L560.0,336.6L559.7,339.3L556.2,340.8L557.0,344.5L555.6,349.2L545.2,364.7L544.8,369.2L546.5,370.8L557.2,371.4L559.1,368.6L559.9,369.7L562.4,367.5L561.2,366.2L562.7,364.2L564.9,368.5L564.9,372.5L566.5,373.0L568.3,371.1L570.2,372.1L571.4,367.2L567.9,364.9L567.5,362.8L570.2,362.4L569.9,359.5ZM586.8,354.3L585.5,358.0L582.6,357.6L580.6,361.1L577.3,359.8L579.6,353.7L582.8,352.5L586.8,354.3ZM583.1,365.4L585.8,363.5L589.4,367.6L586.8,369.8L583.1,365.4Z"/>\n    <path id="dist-west-godavari" class="dp" data-id="west-godavari" data-name="West Godavari" d="M645.9,353.3L648.4,359.6L646.1,361.4L648.4,363.7L646.5,365.8L632.9,366.6L632.5,364.4L634.3,363.8L634.3,362.0L631.0,362.4L630.6,371.0L634.8,374.5L633.3,375.4L633.5,380.7L631.4,386.6L636.7,388.1L636.9,393.4L642.2,398.5L643.9,398.5L645.3,401.3L649.9,401.4L653.5,405.3L660.0,404.0L661.0,408.6L678.4,410.2L681.9,412.8L683.1,406.7L680.5,399.1L682.1,395.5L684.2,395.1L685.6,398.5L687.6,398.9L693.8,392.1L701.0,388.5L702.4,373.4L699.4,364.1L692.8,361.6L692.8,363.0L688.7,364.4L687.9,357.2L683.6,357.1L684.3,351.4L678.2,352.7L670.6,348.1L674.8,340.9L672.2,340.3L670.6,335.2L668.3,333.6L663.6,333.9L659.2,327.6L656.4,327.8L653.2,324.4L652.2,332.5L648.6,334.2L648.2,338.1L650.6,338.8L652.2,345.2L653.7,345.6L650.3,350.3L651.4,353.4L645.9,353.3ZM586.1,357.0L586.8,354.3L582.8,352.5L579.6,353.7L577.2,359.5L580.1,361.3L582.6,357.6L586.1,357.0ZM583.1,365.4L586.8,369.8L589.4,367.6L585.8,363.5L583.1,365.4Z"/>\n    <path id="dist-ntr" class="dp" data-id="ntr" data-name="NTR" d="M525.4,381.0L527.4,383.5L540.1,390.4L541.2,389.3L545.0,390.2L543.0,389.1L543.9,387.7L541.5,384.9L541.6,381.5L544.2,382.0L544.1,385.6L550.9,388.5L553.3,387.7L554.2,385.2L544.8,382.1L546.9,376.3L544.8,366.1L555.6,349.2L557.0,344.5L556.2,340.8L559.7,339.3L560.0,336.6L566.1,335.9L567.5,332.2L563.3,330.0L563.5,321.5L557.3,317.2L559.6,312.4L547.8,309.7L540.4,311.4L542.6,307.1L530.5,300.1L528.0,302.9L521.6,304.3L520.5,311.4L518.5,313.8L515.9,313.9L515.0,316.6L511.5,315.6L508.6,310.8L508.9,308.3L504.5,311.2L507.3,318.6L504.8,319.4L501.4,323.9L513.0,326.7L518.9,330.4L519.7,326.5L523.3,327.7L524.5,325.9L533.5,331.6L531.4,333.6L532.6,336.2L528.9,338.2L528.2,343.1L534.9,348.4L529.2,351.8L515.0,348.2L514.9,344.8L510.2,342.4L510.0,340.8L504.2,338.8L503.4,340.6L507.4,341.0L507.0,343.1L503.9,345.3L502.8,340.5L498.3,339.5L498.8,337.5L495.8,337.0L495.1,327.6L493.6,326.9L493.8,324.2L491.6,323.2L491.9,320.9L490.6,319.6L488.0,321.0L483.4,318.7L480.8,319.2L479.0,314.8L477.8,318.0L471.5,322.0L465.5,321.9L464.9,324.9L460.0,324.5L459.3,329.2L457.9,331.7L455.0,332.1L452.5,338.8L458.9,340.3L459.1,343.1L462.3,345.2L468.4,344.9L472.4,357.7L471.5,367.4L486.5,372.9L497.1,372.8L502.2,376.1L516.5,376.0L525.4,381.0Z"/>\n    <path id="dist-krishna" class="dp" data-id="krishna" data-name="Krishna" d="M540.1,390.4L542.6,392.4L541.6,394.5L543.2,395.5L543.1,397.9L550.0,403.8L552.8,410.2L559.7,416.8L560.3,422.5L562.3,422.5L562.7,425.6L565.5,425.9L563.8,428.1L568.5,436.9L567.4,440.9L569.1,440.7L569.6,445.7L570.9,445.7L573.9,466.0L571.6,474.2L569.8,475.4L565.5,485.6L564.4,493.3L578.8,492.5L588.9,485.9L588.9,475.4L605.3,458.5L605.3,452.6L614.8,436.0L615.5,428.7L619.1,424.9L616.2,426.4L616.2,424.6L618.5,423.9L623.7,417.0L639.7,409.0L650.6,407.6L661.0,408.6L661.3,407.5L660.0,404.0L653.1,405.2L649.9,401.4L645.5,401.4L643.9,398.5L640.9,397.5L638.5,400.1L632.9,400.4L629.7,398.6L630.1,393.2L626.2,394.0L627.8,396.0L621.0,400.8L618.2,399.5L618.0,397.5L616.0,398.5L614.3,403.7L610.2,403.0L610.3,400.9L608.3,400.6L605.7,404.4L601.6,402.8L598.1,403.5L592.9,398.4L593.0,396.7L595.9,395.6L597.8,397.0L599.4,392.1L598.0,390.1L598.9,388.4L602.1,387.8L602.7,386.1L600.3,384.2L601.3,380.7L600.1,380.3L602.4,378.2L601.9,375.6L600.1,374.3L597.4,377.7L588.4,379.6L580.7,364.8L577.9,364.4L574.6,359.1L570.0,359.4L570.2,362.4L567.5,362.7L567.9,364.9L571.4,367.2L570.2,372.1L568.3,371.1L566.5,373.0L564.9,372.5L564.9,368.5L562.7,364.2L561.2,366.2L562.4,367.5L559.9,369.7L559.1,368.6L557.2,371.4L546.2,370.7L546.9,376.3L544.8,382.1L554.2,385.2L553.0,388.3L550.5,388.4L544.1,385.6L544.2,382.0L541.6,381.5L541.5,384.9L543.9,387.7L543.0,389.1L545.0,390.2L541.2,389.3L540.1,390.4Z"/>\n    <path id="dist-guntur" class="dp" data-id="guntur" data-name="Guntur" d="M496.2,392.6L494.1,393.9L493.1,397.5L490.3,397.0L489.2,399.3L485.0,399.1L483.7,400.4L482.1,402.7L483.7,403.6L482.3,409.2L477.1,406.9L476.3,411.6L474.3,411.2L473.9,414.3L469.2,414.3L469.9,418.6L473.3,420.1L478.3,417.6L483.5,421.8L485.4,418.1L490.2,419.1L497.1,412.5L498.0,414.6L499.7,412.9L498.2,418.6L487.5,428.8L488.1,429.7L490.3,428.2L492.3,429.6L488.2,438.1L491.5,441.1L490.4,442.8L487.8,441.9L483.1,443.1L483.5,449.8L484.9,447.9L493.2,447.4L496.4,452.4L500.8,451.3L502.6,453.1L509.8,454.9L509.9,457.4L513.5,457.3L514.2,453.5L519.3,453.9L519.4,455.5L523.8,452.9L523.2,454.8L524.4,455.2L525.0,453.5L527.9,453.2L528.2,450.8L530.6,451.6L531.3,449.0L533.0,448.5L531.9,446.9L532.8,441.3L529.0,438.6L529.4,434.7L528.1,434.5L527.0,437.1L525.6,436.2L526.3,431.7L528.2,431.5L527.3,427.8L529.4,427.7L530.7,424.1L533.6,423.4L534.6,425.2L539.0,426.2L542.2,430.1L544.8,428.2L545.6,424.5L548.6,423.9L549.2,422.1L553.1,423.8L553.3,421.5L557.5,420.5L557.3,421.8L560.3,422.4L559.7,416.8L552.8,410.2L550.0,403.8L543.1,397.9L542.1,391.8L527.4,383.5L519.5,377.1L510.1,376.0L510.1,380.0L507.2,384.4L509.9,391.0L503.8,390.7L501.9,393.2L496.2,392.6Z"/>\n    <path id="dist-palnadu" class="dp" data-id="palnadu" data-name="Palnadu" d="M349.6,432.2L362.1,424.2L368.3,423.6L378.5,414.2L385.6,415.9L390.4,413.8L394.5,417.8L393.5,428.7L390.4,432.9L392.9,441.3L391.8,445.2L395.2,454.2L393.5,461.9L400.9,463.9L400.5,465.3L403.8,467.4L407.5,466.0L411.5,468.6L410.8,471.5L415.0,473.7L413.8,476.7L421.9,478.3L422.1,476.0L418.7,473.7L419.8,468.3L423.6,466.3L424.6,462.8L435.1,466.1L436.5,462.9L439.6,462.6L440.6,460.2L437.9,455.6L434.2,455.7L435.2,450.8L441.9,447.8L441.3,444.8L435.0,442.0L435.9,437.6L434.6,436.8L436.4,434.1L442.9,437.2L445.4,436.0L446.3,432.9L452.7,436.1L455.3,439.5L459.4,437.3L458.1,442.4L462.6,442.5L462.1,444.8L465.7,453.4L471.4,452.8L471.1,448.8L473.5,448.7L477.6,451.5L478.2,449.7L483.6,450.6L483.1,443.1L490.8,442.5L491.5,441.1L488.2,438.1L492.3,429.6L490.3,428.2L488.1,429.7L487.5,428.8L498.2,418.6L499.5,412.6L498.0,414.6L497.1,412.5L491.0,418.8L485.4,418.1L483.5,421.8L478.3,417.6L473.3,420.1L469.9,418.6L469.2,414.3L473.9,414.3L474.3,411.2L476.3,411.6L477.1,406.9L482.3,409.2L483.7,403.6L482.4,402.0L485.0,399.1L489.0,399.4L490.3,397.0L493.1,397.5L495.4,392.7L501.9,393.2L503.8,390.7L509.9,391.0L507.2,384.4L510.1,380.0L510.2,375.9L502.2,376.1L497.1,372.8L486.5,372.9L471.5,367.4L472.4,357.7L470.3,348.6L468.2,344.7L466.2,344.5L462.4,345.2L459.7,355.4L456.7,359.0L452.4,360.6L447.9,368.4L445.2,369.8L440.0,369.5L436.4,361.4L432.8,360.1L427.9,362.0L422.6,356.7L418.2,358.4L415.2,362.3L409.5,361.8L403.7,366.2L398.7,364.5L390.8,370.2L386.3,369.4L378.5,371.7L374.4,377.1L363.9,376.7L357.8,379.4L353.3,378.7L351.7,383.2L347.9,386.5L347.2,390.0L349.8,393.2L346.7,395.3L346.7,407.2L349.9,409.9L347.3,430.5L348.2,433.0L349.6,432.2Z"/>\n    <path id="dist-bapatla" class="dp" data-id="bapatla" data-name="Bapatla" d="M474.9,491.8L477.4,490.5L478.1,487.0L482.4,484.5L482.8,480.8L489.3,484.6L487.1,487.7L483.3,485.2L482.1,486.5L475.6,501.5L476.3,505.7L485.1,507.1L491.7,495.6L503.4,485.3L525.5,474.8L546.3,471.0L556.2,473.2L561.0,476.3L561.3,479.9L559.4,480.7L562.1,489.7L560.2,489.0L556.3,479.6L555.8,480.8L559.2,488.9L564.4,493.3L565.5,485.6L569.8,475.4L571.6,474.2L573.9,466.0L570.9,445.7L569.6,445.7L569.1,440.7L567.4,440.9L568.5,436.9L563.8,428.1L565.5,425.9L562.7,425.6L562.3,422.5L554.3,420.8L553.1,423.8L550.1,422.0L545.6,424.5L544.8,428.2L542.2,430.1L539.0,426.2L534.6,425.2L533.6,423.4L530.7,424.1L529.4,427.7L527.3,427.8L528.2,431.5L526.3,431.7L525.6,436.2L527.0,437.1L528.1,434.5L529.4,434.7L529.0,438.6L532.8,441.3L531.9,446.9L533.0,448.5L531.3,449.0L530.6,451.6L528.2,450.8L527.9,453.2L525.0,453.5L524.4,455.2L523.2,454.8L523.8,452.9L519.4,455.5L519.3,453.9L514.2,453.5L513.5,457.3L509.9,457.4L509.8,454.9L502.6,453.1L500.8,451.3L496.4,452.4L493.2,447.4L484.9,447.9L483.6,450.6L478.2,449.7L477.6,451.5L473.5,448.7L471.1,448.8L471.4,452.8L468.8,452.1L463.3,454.1L462.6,455.7L458.8,455.8L456.9,458.9L457.8,460.4L455.8,462.9L453.5,462.6L452.9,464.9L456.6,467.4L459.4,466.6L459.5,469.4L463.0,471.5L473.1,474.2L472.4,478.3L474.9,481.7L471.3,490.3L474.9,491.8Z"/>\n    <path id="dist-prakasam" class="dp" data-id="prakasam" data-name="Prakasam" d="M461.0,569.9L464.0,563.7L463.9,553.3L467.7,542.1L479.6,526.8L483.6,516.7L485.1,507.1L476.3,505.7L476.6,497.6L482.8,485.7L487.1,487.7L489.3,484.6L482.8,480.8L482.4,484.5L478.1,487.0L475.7,492.1L471.4,490.4L474.9,481.7L472.4,478.3L473.1,474.2L463.0,471.5L459.5,469.4L459.4,466.6L456.6,467.4L452.9,464.9L453.5,462.6L455.8,462.9L457.8,460.4L456.9,458.9L458.8,455.8L462.6,455.7L463.3,454.1L466.1,453.6L464.2,452.1L462.6,442.5L458.1,442.4L459.6,437.5L454.3,439.2L452.7,436.1L446.3,432.9L445.4,436.0L442.9,437.2L436.4,434.1L434.6,436.8L435.9,437.6L435.0,442.0L441.3,444.8L441.9,447.8L435.2,450.8L434.2,455.7L437.9,455.6L440.6,460.2L439.6,462.6L436.5,462.9L435.1,466.1L424.6,462.8L423.6,466.3L419.8,468.3L418.7,473.7L422.1,476.0L421.9,478.3L413.8,476.7L415.0,473.7L410.8,471.5L411.5,468.6L407.5,466.0L403.8,467.4L400.5,465.3L400.9,463.9L393.5,461.9L395.2,454.4L389.0,457.1L386.1,460.2L380.5,460.4L375.8,462.7L365.8,473.8L361.5,475.8L360.4,480.9L361.8,480.7L366.3,486.8L367.5,487.2L369.6,483.1L375.3,485.4L375.5,489.2L382.6,491.1L385.5,490.0L387.6,494.1L400.7,490.1L405.5,496.9L410.6,500.0L414.9,507.3L421.2,510.5L425.2,514.8L425.0,516.9L423.2,517.4L412.3,512.5L412.1,510.0L408.7,508.8L406.7,511.9L404.4,511.2L403.0,512.4L401.2,509.6L398.6,513.4L400.5,516.4L399.4,518.5L401.4,525.0L399.3,524.6L398.0,531.0L394.3,536.2L395.9,537.5L401.0,532.4L405.7,535.5L408.3,533.2L410.4,536.1L406.5,540.5L406.5,545.3L408.0,545.4L407.2,553.6L405.7,553.6L406.4,556.0L402.0,565.8L403.0,566.9L404.2,565.4L405.7,568.5L402.2,569.1L403.4,575.7L400.2,581.4L403.0,584.4L410.8,584.4L414.4,582.0L416.9,585.0L422.9,580.1L425.4,581.7L423.3,585.2L424.9,586.6L423.0,591.6L434.6,594.0L435.7,590.8L437.7,590.5L439.7,587.6L447.5,586.0L456.4,591.7L458.1,587.8L459.9,588.5L459.1,577.2L461.0,569.9Z"/>\n    <path id="dist-markapuram" class="dp" data-id="markapuram" data-name="Markapuram" d="M409.1,538.8L410.4,536.1L408.3,533.2L405.7,535.5L400.5,532.5L395.9,537.5L394.3,536.2L398.0,531.0L399.3,524.6L401.4,525.0L399.4,518.5L400.5,516.4L398.6,513.7L400.3,510.1L401.6,509.8L403.0,512.4L404.4,511.2L406.7,511.9L408.6,508.8L410.9,509.4L411.8,512.2L423.2,517.4L425.0,516.9L424.7,514.0L414.9,507.3L410.6,500.0L405.8,497.2L400.7,490.1L387.6,494.1L385.5,490.0L382.6,491.1L375.5,489.2L375.3,485.4L369.6,483.1L367.5,487.2L366.3,486.8L365.1,484.0L360.4,480.9L361.5,475.8L365.8,473.8L375.8,462.7L380.5,460.4L386.1,460.2L389.0,457.1L395.0,454.8L391.8,445.2L392.9,441.3L390.4,432.9L393.5,428.7L394.5,417.8L390.4,413.8L385.6,415.9L378.5,414.2L368.3,423.6L362.1,424.2L348.2,433.0L347.3,424.5L339.6,426.7L334.8,423.7L331.7,424.9L322.5,422.3L319.6,422.6L316.5,426.6L306.1,429.8L309.1,442.4L306.4,459.2L296.5,467.4L293.0,472.6L287.7,500.0L287.7,532.9L283.0,545.1L283.8,564.7L288.6,562.3L307.6,564.0L308.7,558.5L311.4,558.4L312.7,565.5L315.1,566.7L319.8,566.6L320.6,565.0L329.6,565.8L328.1,570.9L330.4,582.6L331.9,577.9L335.9,577.6L335.7,575.7L347.2,577.6L352.5,574.7L359.8,577.4L363.5,573.4L362.5,576.9L364.6,577.7L365.7,573.4L367.8,577.7L371.2,576.9L370.8,579.0L374.7,579.2L375.3,581.5L381.4,579.9L392.2,586.1L393.6,586.2L394.0,583.2L402.4,584.7L402.9,583.6L400.2,581.4L403.4,575.7L402.2,569.1L405.7,568.5L404.2,565.4L403.0,566.9L402.0,565.8L406.4,556.0L405.7,553.6L407.2,553.6L408.0,545.4L406.5,545.3L406.5,540.5L407.4,538.6L409.1,538.8Z"/>\n    <path id="dist-sri-potti-sriramulu-nellore" class="dp" data-id="sri-potti-sriramulu-nellore" data-name="SPSR Nellore" d="M471.7,713.6L469.9,695.7L471.8,684.8L475.2,676.2L478.7,644.3L475.5,641.0L471.8,628.4L466.1,619.8L459.9,588.5L458.1,587.8L456.1,591.7L447.9,586.1L443.7,586.0L435.7,590.8L434.6,594.0L431.8,593.8L423.0,591.6L424.9,586.6L423.3,585.2L425.4,581.7L422.9,580.1L416.9,585.0L414.4,582.0L408.8,584.7L394.0,583.2L393.6,586.2L381.4,579.9L377.4,581.7L374.6,581.2L374.7,579.2L370.8,579.0L371.2,576.9L367.8,577.7L365.7,573.4L364.6,577.7L362.5,576.9L363.2,573.4L359.8,577.4L352.5,574.7L347.2,577.6L336.8,575.5L335.9,577.6L331.9,577.9L329.4,591.8L332.0,601.8L336.5,607.2L338.6,616.8L343.4,627.9L341.8,631.8L343.6,634.9L343.5,639.8L347.9,644.4L349.2,642.5L350.8,643.7L355.8,651.9L357.7,658.3L360.9,659.3L362.6,665.9L367.4,672.6L367.5,676.2L370.6,677.5L375.1,685.9L376.8,690.6L375.1,695.6L375.9,698.5L389.3,700.2L403.0,709.0L404.6,708.0L404.4,702.8L407.7,703.1L408.1,707.1L418.5,711.4L416.8,713.9L418.6,718.6L420.9,720.0L423.1,719.9L423.6,716.7L426.8,719.2L427.6,717.1L439.6,718.3L442.5,716.9L450.3,719.5L450.3,723.7L453.1,722.0L459.7,723.4L463.5,718.0L467.5,717.9L468.1,713.5L471.7,713.6Z"/>\n    <path id="dist-kurnool" class="dp" data-id="kurnool" data-name="Kurnool" d="M147.0,537.5L150.8,532.7L154.5,535.0L158.0,528.3L156.8,526.8L159.5,523.4L164.2,524.0L163.2,526.0L164.3,526.6L167.2,523.7L170.1,526.6L172.0,526.4L171.7,529.3L176.2,533.3L180.5,531.2L183.6,531.5L184.0,527.7L188.0,528.3L188.1,526.1L191.1,525.1L191.0,516.4L194.3,517.9L195.2,512.5L202.5,511.3L204.2,512.9L202.9,517.8L209.6,516.1L208.3,513.4L209.8,509.5L213.6,509.8L213.2,506.2L220.2,503.1L220.9,494.9L212.8,496.0L212.0,493.5L209.6,492.3L210.0,489.8L206.0,487.7L211.8,483.2L205.6,481.2L204.8,479.5L207.7,478.3L206.7,474.3L201.8,474.7L202.2,476.8L195.9,476.4L190.5,471.7L190.2,467.7L188.5,467.3L185.4,473.4L180.9,470.5L176.1,470.6L169.4,467.4L165.2,470.5L157.9,471.8L147.6,468.9L138.3,470.2L132.2,465.8L129.4,466.6L107.3,461.8L100.6,462.9L83.5,459.6L71.2,461.5L64.1,464.3L59.6,467.0L54.3,474.1L54.2,477.5L58.7,478.0L59.0,483.4L56.4,487.6L56.5,491.1L60.6,491.5L61.7,493.1L60.5,495.8L67.3,499.8L66.3,504.4L61.1,500.7L54.0,504.0L54.0,521.7L46.6,520.6L46.6,522.3L54.1,531.0L53.8,534.8L56.2,537.2L55.3,540.0L58.7,542.9L58.3,545.1L65.2,544.3L65.8,549.6L70.3,549.9L69.8,552.5L72.4,553.1L72.5,554.5L69.2,554.6L66.9,556.9L66.7,558.7L70.7,560.3L72.6,566.1L71.8,568.0L68.8,567.9L68.4,569.9L73.7,570.1L77.1,567.7L89.2,571.5L92.4,565.4L97.2,565.2L98.7,559.2L107.1,559.1L110.3,561.6L110.5,559.3L114.6,561.2L120.7,559.0L128.8,564.2L132.0,564.5L132.5,561.4L135.1,561.4L135.5,559.4L140.5,558.1L141.8,556.2L142.4,546.4L137.6,543.9L140.1,538.0L141.3,536.4L146.1,538.4L147.0,537.5Z"/>\n    <path id="dist-nandyal" class="dp" data-id="nandyal" data-name="Nandyal" d="M186.1,574.0L183.5,580.4L185.6,582.3L185.6,585.4L188.8,589.2L191.5,590.1L192.3,588.7L196.1,591.5L195.9,592.8L202.1,594.3L202.5,596.1L207.0,593.9L213.8,595.1L215.8,588.7L216.9,589.2L219.1,585.5L222.3,584.9L221.1,581.3L223.8,579.2L227.9,579.3L233.0,582.1L234.0,579.5L235.5,579.9L235.0,581.6L237.8,582.6L233.7,585.5L231.7,584.9L230.2,588.8L236.8,593.4L239.2,592.8L240.5,584.9L249.3,584.2L247.8,580.6L249.0,579.4L252.3,579.9L253.5,589.5L249.0,599.5L248.2,602.2L249.3,602.5L253.9,595.3L256.7,593.8L258.2,594.3L257.6,598.2L262.3,596.3L263.6,597.2L264.9,595.2L268.8,596.6L268.7,599.1L276.1,597.3L277.0,593.3L280.6,593.3L279.4,586.1L285.2,584.2L286.5,581.2L284.9,574.6L286.0,564.3L283.8,564.7L283.1,562.3L283.0,545.1L287.7,532.9L287.7,500.0L293.0,472.6L296.5,467.4L306.4,459.2L309.1,442.4L308.0,437.9L307.9,441.1L303.5,443.5L301.6,435.9L296.2,435.3L296.5,445.4L290.3,451.6L283.6,453.6L275.7,450.3L271.5,444.3L268.4,443.1L264.9,443.6L258.2,449.2L247.7,445.6L239.1,444.8L233.1,448.7L228.2,449.8L226.4,453.2L219.0,451.5L218.1,463.4L208.6,467.2L209.7,469.3L206.6,475.5L207.7,478.3L204.8,479.5L206.0,481.7L211.8,483.2L206.0,487.7L210.0,489.8L209.3,491.6L212.6,495.9L220.9,494.9L220.2,503.1L213.2,506.2L213.6,509.8L209.8,509.5L208.3,513.4L209.6,516.1L202.9,517.8L204.2,512.9L202.5,511.3L195.2,512.5L194.3,517.9L191.0,516.4L191.1,525.1L188.1,526.1L188.0,528.3L184.0,527.7L183.6,531.5L180.5,531.2L176.2,533.3L171.7,529.3L172.0,526.4L170.1,526.6L167.2,523.7L164.3,526.6L163.2,526.0L164.2,524.0L159.5,523.4L156.8,526.8L158.0,528.3L154.5,535.0L150.8,532.7L146.1,538.4L141.3,536.4L137.6,543.6L142.4,546.4L140.8,559.6L143.6,561.4L143.2,564.6L145.5,564.0L146.1,565.9L148.4,566.5L148.0,568.8L150.6,571.8L153.9,572.4L153.4,573.8L156.3,574.8L159.5,569.9L162.6,569.6L163.1,571.7L167.4,570.9L168.7,565.1L171.4,565.2L174.0,567.5L171.6,572.6L179.0,574.5L180.7,570.4L186.1,574.0Z"/>\n    <path id="dist-anantapur" class="dp" data-id="anantapur" data-name="Anantapuram" d="M192.8,646.5L196.0,638.7L200.7,639.4L202.3,630.0L198.9,630.4L196.8,627.5L193.1,627.3L194.4,622.3L190.4,619.5L194.4,612.3L197.9,613.4L199.4,609.1L196.2,608.2L196.8,604.6L202.4,595.2L195.9,592.8L196.1,591.5L192.3,588.7L191.5,590.1L188.8,589.2L185.6,585.4L185.6,582.3L183.5,580.4L186.1,573.9L183.4,571.3L180.7,570.4L179.0,574.5L171.6,572.6L174.0,569.1L173.4,565.7L168.7,565.1L167.4,570.9L163.1,571.7L162.6,569.6L159.5,569.9L156.3,574.8L150.3,571.5L148.0,568.8L148.4,566.5L146.1,565.9L145.5,564.0L143.0,564.4L143.6,561.4L139.2,557.7L135.5,559.4L135.1,561.4L132.5,561.4L132.0,564.5L128.8,564.2L120.7,559.0L114.6,561.2L110.5,559.3L110.3,561.6L107.1,559.1L98.7,559.2L97.2,565.2L92.4,565.4L89.2,571.5L77.1,567.7L73.7,570.1L71.2,569.5L70.1,574.1L67.4,575.7L65.1,584.6L61.3,585.0L61.0,588.3L59.6,588.5L55.9,587.8L56.6,584.7L50.5,584.6L48.0,587.1L39.0,584.3L33.5,585.0L32.0,581.1L23.2,576.2L20.0,578.6L19.5,581.2L21.8,586.4L19.7,590.1L17.8,590.5L18.6,592.6L25.6,593.3L26.9,595.0L32.1,593.2L32.5,597.5L31.7,603.2L29.2,604.0L30.8,606.7L30.3,610.3L28.7,611.0L30.4,614.7L28.1,614.5L28.0,617.2L20.7,617.9L23.6,623.7L19.8,631.9L18.4,642.6L20.7,643.3L23.9,652.0L27.3,652.1L30.6,655.0L32.2,659.7L36.6,657.7L46.6,658.2L45.3,662.1L42.5,662.9L42.2,669.6L38.6,666.9L34.6,670.3L34.5,676.7L37.0,680.1L42.7,681.3L44.1,683.9L39.9,686.6L42.7,690.9L48.0,690.2L50.7,691.7L56.8,690.4L60.9,694.6L65.4,693.4L65.4,684.2L67.5,682.1L68.2,678.2L71.1,677.4L76.6,680.3L81.9,680.8L88.4,677.7L88.0,685.4L97.9,686.2L96.9,682.0L92.9,681.6L92.5,678.5L94.5,675.9L92.5,672.7L92.8,668.2L94.6,662.7L98.7,661.4L98.1,658.5L100.6,656.5L97.8,651.0L102.3,649.0L105.0,649.6L113.0,647.2L115.2,659.6L119.5,657.7L123.2,661.6L126.6,661.3L126.7,662.6L131.8,661.6L135.4,657.6L139.5,658.0L140.8,655.4L137.2,653.8L137.8,651.4L143.0,651.3L146.1,645.9L148.8,646.0L148.9,643.8L153.8,643.5L157.9,640.7L159.7,642.7L164.3,642.8L164.7,641.7L162.7,641.2L164.8,640.9L164.1,637.8L166.7,635.6L181.9,640.0L182.4,650.8L189.6,651.7L189.5,647.3L192.8,646.5Z"/>\n    <path id="dist-sri-sathya-sai" class="dp" data-id="sri-sathya-sai" data-name="Sri Sathya Sai" d="M93.1,672.6L94.5,676.1L92.5,678.5L92.9,681.6L96.9,682.0L98.8,686.3L98.2,691.9L101.2,693.3L101.9,696.5L106.3,695.0L104.8,688.5L102.1,687.2L100.6,682.9L102.7,678.3L107.4,679.2L107.9,681.4L109.8,680.8L110.4,685.7L114.8,684.3L117.6,688.0L116.0,692.2L119.4,698.4L117.6,702.3L112.6,700.3L102.5,700.2L101.1,704.8L97.2,705.8L96.6,709.5L102.5,706.4L103.4,708.6L94.8,717.7L95.0,719.4L102.3,721.1L101.2,726.6L108.5,725.8L108.4,730.4L105.3,730.6L105.8,733.6L108.3,734.8L103.5,738.3L103.3,735.9L97.5,736.2L96.6,734.6L99.8,729.6L96.9,728.9L98.4,724.6L95.1,723.9L93.2,719.3L91.2,719.0L86.9,721.8L87.4,719.0L86.2,718.7L82.9,721.8L73.4,721.6L73.2,723.3L70.4,723.3L68.9,722.8L67.0,717.0L60.6,717.7L60.2,716.2L54.2,715.7L53.9,711.4L51.9,709.9L53.5,706.6L53.4,699.9L44.8,699.0L42.9,696.8L42.2,700.1L35.8,700.8L34.7,704.8L38.3,706.1L39.9,705.0L42.7,707.4L43.0,711.0L46.4,712.1L46.2,715.5L40.9,716.0L40.7,719.3L49.8,724.6L49.1,728.4L55.5,732.3L56.3,735.9L53.0,736.4L51.9,742.1L48.9,743.6L46.8,747.9L48.6,748.5L49.5,757.2L52.2,758.5L53.2,753.0L55.8,753.2L58.3,757.5L60.1,757.9L61.5,757.9L62.1,754.6L73.2,755.3L74.0,752.7L71.1,749.4L72.6,746.2L67.2,742.6L69.8,741.0L72.6,741.5L71.7,735.9L74.8,733.4L75.3,741.2L76.9,741.7L78.6,738.6L79.5,741.1L81.6,736.2L83.3,736.6L84.4,744.0L88.9,743.8L91.7,741.3L93.7,745.8L98.6,742.9L101.1,744.9L108.0,744.4L105.8,749.3L107.5,749.3L106.7,750.4L112.3,749.1L111.2,751.7L113.1,755.9L112.4,762.2L110.3,762.2L111.1,766.0L116.0,765.0L115.0,761.6L119.0,761.9L118.7,764.0L120.4,764.8L122.0,759.5L120.0,757.7L120.8,756.4L123.4,756.5L125.2,760.6L130.5,756.8L132.3,756.6L134.2,759.0L136.2,757.3L133.0,756.2L133.3,754.4L141.3,752.0L140.1,755.5L144.4,754.3L146.2,758.1L146.5,750.2L154.9,747.8L155.2,744.1L158.9,743.6L162.3,740.8L159.2,735.0L160.9,730.8L162.9,732.0L170.2,731.3L170.2,734.1L174.3,736.1L179.8,728.7L182.5,729.3L182.4,736.4L177.4,738.5L177.9,746.6L181.0,746.2L184.3,740.4L190.4,741.9L190.8,737.3L194.8,739.3L195.1,742.0L199.6,741.8L201.0,745.9L199.4,749.2L201.5,752.1L215.8,753.0L219.3,751.4L218.6,745.5L216.5,744.1L219.8,742.5L220.8,737.4L223.9,737.8L224.6,735.7L228.7,734.4L229.5,731.8L233.9,729.2L236.1,731.6L241.5,726.2L246.9,723.9L247.2,722.4L243.3,720.9L243.6,712.4L245.4,711.7L246.1,709.0L244.1,705.2L240.8,703.4L241.7,696.8L238.7,696.3L240.7,685.3L237.2,686.2L232.1,684.0L222.4,684.1L198.5,670.6L184.3,657.7L181.1,651.1L177.0,647.1L179.6,644.4L181.0,647.1L182.7,646.8L181.8,643.4L182.9,641.1L178.6,638.4L168.0,637.0L166.7,635.6L164.1,637.8L164.8,640.9L162.7,641.2L164.7,641.7L164.1,642.9L159.7,642.7L157.9,640.7L153.8,643.5L148.9,643.8L148.8,646.0L146.1,645.9L143.0,651.3L137.8,651.4L137.2,653.8L140.8,655.4L139.5,658.0L135.4,657.6L131.8,661.6L126.7,662.6L126.6,661.3L123.2,661.6L119.5,657.7L115.2,659.6L113.0,647.2L105.0,649.6L102.3,649.0L97.8,651.0L100.6,656.5L98.1,658.5L98.7,661.4L94.6,662.7L93.4,665.1L93.1,672.6Z"/>\n    <path id="dist-ysr-kadapa" class="dp" data-id="ysr-kadapa" data-name="YSR Kadapa" d="M321.1,706.4L323.3,706.7L321.0,699.9L322.6,699.8L323.9,697.1L325.3,698.8L325.0,704.0L328.7,702.0L334.6,705.2L337.7,703.8L340.7,708.1L343.6,705.4L341.8,702.0L344.0,702.2L344.0,700.7L349.5,699.0L352.0,701.5L351.8,698.0L347.0,695.6L345.8,691.3L341.9,688.2L346.5,684.5L347.1,685.8L350.2,684.1L353.9,676.4L355.6,678.9L359.5,675.1L355.8,670.2L353.8,670.7L349.6,667.7L351.0,664.1L356.6,663.5L357.7,656.9L350.8,643.7L349.2,642.5L347.9,644.4L343.5,639.8L343.6,634.9L341.8,631.8L343.4,627.9L338.6,616.8L336.5,607.2L332.0,601.8L329.4,591.8L330.4,582.6L328.1,568.4L329.6,565.8L320.6,565.0L319.8,566.6L315.1,566.7L312.7,565.5L311.4,558.4L308.7,558.5L307.6,564.0L288.6,562.3L286.0,564.3L284.9,571.1L286.4,581.9L285.2,584.2L279.4,586.1L280.6,593.3L277.0,593.3L276.1,597.3L272.9,598.5L268.7,599.1L268.8,596.6L264.9,595.2L263.6,597.2L262.3,596.3L258.1,598.4L258.2,594.3L256.7,593.8L248.2,602.2L253.2,591.4L253.4,581.0L252.3,579.9L249.0,579.4L247.8,580.6L249.3,584.2L240.5,584.9L239.2,592.8L236.8,593.4L230.2,588.8L231.7,584.9L233.7,585.5L237.8,582.6L235.0,581.6L235.5,579.9L234.0,579.5L233.0,582.1L224.7,579.2L221.1,581.3L222.3,584.9L219.1,585.5L216.9,589.2L215.8,588.7L213.8,595.1L205.2,594.2L201.8,597.9L199.5,598.2L196.2,607.7L199.4,609.1L197.9,613.4L194.4,612.3L190.4,619.7L194.4,622.3L193.1,627.3L196.8,627.5L198.9,630.4L202.3,630.0L200.7,639.4L196.0,638.7L192.8,646.5L189.5,647.3L190.1,650.4L188.6,652.1L182.4,650.8L179.6,644.4L176.8,646.7L181.1,651.1L184.3,657.7L198.5,670.6L222.4,684.1L232.1,684.0L237.2,686.2L240.7,685.3L238.7,696.3L241.7,696.8L242.0,698.5L247.0,700.0L248.2,701.8L251.1,700.2L254.6,700.6L255.1,702.6L258.7,702.4L267.9,695.3L267.2,691.9L264.6,689.7L265.0,685.4L271.4,686.6L272.7,687.7L271.6,689.8L273.8,690.4L275.9,686.9L273.6,683.5L282.6,684.0L284.6,683.1L284.1,681.8L286.6,681.8L286.2,683.1L287.9,683.4L284.7,685.7L286.9,691.9L295.4,696.1L292.8,703.1L290.7,704.4L291.2,713.8L296.0,715.1L299.2,711.4L300.4,711.9L300.5,717.6L303.2,718.1L297.9,723.1L301.8,735.4L300.9,737.0L307.3,738.2L309.8,737.1L311.6,738.8L316.2,737.8L318.1,735.3L321.6,737.9L330.6,739.3L331.8,743.4L335.4,743.4L338.4,741.4L333.2,736.4L331.5,731.6L326.5,732.6L323.1,728.4L321.5,722.4L323.4,722.2L320.2,720.5L320.1,714.4L318.9,713.5L323.3,711.1L324.8,712.0L324.9,710.0L321.1,706.4Z"/>\n    <path id="dist-annamayya" class="dp" data-id="annamayya" data-name="Annamayya" d="M300.0,714.6L300.4,711.9L299.2,711.4L296.0,715.1L291.2,713.8L290.7,704.4L292.8,703.1L295.4,696.1L286.9,691.9L284.7,685.7L287.9,683.4L286.2,683.1L286.6,681.8L284.1,681.8L284.6,683.1L282.6,684.0L273.6,683.5L275.9,686.9L273.8,690.4L271.6,689.8L272.7,687.7L271.4,686.6L265.0,685.4L264.6,689.7L268.3,694.9L263.4,697.9L263.0,699.7L260.2,700.3L260.0,701.8L255.1,702.6L254.6,700.6L251.1,700.2L248.2,701.8L247.0,700.0L242.0,698.5L241.0,699.5L241.2,704.4L243.7,704.8L246.1,709.0L245.4,711.7L243.6,712.4L244.4,716.3L243.3,717.6L243.6,721.3L247.2,722.4L246.0,725.1L241.5,726.2L236.1,731.6L233.9,729.2L229.5,731.8L228.7,734.4L224.6,735.7L223.9,737.8L220.8,737.4L219.8,742.5L216.5,744.1L218.6,745.5L219.3,751.4L215.8,753.0L201.2,751.8L196.5,758.0L200.4,761.6L199.4,764.6L193.7,763.8L193.0,766.8L196.2,769.1L195.9,771.2L199.6,769.3L205.2,769.2L206.9,769.8L206.8,772.7L211.6,773.2L210.1,781.8L216.0,777.2L218.9,779.4L227.8,777.7L238.1,778.6L238.8,780.2L234.6,789.3L235.4,804.8L233.2,809.0L239.0,811.2L237.1,812.8L235.6,811.5L234.8,813.0L238.0,815.3L241.6,813.1L243.3,813.5L243.8,816.2L248.9,814.4L248.5,817.1L253.1,818.6L255.6,821.8L256.6,819.0L259.3,819.2L260.1,815.7L264.6,813.2L265.1,810.0L267.3,813.2L270.7,812.7L272.9,814.5L273.6,811.2L276.3,810.1L276.4,807.6L280.7,810.2L285.8,808.8L288.3,814.2L291.7,812.9L298.4,815.6L303.9,814.8L306.0,810.5L308.8,808.6L311.3,801.3L309.1,797.7L313.3,795.4L315.8,791.6L315.3,786.4L311.6,784.9L311.7,779.7L314.6,777.0L313.6,773.8L318.0,772.8L316.9,769.7L315.1,769.3L317.7,767.7L315.4,761.4L323.6,757.0L323.6,754.0L321.5,753.9L320.9,752.3L321.3,749.8L324.0,749.6L324.0,748.3L320.2,746.7L320.0,744.2L324.9,741.7L321.2,739.6L321.5,737.9L318.1,735.3L316.2,737.8L311.6,738.8L309.8,737.1L307.3,738.2L300.9,737.0L301.8,735.4L297.9,723.1L303.2,718.1L300.5,717.6L300.0,714.6Z"/>\n    <path id="dist-tirupati" class="dp" data-id="tirupati" data-name="Tirupati" d="M321.1,706.4L324.9,710.0L324.8,712.0L323.3,711.1L318.9,713.5L320.1,714.4L320.2,720.5L323.4,722.2L321.5,722.4L323.1,728.4L326.5,732.6L331.5,731.6L333.2,736.4L338.4,741.4L335.4,743.4L331.8,743.4L330.6,739.3L321.6,737.9L318.3,735.5L321.5,737.9L321.2,739.6L324.9,741.7L320.0,744.2L320.2,746.7L324.0,748.3L324.0,749.6L321.2,750.0L321.5,753.9L330.3,752.6L329.4,758.4L330.9,760.3L328.7,767.8L325.6,770.7L325.1,774.6L341.5,776.6L342.2,778.0L341.2,781.8L342.5,784.2L337.7,787.5L329.5,788.6L328.5,784.9L323.9,783.0L324.3,785.1L320.7,785.3L316.2,789.1L315.8,791.6L322.8,794.1L325.6,798.3L327.8,797.1L330.4,798.1L330.6,800.5L337.4,801.0L339.5,803.8L345.1,802.7L348.8,803.7L349.0,802.4L345.9,800.9L353.1,800.8L347.5,798.9L348.9,797.6L350.5,798.5L354.4,793.8L363.3,791.7L364.4,792.2L362.5,794.8L365.3,795.0L370.1,791.9L374.7,792.3L384.2,789.0L384.3,791.1L388.1,791.2L385.2,794.4L382.2,794.0L382.6,795.7L387.3,795.3L389.8,797.7L385.8,799.2L385.8,800.8L382.8,802.5L384.0,803.7L382.9,805.8L384.7,806.3L389.6,803.3L391.3,805.2L386.1,809.6L387.0,811.7L390.3,812.2L396.0,808.3L405.5,810.2L407.8,808.3L406.6,803.8L411.3,803.5L410.8,799.1L412.0,798.0L414.3,798.9L413.6,802.1L416.4,806.2L416.7,810.9L418.9,811.3L419.9,814.6L424.7,818.2L427.0,815.0L434.2,815.0L434.9,813.2L436.9,814.2L441.4,809.3L443.7,810.4L445.3,808.8L445.3,806.3L447.0,806.7L447.6,804.7L445.2,804.3L443.8,801.7L448.9,800.1L448.9,794.6L453.6,793.4L455.1,790.7L458.9,791.3L458.7,788.5L456.2,788.6L455.0,786.5L452.7,787.0L452.9,784.2L460.3,785.5L463.6,783.9L463.0,791.9L467.0,791.9L467.8,789.7L471.3,789.9L472.9,791.8L480.8,791.7L485.1,794.2L488.6,781.9L484.0,769.0L486.5,752.6L471.7,713.6L468.1,713.5L467.5,717.9L463.5,718.0L459.7,723.4L453.1,722.0L450.3,723.7L450.3,719.5L442.5,716.9L439.6,718.3L427.6,717.1L426.8,719.2L423.6,716.7L423.1,719.9L420.9,720.0L418.6,718.6L416.8,713.9L418.5,711.4L408.1,707.1L407.7,703.1L404.4,702.8L404.6,708.0L403.0,709.0L389.3,700.2L375.9,698.5L375.1,695.6L376.8,690.6L375.1,685.9L370.6,677.5L367.5,676.2L367.4,672.6L362.6,665.9L362.3,661.9L358.9,658.3L356.2,660.0L356.6,663.5L351.0,664.1L349.6,667.7L353.8,670.7L355.8,670.2L359.5,675.1L355.6,678.9L353.9,676.4L350.2,684.1L347.1,685.8L346.5,684.5L341.9,688.2L345.8,691.3L347.0,695.6L351.8,698.0L352.0,701.5L349.5,699.0L344.0,700.7L344.0,702.2L341.8,702.0L343.6,705.4L340.7,708.1L337.7,703.8L334.6,705.2L328.7,702.0L325.0,704.0L325.3,698.8L323.9,697.1L322.6,699.8L321.0,699.9L323.3,706.7L321.1,706.4Z"/>\n    <path id="dist-chittoor" class="dp" data-id="chittoor" data-name="Chittoor" d="M277.9,807.8L276.4,807.6L276.3,810.1L273.6,811.2L272.9,814.5L270.7,812.7L267.3,813.2L265.1,810.0L264.6,813.2L260.6,816.1L261.8,820.0L263.0,820.0L260.2,828.0L261.9,829.0L258.0,830.7L258.0,832.2L261.5,832.5L262.0,835.1L258.0,835.6L257.4,838.4L253.7,839.8L256.5,843.4L252.7,845.2L253.5,849.1L246.2,851.8L246.4,856.8L247.9,858.7L246.9,860.9L242.6,860.1L242.8,862.6L239.4,864.9L240.3,867.9L243.0,867.1L246.8,870.3L246.6,875.5L243.9,869.4L239.5,870.6L237.7,868.7L236.3,870.1L231.9,865.5L230.4,869.9L227.6,870.8L227.2,872.7L229.4,873.4L226.3,874.2L226.1,876.6L218.0,876.3L217.1,886.0L215.2,889.5L216.5,893.8L211.0,898.6L216.1,899.7L217.0,897.0L220.7,897.2L224.5,902.5L234.2,907.7L241.5,906.5L246.6,908.1L247.9,904.9L247.0,901.1L251.2,901.0L251.7,895.6L254.0,896.3L250.3,893.1L250.4,891.5L253.3,894.5L254.1,893.0L254.7,895.8L257.3,896.4L255.3,896.5L256.0,899.1L259.6,896.6L258.5,895.5L259.8,890.9L258.7,890.4L263.7,886.8L265.7,881.5L264.9,877.6L269.2,866.8L272.4,866.7L269.8,862.3L270.9,861.9L267.5,858.8L272.2,855.6L272.3,853.4L278.8,855.5L280.0,848.4L285.0,850.2L290.9,848.6L293.3,845.6L301.1,846.6L302.9,844.4L304.4,844.8L303.9,853.1L310.0,853.5L308.9,851.5L305.5,851.2L308.2,846.7L314.4,847.6L314.7,846.3L317.8,846.0L326.9,850.4L329.3,854.2L333.8,852.3L340.3,854.9L344.3,851.3L342.6,850.9L344.2,850.1L342.3,849.6L344.2,848.6L342.6,846.3L345.0,846.7L349.9,843.5L349.7,838.9L346.6,837.7L349.9,834.7L351.0,834.6L351.3,839.0L353.0,836.0L353.6,837.6L356.1,837.1L356.5,841.1L360.4,840.7L357.9,842.9L359.6,843.4L364.2,839.2L364.8,841.3L366.8,841.0L366.2,835.5L369.4,835.7L368.4,833.6L370.5,833.8L368.6,832.2L377.3,832.3L376.9,828.8L379.3,828.5L379.2,825.6L376.2,826.7L377.2,825.0L374.6,825.0L375.3,824.0L373.2,822.0L376.6,820.7L378.2,817.1L374.6,818.7L374.0,817.3L370.7,817.6L369.8,815.6L372.4,815.0L372.8,812.6L376.3,812.4L376.9,810.4L379.7,812.2L385.5,810.9L385.2,813.0L386.9,812.7L386.1,809.6L391.3,805.2L389.6,803.3L384.7,806.3L382.9,805.8L384.0,803.7L382.8,802.5L385.8,800.8L385.8,799.2L389.8,797.7L387.3,795.3L382.6,795.7L382.2,794.0L385.2,794.4L388.1,791.2L384.3,791.1L384.2,789.0L374.7,792.3L370.1,791.9L365.3,795.0L362.5,794.8L364.4,792.2L363.3,791.7L354.4,793.8L350.5,798.5L348.9,797.6L347.5,798.9L353.1,800.8L348.1,801.6L346.7,800.2L345.8,801.6L349.0,802.4L348.8,803.7L345.1,802.7L340.9,804.0L339.0,802.0L337.5,802.6L337.4,801.0L330.6,800.5L330.4,798.1L327.8,797.1L325.6,798.3L322.8,794.1L316.0,791.5L313.3,795.4L309.1,797.7L311.4,800.7L309.1,807.9L302.4,815.5L298.4,815.6L291.7,812.9L288.3,814.2L285.8,808.8L280.7,810.2L277.9,807.8ZM337.7,787.5L342.5,784.2L341.5,776.6L325.1,774.6L325.6,770.7L328.7,767.8L330.9,760.3L329.4,758.4L330.3,752.6L325.3,752.9L323.6,754.0L323.3,757.5L315.4,761.4L317.7,767.7L315.1,769.3L316.9,769.7L318.0,772.8L313.6,773.8L314.9,775.5L311.7,779.7L311.6,784.9L315.3,786.4L316.2,789.1L320.7,785.3L324.3,785.1L323.9,783.0L328.5,784.9L329.5,788.6L337.7,787.5ZM404.6,818.6L407.5,818.7L407.7,820.2L410.1,817.9L411.8,821.8L409.7,822.1L409.7,823.6L411.7,825.6L412.1,823.9L413.6,823.9L414.3,825.9L412.7,827.7L413.9,828.4L416.6,827.7L416.8,825.8L419.4,829.9L425.0,827.2L425.1,825.1L416.5,819.6L419.9,818.1L420.7,815.6L419.0,811.4L416.7,810.9L416.4,806.2L413.6,802.1L414.1,798.5L410.9,798.9L411.3,803.5L406.6,803.8L407.8,808.3L405.5,810.2L396.0,808.3L390.5,812.1L390.4,820.8L396.8,823.0L398.4,819.4L400.1,819.0L399.8,820.1L403.2,821.4L404.6,818.6Z"/>\n  </g>\n  <g id="district-labels">\n    <text class="map-dlabel" x="1013.1" y="102.9" text-anchor="middle">Srikakulam</text>\n    <text class="map-dlabel" x="917.2" y="85.6" text-anchor="middle">Parvathipuram Manyam</text>\n    <text class="map-dlabel" x="911.8" y="149.4" text-anchor="middle">Vizianagaram</text>\n    <text class="map-dlabel" x="897.9" y="212.6" text-anchor="middle">Visakhapatnam</text>\n    <text class="map-dlabel" x="796.7" y="178.5" text-anchor="middle">Alluri S. Raju</text>\n    <text class="map-dlabel" x="669.4" y="237.7" text-anchor="middle">Polavaram</text>\n    <text class="map-dlabel" x="821.2" y="230.5" text-anchor="middle">Anakapalli</text>\n    <text class="map-dlabel" x="755.0" y="304.5" text-anchor="middle">Kakinada</text>\n    <text class="map-dlabel" x="678.8" y="321.2" text-anchor="middle">East Godavari</text>\n    <text class="map-dlabel" x="725.5" y="370.5" text-anchor="middle">Konaseema</text>\n    <text class="map-dlabel" x="611.4" y="318.7" text-anchor="middle">Eluru</text>\n    <text class="map-dlabel" x="639.8" y="368.6" text-anchor="middle">West Godavari</text>\n    <text class="map-dlabel" x="510.0" y="345.2" text-anchor="middle">NTR</text>\n    <text class="map-dlabel" x="600.7" y="426.2" text-anchor="middle">Krishna</text>\n    <text class="map-dlabel" x="514.8" y="416.6" text-anchor="middle">Guntur</text>\n    <text class="map-dlabel" x="428.2" y="411.5" text-anchor="middle">Palnadu</text>\n    <text class="map-dlabel" x="513.4" y="463.8" text-anchor="middle">Bapatla</text>\n    <text class="map-dlabel" x="424.8" y="513.4" text-anchor="middle">Prakasam</text>\n    <text class="map-dlabel" x="354.1" y="500.0" text-anchor="middle">Markapuram</text>\n    <text class="map-dlabel" x="404.0" y="648.5" text-anchor="middle">SPSR Nellore</text>\n    <text class="map-dlabel" x="133.7" y="515.6" text-anchor="middle">Kurnool</text>\n    <text class="map-dlabel" x="223.3" y="518.7" text-anchor="middle">Nandyal</text>\n    <text class="map-dlabel" x="110.2" y="626.1" text-anchor="middle">Ananthapuramu</text>\n    <text class="map-dlabel" x="140.9" y="700.8" text-anchor="middle">Sri Sathya Sai</text>\n    <text class="map-dlabel" x="268.1" y="650.9" text-anchor="middle">YSR Kadapa</text>\n    <text class="map-dlabel" x="258.9" y="751.8" text-anchor="middle">Annamayya</text>\n    <text class="map-dlabel" x="402.2" y="738.2" text-anchor="middle">Tirupati</text>\n    <text class="map-dlabel" x="318.0" y="830.3" text-anchor="middle">Chittoor</text>\n  </g>\n</svg>';

  function render(container, appState, data) {
    while (container.firstChild) { container.removeChild(container.firstChild); }

    var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function fyStartYearOf(yyyyMM) { var y = +yyyyMM.substr(0, 4), mo = +yyyyMM.substr(5, 2); return mo >= 4 ? y : y - 1; }
    function fyLabelOf(sy) { var e = (sy + 1) % 100; return sy + '-' + (e < 10 ? '0' : '') + e; }
    var CUR_FY = fyStartYearOf(String(data.fyStart).substr(0, 7));
    var FY_LIST = [];
    if (data.periods) {
      for (var fpi = data.periods.length - 1; fpi >= 0; fpi--) {
        var fsy = fyStartYearOf(data.periods[fpi]);
        if (FY_LIST.indexOf(fsy) === -1 && data.periods.indexOf(fsy + '-04') !== -1) { FY_LIST.push(fsy); }
      }
    }
    var DEFAULT_YEAR = String(CUR_FY);
    var RUNNING_MONTH = (function () {
      if (!data.builtAtMillis) { return null; }
      var b = new Date(Number(data.builtAtMillis)), mm = b.getMonth() + 1;
      return b.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm;
    })();

    function selectedMonthIdx() {
      var sy = Number(S.selectedYear || DEFAULT_YEAR), idx = [];
      for (var i = 0; i < data.periods.length; i++) { if (fyStartYearOf(data.periods[i]) === sy) { idx.push(i); } }
      if (!idx.length || S.period === 'yearly') { return idx; }
      var lastMo = +data.periods[idx[idx.length - 1]].substr(5, 2);
      if (S.period === 'monthly') {
        var picked = idx.filter(function (i) { return data.periods[i] === S.periodValue; });
        return picked.length ? picked : [idx[idx.length - 1]];
      }
      var qOf = function (mo) { return Math.floor(((mo + 8) % 12) / 3); };
      var inQ = function (q) { return idx.filter(function (i) { return qOf(+data.periods[i].substr(5, 2)) === q; }); };
      var chosen = typeof S.periodValue === 'number' ? inQ(S.periodValue - 1) : [];
      return chosen.length ? chosen : inQ(qOf(lastMo));
    }
    function selectionLabel() {
      var idx = selectedMonthIdx(), sy = Number(S.selectedYear || DEFAULT_YEAR);
      if (!idx.length) { return 'FY ' + fyLabelOf(sy) + ' (no data)'; }
      var first = data.periods[idx[0]], last = data.periods[idx[idx.length - 1]];
      var nm = function (p) { return MONTH_NAMES[+p.substr(5, 2) - 1] + ' ' + p.substr(0, 4); };
      if (S.period === 'yearly') { return 'FY ' + fyLabelOf(sy) + (sy === CUR_FY ? ' to date' : ''); }
      if (S.period === 'monthly') { return nm(last); }
      return 'Q' + (Math.floor(((+last.substr(5, 2) + 8) % 12) / 3) + 1) + ' FY ' + fyLabelOf(sy) + ' (' + nm(first) + ' – ' + nm(last) + ')';
    }
    function sumIdx(arr, idx) { var s = 0; for (var i = 0; i < idx.length; i++) { s += (arr[idx[i]] || 0); } return s; }

    function realPk(d) {
      var region = data.byId[d.id], m = region.metrics, mo = m.monthly, idx = selectedMonthIdx();
      var sy = Number(S.selectedYear || DEFAULT_YEAR);
      var annualCr = (sy === CUR_FY && m.disbursedTarget > 0) ? m.disbursedTarget / 1e7 : NaN;
      var target = S.period === 'yearly' ? annualCr : (S.period === 'quarterly' ? annualCr / 4 : annualCr / 12);
      var disbursed = sumIdx(mo.disbursed, idx) / 1e7;
      var cmpIdx = idx.filter(function (i) { return data.periods[i] !== RUNNING_MONTH; });
      var prevIdx = cmpIdx.map(function (i) { return i - 12; }).filter(function (i) { return i >= 0; });
      var comparable = cmpIdx.length > 0 && prevIdx.length === cmpIdx.length;
      return {
        disbursed: disbursed, received: sumIdx(mo.received, idx) / 1e7,
        loans: sumIdx(mo.loanCount, idx), repayTxns: sumIdx(mo.repayTxns, idx),
        cmpDisbursed: comparable ? sumIdx(mo.disbursed, cmpIdx) / 1e7 : NaN,
        cmpReceived: comparable ? sumIdx(mo.received, cmpIdx) / 1e7 : NaN,
        prevDisbursed: comparable ? sumIdx(mo.disbursed, prevIdx) / 1e7 : NaN,
        prevReceived: comparable ? sumIdx(mo.received, prevIdx) / 1e7 : NaN,
        target: target, achievement: target > 0 ? (disbursed / target) * 100 : NaN,
        online: NaN, offline: NaN, repaymentRate: NaN, overdue: NaN,
        borrowers: (sy === CUR_FY && S.period === 'yearly') ? m.activeBorrowers : NaN
      };
    }

    function buildRealRows(realData) {
      return realData.regions.map(function (region) {
        return {
          id: region.id, name: region.name,
          mandals: (region.officeIds || []).map(function (oid) {
            var o = realData.byId[oid], om = o.metrics;
            var ach = om.disbursedTarget > 0 ? (om.disbursed / om.disbursedTarget) * 100 : NaN;
            return { name: o.name, y: om.disbursed / 1e7, q: om.disbursed / 1e7, m: om.disbursed / 1e7,
                     rep: ach, ovd: NaN, status: achievementStatus(ach),
                     officer: o.officer && o.officer.userId ? CeoDash.explorer.roleLabel(o.officer.role) + ': ' + o.officer.name : 'No officer mapped' };
          })
        };
      });
    }
    function achievementStatus(pct) {
      if (fmt.missing(pct)) { return 'risk'; }
      return pct >= 95 ? 'good' : (pct >= 85 ? 'warn' : 'risk');
    }
    function recv(p) { return p.received !== undefined ? p.received : p.online + p.offline; }

    var sharedCtx = CeoDash.core.context.get();
    var S = {
      period: sharedCtx.periodType || 'yearly',
      periodValue: null,
      scope: sharedCtx.districtId ? 'district' : 'state',
      districtId: sharedCtx.districtId || null,
      data: buildRealRows(data)
    };
    var CURRENT_YEAR = new Date().getFullYear();
    var QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function fc(n) { return fmt.missing(n) ? fmt.NA_TEXT : 'Rs. ' + n.toFixed(2) + ' Cr'; }
    function fp(n) { return fmt.missing(n) ? fmt.NA_TEXT : n.toFixed(1) + '%'; }
    function fk(n) { if (fmt.missing(n)) { return fmt.NA_TEXT; } return n >= 100000 ? (n / 100000).toFixed(2) + ' L' : (n / 1000).toFixed(1) + ' K'; }

    function renderCompare() {
      var cur, prev;
      if (S.scope === 'state') { cur = realStateTotals(); }
      else { var cd = getById(S.districtId); cur = cd ? realPk(cd) : null; }
      if (!cur) { return; }
      var up = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"></polyline></svg>';
      var down = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg>';
      function put(id, now, before) {
        var e = document.getElementById(id);
        if (!e) { return; }
        if (!(before > 0) || fmt.missing(now)) {
          var running = selectedMonthIdx().some(function (k) { return data.periods[k] === RUNNING_MONTH; });
          e.innerHTML = running && S.period !== 'yearly' ? '<span style="font-size:12px;color:#64748b;">in progress</span>' : fmt.NA_TEXT;
          e.style.color = '';
          return;
        }
        var g = (now - before) / before;
        e.innerHTML = (g >= 0 ? up : down) + ' ' + fmt.signedPercent(g);
        e.style.color = g >= 0 ? '' : '#b91c1c';
      }
      put('ov-cmp-disb', cur.cmpDisbursed, cur.prevDisbursed);
      put('ov-cmp-coll', cur.cmpReceived, cur.prevReceived);
    }

    function getPk(d) { return realPk(d); }
    function getMDisb(m) {
      if (S.period === 'yearly') return m.y;
      if (S.period === 'quarterly') return m.q;
      return m.m;
    }

    function getById(id) {
      for (var i = 0; i < S.data.length; i++) { if (S.data[i].id === id) return S.data[i]; }
      return null;
    }

    var DISTRICT_PALETTE = {
      'srikakulam':              '#E8742A',
      'parvathipuram-manyam':    '#F4A340',
      'vizianagaram':            '#F5C842',
      'visakhapatnam':           '#3B82F6',
      'alluri-sitharama-raju':   '#A855F7',
      'anakapalli':              '#06B6D4',
      'polavaram':               '#6366F1',
      'kakinada':                '#F97316',
      'east-godavari':           '#84CC16',
      'konaseema':               '#22C55E',
      'eluru':                   '#FBBF24',
      'west-godavari':           '#F87171',
      'ntr':                     '#60A5FA',
      'krishna':                 '#818CF8',
      'guntur':                  '#FB923C',
      'palnadu':                 '#34D399',
      'bapatla':                 '#A3E635',
      'prakasam':                '#FCD34D',
      'markapuram':              '#F472B6',
      'sri-potti-sriramulu-nellore': '#FDBA74',
      'kurnool':                 '#4ADE80',
      'nandyal':                 '#2DD4BF',
      'anantapur':               '#E879F9',
      'sri-sathya-sai':          '#38BDF8',
      'ysr-kadapa':              '#F87171',
      'annamayya':               '#FB7185',
      'tirupati':                '#A78BFA',
      'chittoor':                '#FCA5A5',
      'shadow':                  '#94A3B8'
    };

    function districtFill(districtId) {
      return DISTRICT_PALETTE[districtId] || '#94A3B8';
    }

    function recoveryStroke(rate) {
      if (fmt.missing(rate)) { return '#64748b'; }
      return rate >= 95 ? '#15803d' : (rate >= 85 ? '#b45309' : '#b91c1c');
    }

    function totalMandalCount() {
      var n = 0;
      for (var i = 0; i < S.data.length; i++) { n += (S.data[i].mandals || []).length; }
      return n;
    }

    function realStateTotals() {
      var tot = { disbursed: 0, disbursedTarget: 0, received: 0, prevDisbursed: 0, prevReceived: 0,
                  cmpDisbursed: 0, cmpReceived: 0,
                  loans: 0, repayTxns: 0, borrowers: 0, overdue: NaN, repaymentRate: NaN, online: NaN, offline: NaN };
      var anyTarget = false;
      for (var i = 0; i < S.data.length; i++) {
        var p = realPk(S.data[i]);
        tot.disbursed += p.disbursed; tot.received += p.received;
        tot.prevDisbursed += p.prevDisbursed; tot.prevReceived += p.prevReceived;
        tot.cmpDisbursed += p.cmpDisbursed; tot.cmpReceived += p.cmpReceived;
        tot.loans += p.loans; tot.repayTxns += p.repayTxns; tot.borrowers += p.borrowers;
        if (p.target > 0) { tot.disbursedTarget += p.target; anyTarget = true; }
      }
      if (!anyTarget) { tot.disbursedTarget = NaN; }
      return tot;
    }

    function stateTotals() { return realStateTotals(); }

    function disbursedTargetFor(district) { return realPk(district).target; }

    function targetAchievementBlock(target, actual) {
      var pct = target > 0 ? (actual / target) * 100 : 0;
      return { target: target, actual: actual, pct: pct, gap: actual - target, state: fmt.performanceState(pct) };
    }

    function renderTargetBand(scopeDistrict) {
      var bandEl = document.getElementById('ov-target-band');
      var scopeLabel = document.getElementById('ov-target-scope');
      if (!bandEl) { return; }

      var disbTarget, disbActual, received, overdue, recoveryRate, scopeName;
      if (!scopeDistrict) {
        var tot = stateTotals();
        disbActual = tot.disbursed;
        disbTarget = tot.disbursedTarget;
        received = tot.received;
        overdue = tot.overdue;
        recoveryRate = tot.repaymentRate;
        scopeName = 'Statewide';
      } else {
        var p = getPk(scopeDistrict);
        disbActual = p.disbursed;
        disbTarget = disbursedTargetFor(scopeDistrict);
        received = recv(p);
        overdue = p.overdue;
        recoveryRate = p.repaymentRate;
        scopeName = scopeDistrict.name;
      }

      if (scopeLabel) {
        scopeLabel.textContent = scopeName + ', ' + selectionLabel() +
          (S.period !== 'yearly' && disbTarget > 0 ? ' (target pro-rated from FY)' : '');
      }

      var achPct = disbTarget > 0 ? Math.round((disbActual / disbTarget) * 100) : NaN;
      var gap = disbTarget > 0 ? Math.abs(disbActual - disbTarget) : NaN;
      var achText = fmt.missing(achPct) ? fmt.NA_TEXT : achPct + '%';

      bandEl.innerHTML =
        '<div class="target-circle-container">' +
        '  <div class="tva-circle tva-circle--green">' +
        '    <div class="tva-inner">' +
        '      <div class="tva-label">Disbursement</div>' +
        '      <div class="tva-row"><span>Target</span><span class="tva-val">' + fc(disbTarget) + '</span></div>' +
        '      <div class="tva-row"><span>Actual</span><span class="tva-val">' + fc(disbActual) + '</span></div>' +
        '      <div class="tva-row"><span>Achievement</span><span class="tva-val tva-val--green">' + achText + '</span></div>' +
        '      <div class="tva-row"><span>Gap</span><span class="tva-val tva-val--red">' + fc(gap) + '</span></div>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<div class="target-circle-container">' +
        '  <div class="tva-circle tva-circle--teal">' +
        '    <div class="tva-inner">' +
        '      <div class="tva-label">Repayment</div>' +
        '      <div class="tva-row"><span>Collected</span><span class="tva-val">' + fc(received) + '</span></div>' +
        '      <div class="tva-row"><span>Online</span><span class="tva-val" id="ov-tva-online">' + fmt.NA_TEXT + '</span></div>' +
        '      <div class="tva-row"><span>Manual</span><span class="tva-val tva-val--red" id="ov-tva-manual">' + fmt.NA_TEXT + '</span></div>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<div class="target-circle-container">' +
        '  <div class="tva-circle tva-circle--blue">' +
        '    <div class="tva-inner">' +
        '      <div class="tva-label">Online vs Offline</div>' +
        '      <div class="tva-row"><span>Online</span><span class="tva-val tva-val--blue" id="ov-tva-onpct">' + fmt.NA_TEXT + '</span></div>' +
        '      <div class="tva-row"><span>Manual</span><span class="tva-val tva-val--red" id="ov-tva-offpct">' + fmt.NA_TEXT + '</span></div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    }

    var root = document.createElement('div');
    root.className = 'cd-overview-chapter';

    root.innerHTML =
      '<div class="main-wrapper">' +
      '  <div class="left-panel">' +
      '    <div class="snapshot-header" style="display:flex;justify-content:space-between;align-items:center;">' +
      '      <div>' +
      '        <h4 class="main-wrapper-header" id="ov-intel-title">Performance Snapshot</h4>' +
      '        <p class="andhra_sub_title mb-0" id="ov-intel-sub"></p>' +
      '      </div>' +
      '      <button type="button" class="cd-ov-reset-btn" id="ov-reset-btn" style="display:none;padding:5px 14px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;font-size:12px;font-weight:700;color:#0f172a;cursor:pointer;">&#8634; Back to Statewide</button>' +
      '    </div>' +
      '    <div class="map-card">' +
      '      <div>' +
      '        <h5 class="andhra_title" id="ov-map-title">Andhra Pradesh - District Map</h5>' +
      '        <p class="andhra_sub_title">Click any District to inspect Performance</p>' +
      '      </div>' +
      '      <div class="map-image-container" id="ov-canvas">' +
      '        <div class="cd-ov-tip" id="ov-tip">' +
      '          <div class="cd-ov-tip-title" id="ov-tip-title">District</div>' +
      '          <div class="cd-ov-tip-row"><span style="color:#90b8a0;">Borrowed:</span><span style="font-weight:700;" id="ov-tip-bor"></span></div>' +
      '          <div class="cd-ov-tip-row"><span style="color:#90b8a0;">Collected:</span><span style="font-weight:700;" id="ov-tip-col"></span></div>' +
      '          <div class="cd-ov-tip-row"><span style="color:#90b8a0;" id="ov-tip-rate-label">Of target:</span><span style="font-weight:700;" id="ov-tip-rate"></span></div>' +
      '        </div>' +
      '      </div>' +
      '      <div class="map-footer">' +
      '        <div class="showing-badge" id="ov-badge">Showing: All 28 AP Districts</div>' +
      '        <div class="legend-container" id="ov-legend">' +
      '          <div><span class="legend-dot" style="background-color:#15803d;"></span> Border &#8805;95% of target</div>' +
      '          <div><span class="legend-dot" style="background-color:#b45309;"></span> Border 85-94%</div>' +
      '          <div><span class="legend-dot" style="background-color:#b91c1c;"></span> Border &lt;85%</div>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="cd-ov-panel" id="ov-mandal-panel" style="display:none;margin-top:14px;">' +
      '      <div class="cd-ov-phead">' +
      '        <div>' +
      '          <div class="cd-ov-ptitle" id="ov-mandal-title">Mandal Performance Breakdown</div>' +
      '          <div class="cd-ov-psub" id="ov-mandal-sub"></div>' +
      '        </div>' +
      '        <div class="cd-ov-district-links" id="ov-district-links"></div>' +
      '      </div>' +
      '      <div class="cd-ov-mandal-sec">' +
      '        <div class="cd-ov-mgrid" id="ov-mandal-grid"></div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +

      '  <div class="right-panel">' +
      '    <div style="display:flex;justify-content:flex-end;">' +
      '      <div class="filter-group">' +
      '        <button type="button" class="filter-pill active" data-p="yearly">Yearly</button>' +
      '        <button type="button" class="filter-pill" data-p="quarterly">Quaterly</button>' +
      '        <button type="button" class="filter-pill" data-p="monthly">Monthly</button>' +
      '      </div>' +
      '    </div>' +

      '    <div class="year-selector">' +
      '    </div>' +
      '    <div class="ov-sub-picker" id="ov-sub-picker"></div>' +

      '    <div>' +
      '      <div class="rightPanel_heading" style="margin-bottom:8px;">This Year Vs Previous Year</div>' +
      '      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
      '        <div class="compare-card">' +
      '          <span class="compare-title">Disbursed</span>' +
      '          <span class="compare-value" id="ov-cmp-disb">&#8212;</span>' +
      '        </div>' +
      '        <div class="compare-card">' +
      '          <span class="compare-title">Collected</span>' +
      '          <span class="compare-value" id="ov-cmp-coll">&#8212;</span>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +

      '    <div class="stat-cards-grid">' +
      '      <div class="stat-card-wrapper stat-card--blue">' +
      '        <div class="stat-header">' +
      '          <span>Disbursement<br>Target</span>' +
      '          <span class="stat-card-icon-pill"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg></span>' +
      '        </div>' +
      '        <div class="stat-body">' +
      '          <div class="stat-val" id="ov-kpi-target">&#8212;</div>' +
      '          <div class="stat-sub" id="ov-kpi-target-sub"></div>' +
      '        </div>' +
      '      </div>' +
      '      <div class="stat-card-wrapper stat-card--green">' +
      '        <div class="stat-header">' +
      '          <span>Disbursed</span>' +
      '          <span class="stat-card-icon-pill"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></span>' +
      '        </div>' +
      '        <div class="stat-body">' +
      '          <div class="stat-val" id="ov-kpi-total">&#8212;</div>' +
      '          <div class="stat-sub" id="ov-kpi-total-sub"></div>' +
      '        </div>' +
      '      </div>' +
      '      <div class="stat-card-wrapper stat-card--violet">' +
      '        <div class="stat-header">' +
      '          <span>Payment<br>Collected</span>' +
      '          <span class="stat-card-icon-pill"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg></span>' +
      '        </div>' +
      '        <div class="stat-body">' +
      '          <div class="stat-val" id="ov-kpi-received">&#8212;</div>' +
      '          <div class="stat-sub" id="ov-kpi-received-sub"></div>' +
      '        </div>' +
      '      </div>' +
      '      <div class="stat-card-wrapper stat-card--pink">' +
      '        <div class="stat-header">' +
      '          <span>Paid<br>Online</span>' +
      '          <span class="stat-card-icon-pill"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg></span>' +
      '        </div>' +
      '        <div class="stat-body">' +
      '          <div class="stat-val" id="ov-kpi-repay">&#8212;</div>' +
      '          <div class="stat-sub" id="ov-kpi-repay-sub">share of collections</div>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +

      '    <div>' +
      '      <div class="rightPanel_heading">Target Vs Achievement</div>' +
      '      <div class="rightPanel_sub_heading" id="ov-target-scope"></div>' +
      '      <div class="circles-grid" id="ov-target-band"></div>' +
      '    </div>' +

      '    <div>' +
      '      <div class="rightPanel_heading" id="ov-hl-title">Executive Highlights</div>' +
      '      <div class="rightPanel_sub_heading" id="ov-hl-sub"></div>' +
      '      <div class="highlights-container">' +
      '        <div>' +
      '          <div class="highlight-header color-green">' +
      '            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"></polyline></svg> Top Performing' +
      '          </div>' +
      '          <div id="ov-hl-top"></div>' +
      '        </div>' +
      '        <div>' +
      '          <div class="highlight-header box_header_red" id="ov-hl-watch-head">' +
      '            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg> Achievement Watchlist' +
      '          </div>' +
      '          <div id="ov-hl-watch"></div>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +

      '    <div>' +
      '      <div class="rightPanel_heading">Leadership Highlights</div>' +
      '      <div class="rightPanel_sub_heading">Top DGM, AGM and Managers by Achievement</div>' +
      '      <div class="leaders-grid" id="ov-leader-grid"></div>' +
      '    </div>' +
      '    <div>' +
      '      <div class="rightPanel_heading" id="ov-tm-title">Top Mandals &amp; their Officer</div>' +
      '      <div class="rightPanel_sub_heading" id="ov-tm-sub"></div>' +
      '      <div id="ov-top-mandals"></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    container.appendChild(root);

    var canvas = document.getElementById('ov-canvas');
    if (canvas && window.__AP_SVG_HTML) {
      canvas.insertAdjacentHTML('afterbegin', window.__AP_SVG_HTML);
    }

    var ySel = root.querySelector('.year-selector');
    if (ySel) {
      ySel.innerHTML = FY_LIST.map(function (sy) {
        return '<button type="button" class="year-pill" data-y="' + sy + '">FY ' + fyLabelOf(sy) + '</button>';
      }).join('');
    }

    function realLeaders() {
      var tree = CeoDash.employees.bootTree(data), NONE = CeoDash.employees.NONE;
      var initials = function (n) {
        return String(n || '?').split(/[\s.]+/).filter(function (w) { return w && w !== 'Sri' && w !== 'Smt'; })
          .map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join('');
      };
      var best = { dgm: null, agm: null, officer: null };
      tree.children.forEach(function (d) {
        var dp = [{ level: 'dgm', id: d.id }];
        consider(d, dp);
        d.children.forEach(function (a) {
          var ap = dp.concat([{ level: 'agm', id: a.id }]);
          consider(a, ap);
          a.children.forEach(function (o) { consider(o, ap.concat([{ level: 'officer', id: o.id }])); });
        });
      });
      function consider(n, path) {
        var pct = n.fig.achievement * 100;
        if (n.id === NONE || fmt.missing(pct)) { return; }
        if (!best[n.kind] || pct > best[n.kind].pct) { best[n.kind] = { n: n, pct: pct, path: path }; }
      }
      var out = [];
      [['dgm', 'Top DGM', 'leader-card--1'], ['agm', 'Top AGM', 'leader-card--2'], ['officer', 'Top Officer', 'leader-card--3']].forEach(function (t) {
        var b = best[t[0]];
        if (!b) { return; }
        out.push({ role: t[1], name: b.n.name, desc: b.n.districts.join(', ') + ' - ' + (t[0] === 'officer' ? b.n.role : t[0].toUpperCase()),
                   pct: Math.round(b.pct), cls: t[2], initials: initials(b.n.name), path: b.path });
      });
      return out;
    }

    (function renderLeaderHighlights() {
      var gridEl = document.getElementById('ov-leader-grid');
      if (!gridEl) { return; }

      var leaders = realLeaders();

      gridEl.innerHTML = leaders.map(function (ldr, idx) {
        return '<div class="leader-card-outer" data-ldr-idx="' + idx + '">' +
          '  <div class="leader-card ' + ldr.cls + '">' +
          '    <div class="leader-avatar-fallback">' + ldr.initials + '</div>' +
          '    <div class="leader-role">' + ldr.role + '</div>' +
          '  </div>' +
          '  <div class="leader-details">' +
          '    <div class="leader-name">' + ldr.name + '</div>' +
          '    <div class="leader-desc">' + ldr.desc + '</div>' +
          '    <div class="achievement-pill">' +
          '      ' + ldr.pct + '% Achievement &rarr;' +
          '    </div>' +
          '  </div>' +
          '</div>';
      }).join('');

      var cards = gridEl.querySelectorAll('[data-ldr-idx]');
      for (var lc = 0; lc < cards.length; lc++) {
        (function (ldr) {
          cards[lc].onclick = function () {
            CeoDash.components.ActionModal.open({
              title: ldr.name + ' \u2014 ' + ldr.role,
              badge: 'HIGHEST TARGET ACHIEVEMENT',
              badgeType: 'green',
              subtitle: ldr.desc + ' \u00b7 ' + ldr.pct + '% of FY ' + fyLabelOf(CUR_FY) + ' disbursement target',
              stats: [
                { label: 'Role', value: ldr.role },
                { label: 'Achievement', value: ldr.pct + '%', color: '#059669' }
              ],
              body: 'Highest disbursement against the FY target in its tier, from SNBSAP loans and the mandal ownership mapping.',
              actions: [{
                label: '\ud83d\udd0d Open in Employee Performance',
                type: 'primary',
                badge: 'Navigate',
                onClick: function (close) {
                  close();
                  CeoDash.core.router.goToChapter('performance-map', ldr.path);
                }
              }]
            });
          };
        })(leaders[Number(cards[lc].getAttribute('data-ldr-idx'))]);
      }
    })();

    /* quarter / month picker for the Quarterly and Monthly views */
    function renderSubPicker() {
      var box = document.getElementById('ov-sub-picker');
      if (!box) { return; }
      box.innerHTML = '';
      if (S.period === 'yearly') { box.style.display = 'none'; return; }
      box.style.display = '';
      var sy = Number(S.selectedYear || DEFAULT_YEAR);
      var have = {};
      for (var i = 0; i < data.periods.length; i++) { if (fyStartYearOf(data.periods[i]) === sy) { have[data.periods[i]] = true; } }
      var sel = selectedMonthIdx().map(function (k) { return data.periods[k]; });
      var items = [];
      if (S.period === 'monthly') {
        for (var m = 0; m < 12; m++) {
          var mo = (m + 3) % 12 + 1, yr = mo >= 4 ? sy : sy + 1;
          var key = yr + '-' + (mo < 10 ? '0' : '') + mo;
          items.push({ label: MONTHS[mo - 1], title: MONTHS[mo - 1] + ' ' + yr, value: key, ok: !!have[key], on: sel.indexOf(key) !== -1 });
        }
      } else {
        for (var q = 0; q < 4; q++) {
          var ms = [], any = false, on = false;
          for (var j = 0; j < 3; j++) {
            var mo2 = (q * 3 + j + 3) % 12 + 1, yr2 = mo2 >= 4 ? sy : sy + 1;
            var k2 = yr2 + '-' + (mo2 < 10 ? '0' : '') + mo2;
            ms.push(MONTHS[mo2 - 1]);
            if (have[k2]) { any = true; }
            if (sel.indexOf(k2) !== -1) { on = true; }
          }
          items.push({ label: 'Q' + (q + 1) + ' \u00b7 ' + ms[0] + '\u2013' + ms[2], title: 'Quarter ' + (q + 1), value: q + 1, ok: any, on: on });
        }
      }
      items.forEach(function (it) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ov-sub-pill' + (it.on ? ' active' : '');
        b.title = it.ok ? it.title : it.title + ' - no data yet';
        b.textContent = it.label;
        if (!it.ok) { b.disabled = true; }
        b.onclick = function () { S.periodValue = it.value; renderAll(); };
        box.appendChild(b);
      });
    }

    function renderAll() {
      renderSubPicker();
      syncExplorerPeriod(); renderTopMandals();
      var pPills = root.querySelectorAll('.filter-pill');
      for (var pi = 0; pi < pPills.length; pi++) {
        if (pPills[pi].getAttribute('data-p') === S.period) pPills[pi].classList.add('active');
        else pPills[pi].classList.remove('active');
      }

      var yPills = root.querySelectorAll('.year-pill');
      for (var yi = 0; yi < yPills.length; yi++) {
        if (yPills[yi].getAttribute('data-y') === (S.selectedYear || DEFAULT_YEAR)) yPills[yi].classList.add('active');
        else yPills[yi].classList.remove('active');
      }

      var intelTitle = document.getElementById('ov-intel-title');
      var intelSub = document.getElementById('ov-intel-sub');
      var resetBtn = document.getElementById('ov-reset-btn');
      if (intelTitle) {
        if (S.scope === 'state') {
          intelTitle.textContent = 'Performance Snapshot';
          if (intelSub) { intelSub.textContent = 'Statewide disbursement, Collections and recovery, at a glance'; }
          if (resetBtn) resetBtn.style.display = 'none';
        } else {
          var dHead = getById(S.districtId);
          intelTitle.textContent = (dHead ? dHead.name : 'District') + ' Snapshot';
          if (intelSub) { intelSub.textContent = 'Disbursement, collections and recovery for this district'; }
          if (resetBtn) resetBtn.style.display = 'inline-block';
        }
      }

      renderCompare();

      if (S.scope === 'state') {
        var rt = realStateTotals();
        setTxt('ov-kpi-target', fc(rt.disbursedTarget));
        setTxt('ov-kpi-target-sub', S.data.length + ' Districts | ' + totalMandalCount() + ' Mandals');
        setTxt('ov-kpi-total', fc(rt.disbursed));
        setTxt('ov-kpi-total-sub', rt.disbursedTarget > 0
          ? ((rt.disbursed / rt.disbursedTarget) * 100).toFixed(1) + '% of Target'
          : fmt.number(rt.loans) + ' loans');
        setTxt('ov-kpi-received', fc(rt.received));
        setTxt('ov-kpi-received-sub', selectionLabel() + ' · ' + fmt.number(rt.repayTxns) + ' txns');
        renderTargetBand(null);
      } else {
        var rd = getById(S.districtId);
        if (rd) {
          var rp = realPk(rd);
          setTxt('ov-kpi-target', fc(rp.target));
          setTxt('ov-kpi-target-sub', rd.name + ' | ' + rd.mandals.length + ' Mandals');
          setTxt('ov-kpi-total', fc(rp.disbursed));
          setTxt('ov-kpi-total-sub', rp.target > 0 ? fp(rp.achievement) + ' of Target' : fmt.number(rp.loans) + ' loans');
          setTxt('ov-kpi-received', fc(rp.received));
          setTxt('ov-kpi-received-sub', selectionLabel() + ' · ' + fmt.number(rp.repayTxns) + ' txns');
          renderTargetBand(rd);
        }
      }
      renderModes();
      for (var i = 0; i < S.data.length; i++) {
        var dist = S.data[i];
        var pathEl = document.getElementById('dist-' + dist.id);
        if (!pathEl) continue;
        var repRate = getPk(dist).achievement;
        pathEl.setAttribute('fill', districtFill(dist.id));
        pathEl.setAttribute('stroke', recoveryStroke(repRate));
        pathEl.setAttribute('stroke-width', S.districtId === dist.id ? '3' : '1.2');
        if (S.districtId === dist.id) pathEl.classList.add('sel');
        else pathEl.classList.remove('sel');
      }
      var bBadge = document.getElementById('ov-badge');
      if (bBadge) bBadge.textContent = S.scope === 'state' ? 'Showing: All ' + S.data.length + ' AP Districts' : 'Showing: ' + (getById(S.districtId) ? getById(S.districtId).name : 'District');

      var mandalPanel = document.getElementById('ov-mandal-panel');
      if (S.scope === 'state' || !S.districtId) {
        if (mandalPanel) mandalPanel.style.display = 'none';
      } else {
        var d = getById(S.districtId);
        if (d && mandalPanel) {
          mandalPanel.style.display = 'block';
          setTxt('ov-mandal-title', d.name + ' - Mandal Breakdown');
          setTxt('ov-mandal-sub', d.mandals.length + ' mandals | FY ' + fyLabelOf(CUR_FY) + ' to date, disbursement vs target');
          var mGrid = document.getElementById('ov-mandal-grid');
          if (mGrid) {
            var mHtml = '';
            var byRate = function (a, b) {
              var ar = fmt.missing(a.rep) ? -1 : a.rep, br = fmt.missing(b.rep) ? -1 : b.rep;
              return br - ar;
            };
            var mandals = d.mandals.slice().sort(byRate);
            for (var j = 0; j < mandals.length; j++) {
              var m = mandals[j];
              var disp = getMDisb(m);
              var barW = fmt.missing(m.rep) ? 0 : Math.min(100, m.rep);
              mHtml +=
                '<div class="cd-ov-mcard">' +
                '<div class="cd-ov-mname">' + m.name + '</div>' +
                '<div class="cd-ov-mdisb">' + fc(disp) + ' disbursed</div>' +
                '<div class="cd-ov-mbar"><div class="cd-ov-mbar-fill ' + m.status + '" style="width:' + barW + '%"></div></div>' +
                '<div class="cd-ov-mrate ' + m.status + '">' + fp(m.rep) + ' of target</div>' +
                '</div>';
            }
            mGrid.innerHTML = mHtml;
          }
          var linksEl = document.getElementById('ov-district-links');
          if (linksEl) {
            linksEl.innerHTML =
              '<button type="button" class="cd-ov-district-link" data-jump="loan-journey">View in Loans Given &#8594;</button>' +
              '<button type="button" class="cd-ov-district-link" data-jump="repayment-journey">View in Repayments &#8594;</button>' +
              '<button type="button" class="cd-ov-district-link" data-jump="performance-map">View in Employee Performance &#8594;</button>';
            var jumpBtns = linksEl.querySelectorAll('[data-jump]');
            for (var jb = 0; jb < jumpBtns.length; jb++) {
              jumpBtns[jb].onclick = function () {
                var chapter = this.getAttribute('data-jump');
                CeoDash.core.context.set({ districtId: S.districtId, periodType: S.period });
                if (chapter === 'performance-map') {
                  CeoDash.core.router.goToChapter(chapter, CeoDash.employees.pathForDistrict(data, S.districtId));
                } else {
                  CeoDash.core.router.goToChapter(chapter, [{ level: 'region', id: S.districtId }]);
                }
              };
            }
          }
        }
      }

      var hlTop = document.getElementById('ov-hl-top');
      var hlWatch = document.getElementById('ov-hl-watch');
      if (S.scope === 'state') {
        var ranked = S.data.map(function (dd) {
          var pp = realPk(dd);
          return { name: dd.name, id: dd.id, disp: pp.disbursed, rate: pp.achievement, sub: 'AGM: ' + CeoDash.explorer.districtAgm(data, data.byId[dd.id]) };
        });
        var hasRate = ranked.some(function (r) { return !fmt.missing(r.rate); });
        var key = hasRate ? function (r) { return fmt.missing(r.rate) ? -1 : r.rate; } : function (r) { return r.disp; };
        ranked.sort(function (a, b) { return key(b) - key(a); });
        setTxt('ov-hl-title', 'Executive Highlights');
        setTxt('ov-hl-sub', (hasRate ? 'Disbursement vs target, ' : 'Disbursement, ') + selectionLabel());
        renderHighlightBoxes(hlTop, ranked.slice(0, 3), true);
        renderHighlightBoxes(hlWatch, ranked.slice(-3).reverse(), false);
      } else {
        var rdd = getById(S.districtId);
        if (rdd) {
          setTxt('ov-hl-title', 'Mandal Insights - ' + rdd.name);
          setTxt('ov-hl-sub', 'FY ' + fyLabelOf(CUR_FY) + ' disbursement vs mandal target');
          var withRate = rdd.mandals.filter(function (mm) { return !fmt.missing(mm.rep); })
            .sort(function (a, b) { return b.rep - a.rep; })
            .map(function (mm) { return { name: mm.name + ' Mandal', id: null, disp: mm.y, rate: mm.rep, sub: mm.officer }; });
          renderHighlightBoxes(hlTop, withRate.slice(0, 3), true);
          renderHighlightBoxes(hlWatch, withRate.slice(-3).reverse(), false);
        }
      }
      var introSub = document.getElementById('ov-intel-sub');
      if (introSub) { introSub.textContent = S.scope === 'state' ? 'Statewide disbursement, collections and online share, at a glance' : 'Disbursement, collections and online share for this district'; }
    }

    function renderModes() {
      var idx = selectedMonthIdx();
      if (!idx.length) { return; }
      var ex = CeoDash.explorer;
      var token = (root.__modeReq = (root.__modeReq || 0) + 1);
      var regionId = S.scope === 'district' && data.byId[S.districtId] ? data.byId[S.districtId].districtId : null;
      ex.call({ action: 'drill', group: 'DISTRICT', from: data.periods[idx[0]] + '-01',
                to: ex.addMonths(data.periods[idx[idx.length - 1]], 1) + '-01' }, function (res) {
        if (token !== root.__modeReq || !res.ok || !document.body.contains(root)) { return; }
        if (res.body.payModes === false) { setTxt('ov-kpi-repay', fmt.NA_TEXT); setTxt('ov-kpi-repay-sub', 'payment channel not available'); return; }
        var on = 0, all = 0;
        (res.body.rows || []).forEach(function (r) {
          if (regionId && r.id !== regionId) { return; }
          all += r.repaid || 0; on += (r.upiAmount || 0) + (r.posAmount || 0) + (r.autoAmount || 0);
        });
        var off = Math.max(0, all - on);
        setTxt('ov-kpi-repay', all > 0 ? fp(on / all * 100) : fmt.NA_TEXT);
        setTxt('ov-kpi-repay-sub', fc(on / 1e7) + ' online · ' + fc(off / 1e7) + ' manual');
        setTxt('ov-tva-online', fc(on / 1e7));
        setTxt('ov-tva-manual', fc(off / 1e7));
        setTxt('ov-tva-onpct', all > 0 ? fp(on / all * 100) : fmt.NA_TEXT);
        setTxt('ov-tva-offpct', all > 0 ? fp(off / all * 100) : fmt.NA_TEXT);
      });
    }

    function renderHighlightBoxes(el, items, isTop) {
      if (!el) return;
      var html = '';
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var action = item.id ? ' data-dist="' + item.id + '"' : '';
        var boxClass = isTop ? 'box-green' : 'box-red';
        var valClass = isTop ? 'color-green' : 'box_header_red';
        html +=
          '<div class="highlight-box ' + boxClass + '"' + action + '>' +
          '  <div style="display:flex;align-items:center;">' +
          '    <div class="rank-badge">' + (i + 1) + '</div>' +
          '    <div>' +
          '      <div class="box_heading">' + item.name + '</div>' +
          '      <div class="box_subheading">It\'s ' + fc(item.disp) + ' disbursed</div>' +
          (item.sub ? '      <div class="box_subheading" style="font-weight:700;">' + escHtml(item.sub) + '</div>' : '') +
          '    </div>' +
          '  </div>' +
          '  <div class="box_value ' + valClass + '">' + fp(item.rate) + '</div>' +
          '</div>';
      }
      el.innerHTML = html;
      var clickable = el.querySelectorAll('.highlight-box[data-dist]');
      for (var k = 0; k < clickable.length; k++) {
        clickable[k].onclick = function () {
          var did = this.getAttribute('data-dist');
          if (did) selectDistrict(did);
        };
      }
    }

    function escHtml(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function syncExplorerPeriod() {
      var idx = selectedMonthIdx(), sy = Number(S.selectedYear || DEFAULT_YEAR);
      if (!idx.length) { return; }
      var last = data.periods[idx[idx.length - 1]];
      var patch = { exFy: sy, exPeriod: 'fy', exValue: null };
      if (S.period === 'monthly') { patch.exPeriod = 'm'; patch.exValue = last; }
      else if (S.period === 'quarterly') { patch.exPeriod = 'q'; patch.exValue = Math.floor(((+last.substr(5, 2) + 8) % 12) / 3) + 1; }
      CeoDash.core.context.set(patch);
    }

    function renderTopMandals() {
      var box = document.getElementById('ov-top-mandals');
      if (!box) { return; }
      var idx = selectedMonthIdx(), sy = Number(S.selectedYear || DEFAULT_YEAR);
      var region = S.scope === 'district' ? data.byId[S.districtId] : null;
      setTxt('ov-tm-sub', (region ? region.name + ', ' : 'Statewide, ') + selectionLabel());
      if (!idx.length) { box.innerHTML = '<div class="box_subheading">No data for this period.</div>'; return; }
      var ex = CeoDash.explorer;
      var token = (box.__req = (box.__req || 0) + 1);
      box.innerHTML = '<div class="box_subheading">Loading mandals...</div>';
      ex.call({ action: 'drill', group: 'MANDAL', districtId: region ? region.districtId : null,
                from: data.periods[idx[0]] + '-01', to: ex.addMonths(data.periods[idx[idx.length - 1]], 1) + '-01' },
        function (res) { if (token === box.__req) { fillTopMandals(box, res, idx, sy, region); } });
    }

    function fillTopMandals(box, res, idx, sy, region) {
      var ex = CeoDash.explorer;
      if (!res.ok) { box.innerHTML = '<div class="box_subheading">' + escHtml(res.error) + '</div>'; return; }
      var share = idx.length >= 12 ? 1 : idx.length / 12;
      var slugOf = {};
      data.regions.forEach(function (r) { slugOf[r.districtId] = r.id; });
      var rows = (res.body.rows || []).map(function (r) {
        var oid = slugOf[r.districtId] + '-m' + r.id, o = data.byId[oid];
        var t = (o && sy === CUR_FY && o.metrics.disbursedTarget > 0) ? o.metrics.disbursedTarget * share : NaN;
        return { oid: oid, o: o, name: (o ? o.name : r.name), disp: r.disbursed, rate: t > 0 ? r.disbursed / t * 100 : NaN };
      }).filter(function (r) { return r.o && r.disp > 0; });
      var hasRate = rows.some(function (r) { return !fmt.missing(r.rate); });
      rows.sort(function (a, b) { return hasRate ? ((fmt.missing(b.rate) ? -1 : b.rate) - (fmt.missing(a.rate) ? -1 : a.rate)) : b.disp - a.disp; });
      box.innerHTML = rows.slice(0, 5).map(function (r, i) {
        var of = r.o.officer, who = of && of.userId ? ex.roleLabel(of.role) + ': ' + of.name : 'No officer mapped';
        return '<div class="highlight-box box-green" data-oid="' + escHtml(r.oid) + '" style="cursor:pointer;">' +
          '  <div style="display:flex;align-items:center;">' +
          '    <div class="rank-badge">' + (i + 1) + '</div>' +
          '    <div>' +
          '      <div class="box_heading">' + escHtml(r.name) + ' Mandal' + (region ? '' : ' \u00b7 ' + escHtml(data.byId[r.o.regionId].name)) + '</div>' +
          '      <div class="box_subheading" style="font-weight:700;">' + escHtml(who) + '</div>' +
          '      <div class="box_subheading">' + fc(r.disp / 1e7) + ' disbursed' + (of && of.agmName ? ' \u00b7 AGM ' + escHtml(of.agmName) : '') + '</div>' +
          '    </div>' +
          '  </div>' +
          '  <div class="box_value color-green">' + (hasRate ? fp(r.rate) : '') + '</div>' +
          '</div>';
      }).join('') || '<div class="box_subheading">No loans in this period.</div>';
      var cards = box.querySelectorAll('[data-oid]');
      for (var c = 0; c < cards.length; c++) {
        cards[c].onclick = function () {
          var o = data.byId[this.getAttribute('data-oid')];
          syncExplorerPeriod();
          CeoDash.core.router.goToChapter('loan-journey', [{ level: 'region', id: o.regionId }, { level: 'office', id: o.id }]);
        };
      }
    }

    function setTxt(id, val) {
      var e = document.getElementById(id);
      if (e) e.textContent = val;
    }

    function selectDistrict(did) {
      S.scope = 'district';
      S.districtId = did;
      CeoDash.core.context.set({ districtId: did });
      renderAll();
    }
    function resetToState() {
      S.scope = 'state';
      S.districtId = null;
      CeoDash.core.context.set({ districtId: null });
      renderAll();
    }

    var pPills = root.querySelectorAll('.filter-pill');
    for (var pi = 0; pi < pPills.length; pi++) {
      pPills[pi].onclick = function () {
        var p = this.getAttribute('data-p');
        if (p && S.period !== p) {
          S.period = p;
          S.periodValue = null;
          CeoDash.core.context.set({ periodType: p });
          renderAll();
        }
      };
    }

    var yPills = root.querySelectorAll('.year-pill');
    for (var yi = 0; yi < yPills.length; yi++) {
      yPills[yi].onclick = function () {
        var y = this.getAttribute('data-y');
        if (y && S.selectedYear !== y) {
          S.selectedYear = y;
          S.periodValue = null;
          renderAll();
        }
      };
    }

    var rBtn = document.getElementById('ov-reset-btn');
    if (rBtn) rBtn.onclick = function () { resetToState(); };

    var paths = root.querySelectorAll('.dp');
    var tip = document.getElementById('ov-tip');
    var mapCanvas = document.getElementById('ov-canvas');

    for (var i = 0; i < paths.length; i++) {
      (function (pEl) {
        var did = pEl.getAttribute('data-id');
        pEl.addEventListener('mouseenter', function () {
          var d = getById(did);
          if (!d) return;
          var p = getPk(d);
          setTxt('ov-tip-title', d.name);
          setTxt('ov-tip-bor', fc(p.disbursed));
          setTxt('ov-tip-col', fc(recv(p)));
          setTxt('ov-tip-rate', fp(p.achievement));
          if (tip) tip.classList.add('show');
        });
        pEl.addEventListener('mousemove', function (e) {
          if (!tip || !mapCanvas) return;
          var r = mapCanvas.getBoundingClientRect();
          tip.style.left = (e.clientX - r.left) + 'px';
          tip.style.top = (e.clientY - r.top) + 'px';
        });
        pEl.addEventListener('mouseleave', function () {
          if (tip) tip.classList.remove('show');
        });
        pEl.addEventListener('click', function () {
          selectDistrict(did);
        });
      })(paths[i]);
    }

    renderAll();
  }

  CeoDash.chapters['pulse'] = render;
})(window);
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
        el('p', { className: 'cd-loan-page-desc' }, names.join(' › ') + ' - ' + this.periodName)
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
      return el('div', { className: 'cd-loan-kpi-row cd-lg-kpis' + (defs.length === 4 ? ' cd-lg-kpis--4' : defs.length === 6 ? ' cd-lg-kpis--6' : '') }, defs.map(function (k) {
        var card = el('div', withProps({ className: 'cd-loan-kpi-chevron' }, onActivate(function () {
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
        return { r: r, navId: navId, name: ent ? ent.name : titleCase(r.name || r.id), sub: subOf(data, scope, ch.group, r, navId),
                 disbursed: r.disbursed || 0, loans: r.loanCount || 0, women: has(r.borrowers) ? r.borrowers : 0, active: r.openLoans || 0 };
      }).filter(function (x) { return x.loans > 0; });
      var pills = el('div', { className: 'cd-cv-pills' });
      var holder = el('div', {});
      var all = false;
      var more = el('button', { type: 'button', className: 'cd-cv-link' });
      function draw() {
        clearBox(pills);
        [['disbursed', 'Amount given'], ['loans', 'Number of loans'], ['women', 'Women'], ['active', 'Active loans']].forEach(function (o) {
          pills.appendChild(el('button', { type: 'button', className: 'cd-cv-pill' + (LG_SORT === o[0] ? ' cd-cv-pill--on' : ''),
            onClick: function () { LG_SORT = o[0]; draw(); } }, o[1]));
        });
        var key = LG_SORT;
        var sorted = list.slice().sort(function (a, b) { return b[key] - a[key] || (a.name < b.name ? -1 : 1); });
        var max = sorted.length ? sorted[0][key] : 0;
        clearBox(holder);
        var box = el('div', { className: 'cd-cv-top-list' + (all ? ' cd-cv-scroll cd-cv-scroll--tall' : '') });
        (all ? sorted : sorted.slice(0, 10)).forEach(function (x, i) {
          var main = key === 'disbursed' ? fmt.compactCr(x.disbursed) : fmt.number(x[key]) + (key === 'loans' ? ' loans' : key === 'women' ? ' women' : ' active');
          var sub = key === 'disbursed' ? fmt.number(x.loans) + (x.loans === 1 ? ' loan' : ' loans') + ' · ' + fmt.number(x.active) + ' active'
                  : fmt.compactCr(x.disbursed) + ' given';
          box.appendChild(el('div', withProps({ className: 'cd-cv-top-row cd-rp-rank-row', title: x.navId ? 'Open ' + x.name : x.name },
            x.navId ? onActivate(function () { self.go(self.path.concat([{ level: ch.level, id: x.navId }])); }) : {}), [
            el('span', { className: 'cd-cv-top-rank' }, String(i + 1)),
            el('span', { className: 'cd-rp-rank-who' }, [el('strong', {}, x.name), x.sub ? el('em', {}, x.sub) : null]),
            el('span', { className: 'cd-cv-top-bar' }, [el('i', { style: { width: (max > 0 ? Math.max(3, x[key] / max * 100) : 0) + '%', backgroundColor: '#15803d' } })]),
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
    var SORTS = [['repaid', 'Collected'], ['txns', 'Repayments']].concat(page.payOn ? [['online', 'Online %'], ['cash', 'Cash %']] : []);
    function val(e, key) {
      var r = e.row;
      if (key === 'txns') { return r.repayTxns || 0; }
      if (key === 'online') { return r.repaid > 0 ? online(r) / r.repaid : -1; }
      if (key === 'cash') { return r.repaid > 0 ? manualOf(r) / r.repaid : -1; }
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
        var main = key === 'txns' ? fmt.number(r.repayTxns) + ' payments' : key === 'online' ? pct(share) + ' online'
                 : key === 'cash' ? pct(r.repaid > 0 ? manualOf(r) / r.repaid : NaN) + ' cash' : fmt.compactCr(r.repaid);
        var sub = key === 'repaid' ? fmt.number(r.repayTxns) + ' payments' + (page.payOn ? ' · ' + pct(share) + ' online' : '')
                : key === 'cash' ? fmt.compactCr(manualOf(r)) + ' of ' + fmt.compactCr(r.repaid)
                : fmt.compactCr(r.repaid) + ' collected';
        box.appendChild(el('div', K.withProps({ className: 'cd-cv-top-row cd-rp-rank-row', title: e.navId ? 'Open ' + e.name : e.name },
          e.navId ? K.onActivate(function () { open(page, e); }) : {}), [
          el('span', { className: 'cd-cv-top-rank' }, String(i + 1)),
          el('span', { className: 'cd-rp-rank-who' }, [
            el('strong', {}, e.name),
            e.sub ? el('em', {}, e.sub) : null
          ]),
          el('span', { className: 'cd-cv-top-bar' }, [el('i', { style: { width: (max > 0 ? Math.max(3, v / max * 100) : 0) + '%',
            backgroundColor: key === 'cash' ? '#b45309' : key === 'online' ? '#0284c7' : '#2563eb' } })]),
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

  function womenTable(page, rows) {
    var list = rows.filter(function (r) { return (r.repaid || 0) > 0; })
                   .sort(function (a, b) { return (b.repaid || 0) - (a.repaid || 0); });
    var head = ['#', 'Woman', 'Collected', 'Payments'].concat(page.payOn ? ['UPI', 'POS (Paytm)', 'Auto-debit', 'Manual', 'Online'] : []);
    var body = list.map(function (r, i) {
      var cells = [
        el('td', { className: 'cd-ex-rank' }, String(i + 1)),
        el('td', {}, [el('div', { className: 'cd-ex-name' }, K.titleCase(r.name || r.id)), el('div', { className: 'cd-ex-sub' }, 'Member ID ' + r.id)]),
        el('td', { className: 'cd-num' }, fmt.rupees(r.repaid)),
        el('td', { className: 'cd-num' }, fmt.number(r.repayTxns))
      ];
      if (page.payOn) {
        var share = onlineShare(r), b = band(share);
        cells.push(el('td', { className: 'cd-num' }, fmt.rupees(r.upiAmount || 0)), el('td', { className: 'cd-num' }, fmt.rupees(r.posAmount || 0)),
                   el('td', { className: 'cd-num' }, fmt.rupees(r.autoAmount || 0)), el('td', { className: 'cd-num', style: { color: '#b45309' } }, fmt.rupees(manualOf(r))),
                   el('td', { className: 'cd-num' }, CeoDash.components.JourneyView.stateBadge(b), ' ', pct(share)));
      }
      return el('tr', {}, cells);
    });
    var paidNone = rows.length - list.length;
    return el('div', { className: 'cd-surface cd-rp-card', style: { marginTop: '18px' } }, [
      el('h3', { className: 'cd-rp-h3' }, 'How each woman paid'),
      el('p', { className: 'cd-text-muted cd-rp-small' }, list.length + ' women repaid in ' + page.periodName + (paidNone > 0 ? ' · ' + paidNone + ' made no repayment' : '') +
        '. Largest collections first.'),
      list.length ? el('div', { className: 'cd-ex-table-wrap' }, [el('table', { className: 'cd-ex-table' }, [
        el('thead', {}, [el('tr', {}, head.map(function (h) { return el('th', {}, h); }))]),
        el('tbody', {}, body)
      ])]) : K.note('No repayments recorded in ' + page.periodName + '.')
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
    { id: 'achievement', label: 'Disbursement vs target' }, { id: 'collected', label: 'Collected' }
  ];
  var SORT = 'online';

  function blankFig() {
    return { target: 0, hasTarget: false, disbursed: 0, loans: 0, open: 0, closed: 0, borrowers: 0, hasBorrowers: true,
             repaid: 0, txns: 0, upi: 0, pos: 0, auto: 0 };
  }
  function addRow(f, r) {
    if (!r) { return; }
    if (K.has(r.targetCr)) { f.target += r.targetCr * ONE_CRORE; f.hasTarget = true; }
    f.disbursed += r.disbursed || 0; f.loans += r.loanCount || 0; f.open += r.openLoans || 0; f.closed += r.closedLoans || 0;
    if (K.has(r.borrowers)) { f.borrowers += r.borrowers; } else { f.hasBorrowers = false; }
    f.repaid += r.repaid || 0; f.txns += r.repayTxns || 0;
    f.upi += r.upiAmount || 0; f.pos += r.posAmount || 0; f.auto += r.autoAmount || 0;
  }
  function finish(f) {
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
      if (n.kind === 'mandal') { addRow(n.fig, rowFor(n.office)); }
      else { n.children.forEach(function (c) { sum(c); addAll(n.fig, c.fig); }); }
      finish(n.fig);
    })(root);
    return root;
  }
  function addAll(f, c) {
    f.target += c.target; f.hasTarget = f.hasTarget || c.hasTarget; f.disbursed += c.disbursed; f.loans += c.loans;
    f.open += c.open; f.closed += c.closed; f.borrowers += c.borrowers; f.hasBorrowers = f.hasBorrowers && c.hasBorrowers;
    f.repaid += c.repaid; f.txns += c.txns; f.upi += c.upi; f.pos += c.pos; f.auto += c.auto;
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
               repaid: m.receivedRepayment, repayTxns: m.repayTxns };
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
    return fmt.missing(f.onlineShare) ? -1 : f.onlineShare;
  }

  function personCard(n, payOn, onOpen) {
    var f = n.fig, b = BAND[payOn ? bandOf(f) : 'no-data'];
    var c = counts(n);
    function many(k, one, more) { return k + ' ' + (k === 1 ? one : more); }
    var sub = n.kind === 'dgm' ? many(c.agm, 'AGM', 'AGMs') + ' · ' + many(c.officer, 'manager', 'managers') + ' · ' + many(c.mandal, 'mandal', 'mandals')
            : n.kind === 'agm' ? many(c.officer, 'manager', 'managers') + ' · ' + many(c.mandal, 'mandal', 'mandals') + ' · ' + n.districts.join(', ')
            : n.kind === 'officer' ? n.role + ' · ' + many(c.mandal, 'mandal', 'mandals') + ' · ' + n.districts.join(', ')
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
        el('div', {}, [el('span', {}, 'Women borrowers'), el('strong', {}, fmt.number(f.hasBorrowers ? f.borrowers : NaN))])
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
               : SORT === 'collected' ? fmt.compactCr(f.repaid) : pct(f.onlineShare) + ' online';
      var sub = fmt.compactCr(f.repaid) + ' collected' + (payOn ? ' · ' + fmt.compactCr(f.manual) + ' cash' : '') +
                ' · ' + fmt.compactCr(f.disbursed) + ' given';
      return el('div', K.withProps({ className: 'cd-cv-top-row cd-rp-rank-row', title: 'Open the collections of ' + k.name }, K.onActivate(function () {
        CeoDash.core.router.goToChapter('repayment-journey', [{ level: 'region', id: k.office.regionId }, { level: 'office', id: k.office.id }]);
      })), [
        el('span', { className: 'cd-cv-top-rank' }, String(i + 1)),
        el('span', { className: 'cd-rp-rank-who' }, [el('strong', {}, k.name), el('em', {}, k.role)]),
        el('span', { className: 'cd-cv-top-bar' }, [el('i', { style: { width: (max > 0 ? Math.max(3, v / max * 100) : 0) + '%', backgroundColor: SORT === 'cash' ? '#b45309' : b.color } })]),
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
        return { name: x.n.name + (x.n.districts.length ? ' · ' + x.n.districts.join(', ') : ''), path: x.path,
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
      var sorts = el('div', { className: 'cd-ex-pills' }, SORTS.filter(function (s) { return payOn || (s.id !== 'online' && s.id !== 'cash'); }).map(function (s) {
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

/* ---------- Start-up ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  var el = CeoDash.core.dom.el, clear = CeoDash.core.dom.clear;

  function buildShell(root) {
    clear(root);

    var header = document.createElement('header');
    header.className = 'top-header';
    header.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;">' +
      '  <div style="position:relative;display:flex;align-items:center;">' +
      '    <img src="' + CEO_ASSET_BASE + 'emblem.png" alt="AP Emblem" width="38" height="38" style="display:block;" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'flex\';">' +
      '    <div style="display:none;width:38px;height:38px;border-radius:50%;background:#15803d;color:#ffffff;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid #a16207;">AP</div>' +
      '  </div>' +
      '  <div>' +
      '    <h1 class="brand-title">STREE NIDHI ANDHRA PRADESH</h1>' +
      '    <div class="brand-subtitle">CEO Loan &amp; Repayment Intelligence</div>' +
      '  </div>' +
      '</div>' +
      (global.__CEO_LIVE ? '' :
      '<div class="search-container">' +
      '  <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '    <circle cx="11" cy="11" r="8"></circle>' +
      '    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>' +
      '  </svg>' +
      '  <input type="text" class="search-bar" placeholder="Search resources, services and docs...">' +
      '</div>') +
      '<div style="display:flex;align-items:center;gap:18px;">' +
      (global.__CEO_LIVE ? '' :
      '  <div style="position:relative;cursor:pointer;">' +
      '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>' +
      '    <span class="icon-badge">6</span>' +
      '  </div>') +
      '  <div id="cd-head-slot" class="cd-head-slot"></div>' +
      '  <div style="cursor:pointer;">' +
      '    <div class="cd-profile-circle">CEO</div>' +
      '  </div>' +
      '</div>';

    var navContainer = document.createElement('nav');
    navContainer.className = 'nav-menu';
    navContainer.id = 'cd-nav-menu';

    var content = el('main', { className: 'cd-app-content', id: 'cd-app-content' });

    var shellWrap = el('div', { className: 'cd-app-shell', style: { padding: '0', maxWidth: 'none' } }, [header, navContainer, content]);
    root.appendChild(shellWrap);

    return { navContainer: navContainer, content: content };
  }

  function renderError(content, err) {
    clear(content);
    content.appendChild(el('div', { className: 'cd-error-state cd-surface' }, [
      el('h2', {}, 'Something went wrong rendering this chapter'),
      el('p', { className: 'cd-text-muted' }, String(err && err.message ? err.message : err))
    ]));
  }

  function renderEmptyData(content) {
    clear(content);
    content.appendChild(el('div', { className: 'cd-empty-state cd-surface' }, [
      el('h2', {}, 'No data available'),
      el('p', { className: 'cd-text-muted' }, 'No districts were found in the dashboard data. Reload the page to try again.')
    ]));
  }

  var NOT_READY_RETRY_MS = 120000;
  function renderNotReady(content, message) {
    clear(content);
    content.appendChild(el('div', { className: 'cd-empty-state cd-surface' }, [
      el('h2', {}, 'Dashboard data is being prepared'),
      el('p', { className: 'cd-text-muted' }, message),
      el('p', { className: 'cd-text-muted' }, 'This page will reload automatically in 2 minutes.')
    ]));
    global.setTimeout(function () { global.location.reload(); }, NOT_READY_RETRY_MS);
  }

  function boot() {
    var root = document.getElementById('cd-app-root');
    var shell = buildShell(root);

    clear(shell.content);
    shell.content.appendChild(el('div', { className: 'cd-loading-state' }, [
      el('div', { className: 'cd-loading-spinner', 'aria-hidden': 'true' }),
      el('p', {}, 'Building the organizational picture...')
    ]));

    global.setTimeout(function () {
      CeoDash.data.load(function (loadErr, data) {
        if (loadErr) {
          if (loadErr.notReady) { renderNotReady(shell.content, loadErr.message); }
          else { renderError(shell.content, loadErr); }
          return;
        }

        if (!data || !data.regions || !data.regions.length) {
          renderEmptyData(shell.content);
          return;
        }

        function renderActive() {
          var snapshot = CeoDash.core.state.get();
          CeoDash.core.overlays.closeAll();
          CeoDash.core.chapterNav.render(shell.navContainer, snapshot.chapter);

          clear(shell.content);
          var headSlot = document.getElementById('cd-head-slot');
          if (headSlot) { clear(headSlot); }
          try {
            var chapterFn = (data.real && CeoDash.explorer.chapters[snapshot.chapter]) || CeoDash.chapters[snapshot.chapter];
            if (!chapterFn) { throw new Error('Unknown chapter: ' + snapshot.chapter); }
            chapterFn(shell.content, snapshot, data);
            CeoDash.core.transitions.fadeIn(shell.content, 260);
            CeoDash.core.transitions.staggerChildren(shell.content);
          } catch (renderErr) {
            renderError(shell.content, renderErr);
          }
        }

        CeoDash.core.theme.apply('executive');
        CeoDash.core.state.subscribe(renderActive);
        CeoDash.core.router.init();
      });
    }, 30);
  }

  if (document.addEventListener) {
    document.addEventListener('click', function (e) {
      var target = e.target;
      while (target && target !== document.body) {
        if (target.getAttribute && (
          target.getAttribute('role') === 'button' ||
          target.tagName === 'BUTTON' ||
          (target.className && typeof target.className === 'string' && (
            target.className.indexOf('cd-btn') !== -1 ||
            target.className.indexOf('cd-project-card') !== -1 ||
            target.className.indexOf('cd-loan-kpi-chevron') !== -1 ||
            target.className.indexOf('cd-emp-zone-summary-card') !== -1 ||
            target.className.indexOf('cd-emp-mgr-row') !== -1 ||
            target.className.indexOf('cd-action-item') !== -1 ||
            target.className.indexOf('cd-cal-day') !== -1 ||
            target.className.indexOf('cd-cal-attn-item') !== -1 ||
            target.className.indexOf('cd-nav__tab') !== -1 ||
            target.className.indexOf('cd-modal-btn') !== -1 ||
            target.className.indexOf('cd-card') !== -1
          ))
        )) {
          CeoDash.core.transitions.triggerRipple(e, target);
          break;
        }
        target = target.parentNode;
      }
    }, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
