# Adding another dashboard

The project is one web application with a shared **platform** and one self-contained package per
**dashboard**. A new dashboard does not touch the existing ones.

## Names

| What | Rule | CEO example |
|---|---|---|
| Dashboard id | lower-case, dashes | `ceo-loan-intelligence` |
| Java package | `in.gov.ap.serp.sthreenidhi.dashboard.<name>` | `...dashboard.ceoloan` |
| Sub-packages | `web` (servlet), `service`, `dao`, `bean`, `cache`, `listener`, `util` | |
| Servlet URL | `/<PascalCaseName>` | `/CeoLoanIntelligence` |
| Page, scripts, styles | `WebContent/dashboards/<id>/` | `.../ceo-loan-intelligence/` (`CeoLoanIntelligence.jsp`, `app.js`, `app.css`) |
| Cache key prefix | `<name>|` (so a refresh clears only this dashboard) | `ceoloan|` |
| Settings (`-D`) | `<short>.dash.*` | `ceo.dash.refresh.hour` |
| Snapshot file | `sthreenidhi-<name>-snapshot.ser.gz` | |

## What the platform gives you (`in.gov.ap.serp.sthreenidhi.platform`)

- `security.LinkToken` / `AccessGuard` - signed links and the page's data token (see `EXTERNAL_SITE.md`).
- `web.ResponseCache`, `web.GzipSupport` - compressed, cached answers, ETag / 304.
- `db.DataSources` - `DataSources.connection("snbsap", "SNBSAP_DS")`; another database = another alias and JNDI name.
- `util.Text`, `util.FiscalYear`.

## Steps

1. Copy the `ceoloan` package as a starting point, rename it, change `DASHBOARD_ID` in its servlet.
2. In `WebContent/WEB-INF/web.xml` copy the CEO block (listener if it has one + servlet + mapping).
3. Put the page and assets in `WebContent/dashboards/<id>/`. In the JSP send the token to the page
   (`apiToken` request attribute -> `window.__TOKEN`) and have the scripts add `&t=<token>` to every call.
4. If it needs another database, add its data source on the server and use a new alias in `DataSources`.
5. Build (Ant) and deploy the same EAR. The link for the other site is `.../<ServletName>?action=page&exp=..&sig=..`
   with `sig = HMAC(secret, "<id>|view|" + exp)`.
