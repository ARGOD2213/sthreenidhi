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
