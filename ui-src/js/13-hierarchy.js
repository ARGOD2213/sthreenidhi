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
