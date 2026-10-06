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
