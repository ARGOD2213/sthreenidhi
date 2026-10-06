/* ---------- Start-up ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  var el = CeoDash.core.dom.el, clear = CeoDash.core.dom.clear;

  function buildShell(root) {
    clear(root);

    var header = document.createElement('header');
    header.className = 'top-header';
    header.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;">' +
      '  <div style="position:relative;display:flex;align-items:center;">' +
      '    <img src="' + CEO_ASSET_BASE + 'emblem.png" alt="AP Emblem" width="38" height="38" style="display:block;" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'flex\';">' +
      '    <div style="display:none;width:38px;height:38px;border-radius:50%;background:#15803d;color:#ffffff;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid #a16207;">AP</div>' +
      '  </div>' +
      '  <div>' +
      '    <h1 class="brand-title">STREE NIDHI ANDHRA PRADESH</h1>' +
      '    <div class="brand-subtitle">CEO Loan &amp; Repayment Intelligence</div>' +
      '  </div>' +
      '</div>' +
      (global.__CEO_LIVE ? '' :
      '<div class="search-container">' +
      '  <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '    <circle cx="11" cy="11" r="8"></circle>' +
      '    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>' +
      '  </svg>' +
      '  <input type="text" class="search-bar" placeholder="Search resources, services and docs...">' +
      '</div>') +
      '<div style="display:flex;align-items:center;gap:18px;">' +
      (global.__CEO_LIVE ? '' :
      '  <div style="position:relative;cursor:pointer;">' +
      '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>' +
      '    <span class="icon-badge">6</span>' +
      '  </div>') +
      '  <div id="cd-head-slot" class="cd-head-slot"></div>' +
      '  <div style="cursor:pointer;">' +
      '    <div class="cd-profile-circle">CEO</div>' +
      '  </div>' +
      '</div>';

    var navContainer = document.createElement('nav');
    navContainer.className = 'nav-menu';
    navContainer.id = 'cd-nav-menu';

    var content = el('main', { className: 'cd-app-content', id: 'cd-app-content' });

    var shellWrap = el('div', { className: 'cd-app-shell', style: { padding: '0', maxWidth: 'none' } }, [header, navContainer, content]);
    root.appendChild(shellWrap);

    return { navContainer: navContainer, content: content };
  }

  function renderError(content, err) {
    clear(content);
    content.appendChild(el('div', { className: 'cd-error-state cd-surface' }, [
      el('h2', {}, 'Something went wrong rendering this chapter'),
      el('p', { className: 'cd-text-muted' }, String(err && err.message ? err.message : err))
    ]));
  }

  function renderEmptyData(content) {
    clear(content);
    content.appendChild(el('div', { className: 'cd-empty-state cd-surface' }, [
      el('h2', {}, 'No data available'),
      el('p', { className: 'cd-text-muted' }, 'No districts were found in the dashboard data. Reload the page to try again.')
    ]));
  }

  var NOT_READY_RETRY_MS = 120000;
  function renderNotReady(content, message) {
    clear(content);
    content.appendChild(el('div', { className: 'cd-empty-state cd-surface' }, [
      el('h2', {}, 'Dashboard data is being prepared'),
      el('p', { className: 'cd-text-muted' }, message),
      el('p', { className: 'cd-text-muted' }, 'This page will reload automatically in 2 minutes.')
    ]));
    global.setTimeout(function () { global.location.reload(); }, NOT_READY_RETRY_MS);
  }

  function boot() {
    var root = document.getElementById('cd-app-root');
    var shell = buildShell(root);

    clear(shell.content);
    shell.content.appendChild(el('div', { className: 'cd-loading-state' }, [
      el('div', { className: 'cd-loading-spinner', 'aria-hidden': 'true' }),
      el('p', {}, 'Building the organizational picture...')
    ]));

    global.setTimeout(function () {
      CeoDash.data.load(function (loadErr, data) {
        if (loadErr) {
          if (loadErr.notReady) { renderNotReady(shell.content, loadErr.message); }
          else { renderError(shell.content, loadErr); }
          return;
        }

        if (!data || !data.regions || !data.regions.length) {
          renderEmptyData(shell.content);
          return;
        }

        function renderActive() {
          var snapshot = CeoDash.core.state.get();
          CeoDash.core.overlays.closeAll();
          CeoDash.core.chapterNav.render(shell.navContainer, snapshot.chapter);

          clear(shell.content);
          var headSlot = document.getElementById('cd-head-slot');
          if (headSlot) { clear(headSlot); }
          try {
            var chapterFn = (data.real && CeoDash.explorer.chapters[snapshot.chapter]) || CeoDash.chapters[snapshot.chapter];
            if (!chapterFn) { throw new Error('Unknown chapter: ' + snapshot.chapter); }
            chapterFn(shell.content, snapshot, data);
            CeoDash.core.transitions.fadeIn(shell.content, 260);
            CeoDash.core.transitions.staggerChildren(shell.content);
          } catch (renderErr) {
            renderError(shell.content, renderErr);
          }
        }

        CeoDash.core.theme.apply('executive');
        try { CeoDash.customExcel.mount(data); } catch (cxErr) { if (global.console) { global.console.error(cxErr); } }
        CeoDash.core.state.subscribe(renderActive);
        CeoDash.core.router.init();
      });
    }, 30);
  }

  if (document.addEventListener) {
    document.addEventListener('click', function (e) {
      var target = e.target;
      while (target && target !== document.body) {
        if (target.getAttribute && (
          target.getAttribute('role') === 'button' ||
          target.tagName === 'BUTTON' ||
          (target.className && typeof target.className === 'string' && (
            target.className.indexOf('cd-btn') !== -1 ||
            target.className.indexOf('cd-project-card') !== -1 ||
            target.className.indexOf('cd-loan-kpi-chevron') !== -1 ||
            target.className.indexOf('cd-emp-zone-summary-card') !== -1 ||
            target.className.indexOf('cd-emp-mgr-row') !== -1 ||
            target.className.indexOf('cd-action-item') !== -1 ||
            target.className.indexOf('cd-cal-day') !== -1 ||
            target.className.indexOf('cd-cal-attn-item') !== -1 ||
            target.className.indexOf('cd-nav__tab') !== -1 ||
            target.className.indexOf('cd-modal-btn') !== -1 ||
            target.className.indexOf('cd-card') !== -1
          ))
        )) {
          CeoDash.core.transitions.triggerRipple(e, target);
          break;
        }
        target = target.parentNode;
      }
    }, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
