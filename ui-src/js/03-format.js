/* ---------- Number, money and date formatting ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  function indianGroup(numStr) {
    var isNeg = numStr.charAt(0) === '-';
    if (isNeg) { numStr = numStr.substring(1); }
    var lastThree = numStr.substring(numStr.length - 3);
    var rest = numStr.substring(0, numStr.length - 3);
    if (rest !== '') {
      lastThree = ',' + lastThree;
      rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    }
    var result = rest + lastThree;
    return isNeg ? '-' + result : result;
  }

  var NA_TEXT = '—';
  function missing(v) { return v === null || v === undefined || typeof v !== 'number' || !isFinite(v); }

  function rupees(amount) {
    if (missing(amount)) { return NA_TEXT; }
    var whole = Math.round(amount);
    return 'Rs. ' + indianGroup(String(Math.abs(whole))) + (whole < 0 ? '' : '');
  }

  function compactCr(amount) {
    if (missing(amount)) { return NA_TEXT; }
    var abs = Math.abs(amount);
    var sign = amount < 0 ? '-' : '';
    if (abs >= 10000000) { return sign + '₹' + (abs / 10000000).toFixed(2) + ' Cr'; }
    if (abs >= 100000) { return sign + '₹' + (abs / 100000).toFixed(2) + ' L'; }
    if (abs >= 1000) { return sign + '₹' + (abs / 1000).toFixed(1) + ' K'; }
    return sign + '₹' + Math.round(abs);
  }

  function percent(fraction, decimals) {
    if (missing(fraction)) { return NA_TEXT; }
    var d = decimals === undefined ? 1 : decimals;
    return (fraction * 100).toFixed(d) + '%';
  }

  function signedPercent(fraction, decimals) {
    if (missing(fraction)) { return NA_TEXT; }
    var val = fraction * 100;
    var d = decimals === undefined ? 1 : decimals;
    return (val >= 0 ? '+' : '') + val.toFixed(d) + '%';
  }

  function number(n) {
    if (missing(n)) { return NA_TEXT; }
    return indianGroup(String(Math.round(n)));
  }

  function performanceState(pct, kind) {
    if (pct === null || pct === undefined || isNaN(pct)) { return 'no-data'; }
    if (kind === 'repayment') {
      if (pct >= 92) { return 'healthy'; }
      if (pct >= 90) { return 'watch'; }
      if (pct >= 88) { return 'attention'; }
      return 'critical';
    }
    if (pct >= 95) { return 'healthy'; }
    if (pct >= 85) { return 'watch'; }
    if (pct >= 70) { return 'attention'; }
    return 'critical';
  }
  var STATE_ROLE = { healthy: 'repay', watch: 'primary', attention: 'primary', critical: 'risk', 'no-data': 'textDim' };
  var STATE_LABEL = { healthy: 'Strong', watch: 'Good', attention: 'Attention', critical: 'Concern', 'no-data': 'No data' };
  function stateRole(state) { return STATE_ROLE[state] || STATE_ROLE['no-data']; }
  function stateLabel(state) { return STATE_LABEL[state] || STATE_LABEL['no-data']; }

  function targetBlock(target, actual) {
    var achievementPct = (target > 0 && !missing(actual)) ? (actual / target) * 100 : NaN;
    return {
      target: target,
      actual: actual,
      achievementPct: achievementPct,
      gap: actual - target,
      state: performanceState(achievementPct)
    };
  }

  CeoDash.core.format = {
    missing: missing,
    NA_TEXT: NA_TEXT,
    rupees: rupees,
    compactCr: compactCr,
    percent: percent,
    signedPercent: signedPercent,
    number: number,
    performanceState: performanceState,
    stateRole: stateRole,
    stateLabel: stateLabel,
    targetBlock: targetBlock
  };
})(window);
