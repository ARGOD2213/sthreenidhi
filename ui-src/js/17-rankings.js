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
