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
