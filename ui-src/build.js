// Joins the part files into the two files the server serves (app.js and app.css).
//   node ui-src/build.js            write WebContent/dashboards/ceo-loan-intelligence/app.js and app.css
//   node ui-src/build.js --check    only compare; exit code 1 if the deployed files are out of date
// No packages needed. Parts are joined byte for byte in file-name order (the numeric prefix is the order).
var fs = require('fs'), path = require('path');
var root = __dirname;
var out = path.join(root, '..', 'WebContent', 'dashboards', 'ceo-loan-intelligence');
var check = process.argv.indexOf('--check') !== -1;

function parts(dirs, ext) {
  var files = [];
  dirs.forEach(function (d) {
    var dir = path.join(root, d);
    if (!fs.existsSync(dir)) { return; }
    fs.readdirSync(dir).filter(function (f) { return f.slice(-ext.length) === ext; }).sort().forEach(function (f) { files.push(path.join(dir, f)); });
  });
  return files;
}
function join(files) { return Buffer.concat(files.map(function (f) { return fs.readFileSync(f); })); }

var jobs = [
  { name: 'app.js',  files: parts(['js'], '.js') },
  { name: 'app.css', files: parts(['css', 'theme'], '.css') }     // theme/ comes last, so it wins over the older rules
];
var crypto = require('crypto');
var jsp = path.join(out, 'CeoLoanIntelligence.jsp');
var datas = jobs.map(function (j) { return join(j.files); });
// the page asks for app.js?v=<this>; it changes whenever a part changes, so nobody has to remember to bump it
var version = crypto.createHash('sha1').update(Buffer.concat(datas)).digest('hex').slice(0, 10);
var stale = false;
jobs.forEach(function (j) {
  var data = join(j.files), target = path.join(out, j.name);
  var same = fs.existsSync(target) && Buffer.compare(fs.readFileSync(target), data) === 0;
  if (check) {
    console.log((same ? 'OK     ' : 'STALE  ') + j.name + '  (' + j.files.length + ' parts)');
    if (!same) { stale = true; }
  } else {
    if (!same) { fs.writeFileSync(target, data); }
    console.log((same ? 'unchanged ' : 'written   ') + j.name + '  ' + data.length + ' bytes from ' + j.files.length + ' parts');
  }
});
var jspText = fs.readFileSync(jsp, 'utf8');
var jspNew = jspText.replace(/(ASSET_VERSION\s*=\s*")[^"]*(")/, '$1' + version + '$2');
if (check) {
  console.log((jspNew === jspText ? 'OK     ' : 'STALE  ') + 'CeoLoanIntelligence.jsp  (ASSET_VERSION ' + version + ')');
  if (jspNew !== jspText) { stale = true; }
} else if (jspNew !== jspText) {
  fs.writeFileSync(jsp, jspNew);
  console.log('written   CeoLoanIntelligence.jsp  ASSET_VERSION = ' + version);
}
if (check && stale) { console.log('\nThe deployed files do not match the parts. Run: node ui-src/build.js'); process.exit(1); }
