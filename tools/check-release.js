// Run before every deployment build:  node tools/check-release.js
// 1. the deployed app.js / app.css / ASSET_VERSION match the part files in ui-src/
// 2. no mock or preview text is inside what goes into the EAR (WebContent, src, ear, build.xml)
// 3. the mock folder and the part files are not inside WebContent
var fs = require('fs'), path = require('path'), cp = require('child_process');
var root = path.join(__dirname, '..');
var problems = [];

try { cp.execSync('node "' + path.join(root, 'ui-src', 'build.js') + '" --check', { stdio: 'pipe' }); }
catch (e) { problems.push('The deployed app.js / app.css / ASSET_VERSION are not built from ui-src. Run: node ui-src/build.js\n' + String(e.stdout)); }

function walk(dir, out) {
  if (!fs.existsSync(dir)) { return out; }
  fs.readdirSync(dir).forEach(function (f) {
    var p = path.join(dir, f), st = fs.statSync(p);
    if (st.isDirectory()) { walk(p, out); } else { out.push(p); }
  });
  return out;
}
var skip = /\.(jar|png|jpg|gif|class|ico|ear|war)$/i;
['WebContent', 'src', 'ear'].map(function (d) { return path.join(root, d); }).concat([path.join(root, 'build.xml')]).forEach(function (target) {
  (fs.existsSync(target) && fs.statSync(target).isFile() ? [target] : walk(target, [])).forEach(function (f) {
    if (skip.test(f)) { return; }
    var t = fs.readFileSync(f, 'latin1');
    if (/mock|devtools|ui-src/i.test(t)) { problems.push('mock / dev text found in ' + path.relative(root, f)); }
  });
});
['devtools', 'ui-src'].forEach(function (d) {
  if (fs.existsSync(path.join(root, 'WebContent', d))) { problems.push(d + ' must not be inside WebContent'); }
});

if (problems.length) { console.log('NOT READY FOR DEPLOYMENT:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('Release check passed: assets are built from ui-src, no mock text in WebContent / src / ear.');
