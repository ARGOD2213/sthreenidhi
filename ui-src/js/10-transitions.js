/* ---------- Page transitions ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  function prefersReducedMotion() {
    if (!global.matchMedia) { return false; }
    var mq = global.matchMedia('(prefers-reduced-motion: reduce)');
    return !!(mq && mq.matches);
  }

  function rect(el) {
    var r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  function snapshot(el) {
    if (!el) { return null; }
    return rect(el);
  }

  function playFlip(el, firstRect, duration) {
    if (!el || !firstRect || prefersReducedMotion()) { return; }
    duration = duration || 320;

    var last = rect(el);
    var dx = firstRect.left - last.left;
    var dy = firstRect.top - last.top;
    var sx = last.width ? firstRect.width / last.width : 1;
    var sy = last.height ? firstRect.height / last.height : 1;

    el.style.transformOrigin = 'top left';
    el.style.transition = 'none';
    el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
    el.style.opacity = '0.6';

    el.offsetHeight;

    el.style.transition = 'transform ' + duration + 'ms ease, opacity ' + duration + 'ms ease';
    el.style.transform = 'translate(0,0) scale(1,1)';
    el.style.opacity = '1';

    global.setTimeout(function () {
      el.style.transition = '';
      el.style.transform = '';
      el.style.transformOrigin = '';
    }, duration + 30);
  }

  function fadeIn(el, duration) {
    if (!el) { return; }
    duration = duration || 220;
    if (prefersReducedMotion()) { el.style.opacity = '1'; return; }
    el.style.opacity = '0';
    el.style.transition = 'opacity ' + duration + 'ms ease';
    global.setTimeout(function () {
      el.style.opacity = '1';
    }, 10);
    global.setTimeout(function () {
      el.style.transition = '';
    }, duration + 30);
  }

  function slideIn(el, fromSide, duration) {
    if (!el) { return; }
    duration = duration || 260;
    if (prefersReducedMotion()) { el.style.transform = ''; el.style.opacity = '1'; return; }
    var offset = fromSide === 'left' ? '-16px' : '16px';
    el.style.opacity = '0';
    el.style.transform = 'translateX(' + offset + ')';
    el.style.transition = 'none';
    el.offsetHeight;
    el.style.transition = 'transform ' + duration + 'ms ease, opacity ' + duration + 'ms ease';
    el.style.transform = 'translateX(0)';
    el.style.opacity = '1';
    global.setTimeout(function () {
      el.style.transition = '';
    }, duration + 30);
  }

  function staggerChildren(container, selector, maxItems) {
    if (!container || prefersReducedMotion()) { return; }
    maxItems = maxItems || 12;
    var items = selector ? container.querySelectorAll(selector) : container.children;
    if (!items || !items.length) { return; }
    for (var i = 0; i < items.length && i < maxItems; i++) {
      var item = items[i];
      if (!item) { continue; }
      item.className = (item.className + ' cd-stagger-item cd-stagger-' + (i + 1)).replace(/^\s+/, '');
    }
  }

  function countUp(node, targetNum, prefix, suffix, duration) {
    if (!node) { return; }
    prefix = prefix || '';
    suffix = suffix || '';
    if (prefersReducedMotion()) {
      node.textContent = prefix + targetNum + suffix;
      return;
    }
    duration = duration || 600;
    var startTime = null;
    var startVal = 0;
    var parsed = parseFloat(String(targetNum).replace(/[^0-9.-]/g, '')) || 0;
    var isDecimal = String(targetNum).indexOf('.') !== -1;

    function step(timestamp) {
      if (!startTime) { startTime = timestamp; }
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 3);
      var current = startVal + (parsed - startVal) * ease;
      node.textContent = prefix + (isDecimal ? current.toFixed(1) : Math.round(current)) + suffix;
      if (progress < 1) {
        if (global.requestAnimationFrame) { global.requestAnimationFrame(step); }
        else { global.setTimeout(function () { step(new Date().getTime()); }, 16); }
      } else {
        node.textContent = prefix + targetNum + suffix;
      }
    }

    if (global.requestAnimationFrame) { global.requestAnimationFrame(step); }
    else { global.setTimeout(function () { step(new Date().getTime()); }, 16); }
  }

  function triggerRipple(e, hostEl) {
    if (!hostEl || prefersReducedMotion()) { return; }
    var rect = hostEl.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 1.5;
    var clickX = (e && typeof e.clientX === 'number') ? e.clientX : (rect.left + rect.width / 2);
    var clickY = (e && typeof e.clientY === 'number') ? e.clientY : (rect.top + rect.height / 2);
    var x = clickX - rect.left - (size / 2);
    var y = clickY - rect.top - (size / 2);

    if (hostEl.className.indexOf('cd-ripple-host') === -1) {
      hostEl.className = (hostEl.className + ' cd-ripple-host').replace(/^\s+/, '');
    }

    var wave = document.createElement('span');
    wave.className = 'cd-ripple-wave';
    wave.style.width = size + 'px';
    wave.style.height = size + 'px';
    wave.style.left = x + 'px';
    wave.style.top = y + 'px';
    hostEl.appendChild(wave);

    global.setTimeout(function () {
      if (wave && wave.parentNode) {
        wave.parentNode.removeChild(wave);
      }
    }, 550);
  }

  CeoDash.core.transitions = {
    prefersReducedMotion: prefersReducedMotion,
    snapshot: snapshot,
    playFlip: playFlip,
    fadeIn: fadeIn,
    slideIn: slideIn,
    staggerChildren: staggerChildren,
    countUp: countUp,
    triggerRipple: triggerRipple
  };
})(window);
