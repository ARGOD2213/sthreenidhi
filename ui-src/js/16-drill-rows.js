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
