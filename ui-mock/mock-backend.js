/* Makes the dashboard run from a plain folder with FAKE data: no server, no database, no install.
   It sets the same page variables the real page writes, and answers the dashboard's data calls from mock-data.js.
   Pick a scenario in the address:  index.html?scenario=nooverdue   (see SCENARIOS in mock-data.js). ES5 only. */
(function (w) {
  'use strict';

  function query(s) {
    var out = {}, parts = String(s || '').replace(/^\?/, '').split('&');
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) { continue; }
      var kv = parts[i].split('='), k = decodeURIComponent((kv[0] || '').replace(/\+/g, ' '));
      out[k] = decodeURIComponent((kv.slice(1).join('=') || '').replace(/\+/g, ' '));
    }
    return out;
  }

  var scenario = query(w.location.search).scenario || '';
  try {
    if (scenario) { w.sessionStorage.setItem('mockScenario', scenario); }
    else { scenario = w.sessionStorage.getItem('mockScenario') || ''; }
  } catch (e) { /* storage blocked: the scenario only lasts for this page load */ }
  if (!w.CeoMock.SCENARIOS[scenario]) { scenario = 'normal'; }

  var mock = w.CeoMock.create(w.CeoMock.DISTRICTS);

  // the variables the real page (the .jsp) writes
  w.__CEO_LIVE = true;
  w.__CEO_CTX = '';
  w.__CEO_INITIAL_CHAPTER = 'pulse';
  w.__CEO_SNAPSHOT_MESSAGE = scenario === 'notready' ? 'The data is being prepared (preview).' : '';
  w.__CEO_RAND_ID = '';
  w.__CEO_TOKEN = '';
  w.__CEO_BOOT_DATA = mock.bootFor(scenario);

  // every call the dashboard makes with XMLHttpRequest is answered here
  function FakeXHR() { this.readyState = 0; this.status = 0; this.responseText = ''; this.timeout = 0; }
  FakeXHR.prototype.open = function (method, url) { this._url = String(url); this.readyState = 1; };
  FakeXHR.prototype.setRequestHeader = function () { };
  FakeXHR.prototype.abort = function () { };
  FakeXHR.prototype.send = function (body) {
    var self = this, q = query(this._url.split('?')[1] || '');
    if (body) { var b = query(body); for (var k in b) { if (Object.prototype.hasOwnProperty.call(b, k)) { q[k] = b[k]; } } }
    w.setTimeout(function () {
      var r = mock.answer(q.action || '', q, scenario);
      self.status = r.status; self.responseText = r.body; self.readyState = 4;
      if (self.onreadystatechange) { self.onreadystatechange(); }
      if (self.onload) { self.onload(); }
    }, scenario === 'slow' ? 1500 : 40);
  };
  w.XMLHttpRequest = FakeXHR;
})(window);
