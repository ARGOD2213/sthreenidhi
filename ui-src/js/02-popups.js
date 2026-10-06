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
