/* ---------- Toast messages ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};
  var el = CeoDash.core.dom.el;

  var container = null;
  function ensureContainer() {
    if (!container || !container.parentNode) {
      container = document.getElementById('cd-toast-container');
      if (!container) {
        container = el('div', { id: 'cd-toast-container', role: 'region', 'aria-live': 'polite' });
        document.body.appendChild(container);
      }
    }
    return container;
  }

  var TYPE_ICONS = {
    success: '\u2713',
    info: '\u2139',
    warning: '\u26A0',
    danger: '\u2715'
  };

  function show(opts) {
    if (typeof opts === 'string') {
      opts = { title: 'Notification', message: opts, type: 'info' };
    }
    opts = opts || {};
    var type = opts.type || 'success';
    var title = opts.title || (type === 'success' ? 'Done' : 'Alert');
    var message = opts.message || '';
    var duration = typeof opts.duration === 'number' ? opts.duration : 4200;

    var root = ensureContainer();

    var iconEl = el('div', { className: 'cd-toast__icon' }, TYPE_ICONS[type] || '\u2713');
    var titleEl = el('div', { className: 'cd-toast__title' }, title);
    var descEl = el('div', { className: 'cd-toast__desc' }, message);
    var bodyEl = el('div', { className: 'cd-toast__body' }, [titleEl, descEl]);

    var progressFill = el('div', {
      className: 'cd-toast__progress-fill',
      style: { animationDuration: (duration / 1000) + 's' }
    });
    var progressEl = el('div', { className: 'cd-toast__progress' }, [progressFill]);

    var toastEl;
    function dismiss() {
      if (!toastEl || !toastEl.parentNode) { return; }
      toastEl.style.animation = 'cdToastFadeOut 0.24s ease-out forwards';
      global.setTimeout(function () {
        if (toastEl && toastEl.parentNode) {
          toastEl.parentNode.removeChild(toastEl);
        }
      }, 250);
    }

    var closeBtn = el('button', {
      type: 'button',
      className: 'cd-toast__close',
      'aria-label': 'Close',
      onClick: dismiss
    }, '\u00D7');

    toastEl = el('div', {
      className: 'cd-toast cd-toast--' + type,
      role: 'alert'
    }, [iconEl, bodyEl, closeBtn, progressEl]);

    root.appendChild(toastEl);

    if (duration > 0) {
      global.setTimeout(dismiss, duration);
    }

    return { dismiss: dismiss };
  }

  CeoDash.core.toast = {
    show: show,
    success: function (title, msg) { return show({ title: title, message: msg, type: 'success' }); },
    info: function (title, msg) { return show({ title: title, message: msg, type: 'info' }); },
    warning: function (title, msg) { return show({ title: title, message: msg, type: 'warning' }); },
    danger: function (title, msg) { return show({ title: title, message: msg, type: 'danger' }); }
  };
})(window);
