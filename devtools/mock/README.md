# Mock dashboard (fake data)

Runs the real page, scripts and styles against made-up data so the screens can be styled without the database.

    start-mock.bat          (Windows)        or        sh start-mock.sh        or        node server.js

- Needs Node.js 12+. No packages to install. Port 8088 (`PORT=9000 node server.js` to change).
- Scripts and styles are read straight from `../../ui-src` and the page reloads when you save a part.
  `MOCK_ASSETS=built node server.js` serves the built `app.js` / `app.css` instead.
- `/sthreenidhi/mock` lists the scenarios: normal, nooverdue, overduefailed, empty, notready, slow, servererror.
- Excel buttons answer with a text stand-in (the real server builds the file).
- Never copied to the office / live server: it lives outside `WebContent`, and `tools/check-release.js` fails the build if
  mock text gets into `WebContent`, `src` or `ear`.
