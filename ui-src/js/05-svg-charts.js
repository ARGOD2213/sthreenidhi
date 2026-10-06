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
