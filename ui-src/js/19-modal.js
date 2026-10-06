/* ---------- Modal dialog ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.components = CeoDash.components || {};
  var el = CeoDash.core.dom.el, clear = CeoDash.core.dom.clear;

  var modalRoot = null;
  function ensureRoot() {
    if (!modalRoot || !modalRoot.parentNode) {
      modalRoot = document.getElementById('cd-modal-root');
      if (!modalRoot) {
        modalRoot = el('div', { id: 'cd-modal-root' });
        document.body.appendChild(modalRoot);
      }
    }
    return modalRoot;
  }

  var current = null;

  function open(opts) {
    opts = opts || {};
    if (current) { current.close(); }
    var root = ensureRoot();
    clear(root);
    root.style.display = '';

    var handle = { close: close };
    function close() {
      if (current === handle) { current = null; } else if (current) { return; }
      if (unreg) { unreg(); }
      clear(root);
      root.style.display = 'none';
      if (global.document.removeEventListener) {
        global.document.removeEventListener('keydown', onKey, false);
      }
      if (opts.onClose) { opts.onClose(); }
    }
    var unreg = CeoDash.core.overlays.add(close);

    function onKey(evt) {
      if (evt.keyCode === 27) { close(); }
    }

    var backdrop = el('div', { className: 'cd-modal-backdrop', onClick: close });

    var badgeEl = null;
    if (opts.badge) {
      var bType = opts.badgeType || 'blue';
      badgeEl = el('span', { className: 'cd-badge-high-contrast cd-badge-high-contrast--' + bType, style: { marginBottom: '6px' } }, [
        el('span', { className: 'cd-pulse-beacon cd-pulse-beacon--' + (bType === 'red' ? '' : (bType === 'green' ? 'green' : 'blue')) }),
        opts.badge
      ]);
    }

    var titleEl = el('h2', { className: 'cd-modal-title' }, opts.title || 'Executive Action');
    var subEl = opts.subtitle ? el('div', { className: 'cd-modal-subtitle' }, opts.subtitle) : null;
    var closeBtn = el('button', {
      type: 'button',
      className: 'cd-modal-close-btn',
      'aria-label': 'Close dialog',
      onClick: close
    }, '\u2715');

    var headerEl = el('div', {
      className: 'cd-modal-header' + (opts.badgeType === 'red' ? ' cd-modal-header--danger' : (opts.badgeType === 'green' ? ' cd-modal-header--success' : (opts.badgeType === 'amber' ? ' cd-modal-header--warning' : '')))
    }, [
      el('div', { style: { flex: '1', minWidth: '0' } }, [badgeEl, titleEl, subEl].filter(Boolean)),
      closeBtn
    ]);

    var bodyChildren = [];

    if (opts.stats && opts.stats.length) {
      var statBoxes = opts.stats.map(function (s) {
        return el('div', { className: 'cd-modal-stat-box' }, [
          el('div', { className: 'cd-modal-stat-lbl' }, s.label),
          el('div', { className: 'cd-modal-stat-val', style: s.color ? { color: s.color } : {} }, s.value)
        ]);
      });
      bodyChildren.push(el('div', { className: 'cd-modal-stat-grid' }, statBoxes));
    }

    if (opts.body) {
      if (typeof opts.body === 'string') {
        bodyChildren.push(el('div', { style: { fontSize: '13px', lineHeight: '1.55', color: '#334155', marginBottom: '16px' } }, opts.body));
      } else {
        bodyChildren.push(opts.body);
      }
    }

    if (opts.content) {
      bodyChildren.push(opts.content);
    }

    if (opts.actions && opts.actions.length) {
      bodyChildren.push(el('div', { className: 'cd-modal-section-title' }, 'Actions'));
      var actionBtns = opts.actions.map(function (act) {
        var actType = act.type || 'primary';
        var btn = el('button', {
          type: 'button',
          className: 'cd-modal-btn cd-modal-btn--' + actType,
          onClick: function () {
            if (act.onClick) {
              act.onClick(close);
            } else {
              close();
            }
          }
        }, [
          el('span', {}, act.label),
          act.badge ? el('span', { className: 'cd-modal-btn-badge' }, act.badge) : el('span', { style: { fontSize: '15px' } }, '\u2192')
        ]);
        return btn;
      });
      bodyChildren.push(el('div', { className: 'cd-modal-actions' }, actionBtns));
    }

    var bodyEl = el('div', { className: 'cd-modal-body' }, bodyChildren);

    var cardEl = el('div', {
      className: 'cd-modal-card',
      role: 'dialog',
      'aria-modal': 'true'
    }, [headerEl, bodyEl]);

    root.appendChild(backdrop);
    root.appendChild(cardEl);

    if (global.document.addEventListener) {
      global.document.addEventListener('keydown', onKey, false);
    }

    current = handle;
    return handle;
  }

  CeoDash.components.ActionModal = {
    open: open
  };
})(window);

