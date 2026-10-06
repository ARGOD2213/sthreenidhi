/* ---------- A loan's arrears line (shown on a woman's loans) ---------- */
(function (global) {
  'use strict';
  var CeoDash = global.CeoDash = global.CeoDash || {};
  // l.arrears / l.balance / l.emi come from the daily loan status table; absent for closed loans or when overdue is not available
  CeoDash.core.arrearsLine = function (l) {
    if (!l || l.arrears === undefined || l.arrears === null) { return null; }
    var fmt = CeoDash.core.format, behind = l.arrears > 0;
    return CeoDash.core.dom.el('div', { className: 'cd-lg-arrears ' + (behind ? 'cd-lg-arrears--bad' : 'cd-lg-arrears--ok') },
      behind ? 'Overdue ' + fmt.rupees(l.arrears) + ' \u00b7 balance ' + fmt.rupees(l.balance) + (l.emi > 0 ? ' \u00b7 instalment ' + fmt.rupees(l.emi) : '')
             : 'Up to date \u00b7 balance ' + fmt.rupees(l.balance));
  };
})(window);
