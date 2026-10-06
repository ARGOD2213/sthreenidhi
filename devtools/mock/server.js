// Optional: the same fake-data preview as ui-mock/index.html, but served over http (so Excel buttons, cookies and live reload behave like a server).
//   node devtools/mock/server.js    ->    http://localhost:8088/    (ui-mock/index.html opens straight from the folder without this)
var http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
var M = require('../../ui-mock/mock-data.js'), mock = M.create(M.DISTRICTS);
var ROOT = path.join(__dirname, '..', '..'), PORT = +process.env.PORT || 8088;
var TYPES = { '.html': 'text/html;charset=UTF-8', '.js': 'application/javascript;charset=UTF-8', '.css': 'text/css;charset=UTF-8' };

http.createServer(function (req, res) {
  var u = url.parse(req.url, true), p = u.pathname;
  if (req.method === 'POST') {
    var chunks = []; req.on('data', function (c) { chunks.push(c); });
    return req.on('end', function () { call(res, require('querystring').parse(Buffer.concat(chunks).toString()), u.query.scenario); });
  }
  if (p === '/' || p === '/index.html') { p = '/ui-mock/index.html'; }
  if (p === '/CeoLoanIntelligence') { return call(res, u.query, u.query.scenario); }
  var file = path.join(ROOT, p);
  if (file.indexOf(ROOT) !== 0 || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, function () { console.log('Preview with fake data: http://localhost:' + PORT + '/'); });

function call(res, q, scenario) {      // the page's own calls go through the browser shim; this is only for form posts (Excel downloads)
  var r = mock.answer(q.action || '', q, scenario || 'normal');
  res.writeHead(r.status, { 'Content-Type': r.json ? 'application/json;charset=UTF-8' : 'text/plain;charset=UTF-8', 'Cache-Control': 'no-store' });
  res.end(r.body);
}
