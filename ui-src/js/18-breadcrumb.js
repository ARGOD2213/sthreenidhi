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
