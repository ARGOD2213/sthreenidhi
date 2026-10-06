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
