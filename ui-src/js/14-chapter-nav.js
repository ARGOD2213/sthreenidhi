/* ---------- Chapter navigation bar ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};
  var el = CeoDash.core.dom.el;

  var CHAPTERS = [
    {
      id: 'pulse',
      label: 'Overview',
      iconImg: 'overview-icon.png',
      iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>'
    },
    {
      id: 'loan-journey',
      label: 'Loans Given',
      iconImg: 'money_bag_dark_icon.png',
      iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>'
    },
    {
      id: 'repayment-journey',
      label: 'Repayment & Payments',
      iconImg: 'Path 99035.png',
      iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>'
    },
    {
      id: 'performance-map',
      label: 'Employee Performance',
      iconImg: 'person_icon.png',
      iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'
    },
    {
      id: 'calendar',
      label: 'Calendar',
      iconImg: 'calendar_icon.png',
      iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'
    }
  ];

  function render(container, activeChapterId) {
    while (container.firstChild) { container.removeChild(container.firstChild); }

    var items = CHAPTERS.map(function (chapter) {
      var isActive = chapter.id === activeChapterId;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-item-custom' + (isActive ? ' active' : '');
      if (isActive) { btn.setAttribute('aria-current', 'page'); }
      btn.innerHTML =
        '<span class="nav-item-icon">' +
        '  <span style="display:inline-block;">' + chapter.iconSvg + '</span>' +
        '</span>' +
        '<span>' + chapter.label + '</span>';
      btn.onclick = function () {
        CeoDash.core.context.set({ districtId: null, focusManager: null, focusZoneId: null });
        CeoDash.core.router.goToChapter(chapter.id, []);
      };
      return btn;
    });

    for (var i = 0; i < items.length; i++) {
      container.appendChild(items[i]);
    }
  }

  CeoDash.core.chapterNav = { render: render, CHAPTERS: CHAPTERS };
})(window);

