# Release 2: overdue, custom Excel, neater pages

Everything here was written to Java 6 / Servlet 2.4 / JBoss 5 rules and checked by compiling the whole
source tree and by trying every screen in a local preview with made-up data. **None of it has run against the real SNBSAP
database yet** - the first live start is the real test (steps below).

## What is new

1. **Overdue (arrears)** from `SN.SHG_MEMBER_LOAN_STATUS_NEW` (refreshed daily by SNBSAP):
   - Overview: new section **Loans at Risk (Overdue)** (overdue amount, loans in arrears, balance at risk, total outstanding,
     how far behind: up to 1 / 1 to 3 / over 3 instalments). Follows the district chosen on the map.
   - Loans Given: **Overdue** tile; rank districts / mandals by **Overdue amount** and **Overdue %**.
   - Repayment & Payments: rank by **Overdue** and **Overdue %**.
   - Employee Performance: **Overdue** tile, overdue on every DGM / AGM / manager card, rank by **Overdue %**.
   - **VO, SHG and women lists**: the same Overdue ranking, read live for the list you open (one small query on the
     indexed status table); a woman's profile shows each open loan's **overdue, balance and instalment** (or "Up to date").
   - Excel downloads (district, mandal, VO, SHG and women lists and the employee sheets) carry overdue columns.
   - If the status table cannot be read, the dashboard still works and simply hides overdue (see the log line below).
2. **Custom Excel**: a floating button (bottom right). Choose what each row is (district, mandal, project, month, manager,
   AGM, DGM), districts / mandals, months, project, columns (loans, collections, target, overdue), sort, row limit; preview the
   first rows, then download the `.xls`. Built from the in-memory data, so it answers at once and never loads the database.
3. **Neater pages**: one page frame for every chapter, sticky full-height map on Overview, rounded cards instead of
   arrow shapes, women of an SHG shown as cards (not a nine-column table), tables with headings over their numbers,
   short "+N more" lists instead of long AGM lines, a colour accent per chapter.

## Files to copy to the office project (same paths as in this repository)

| File | Change |
|---|---|
| `src/.../dashboard/ceoloan/dao/CeoLoanIntelligenceDAO.java` | new method `getMandalOverdueRollup` |
| `src/.../dashboard/ceoloan/dao/CeoLoanIntelligenceDAOImpl.java` | the overdue query |
| `src/.../dashboard/ceoloan/cache/CeoDashboardSnapshotBuilder.java` | overdue fields per mandal, district, state, employee |
| `src/.../dashboard/ceoloan/cache/CeoDashCacheLoader.java` | an older saved snapshot (no overdue) is ignored once |
| `src/.../dashboard/ceoloan/service/CeoDashExport.java` | overdue columns in Excel files |
| `src/.../dashboard/ceoloan/service/CeoDashboardService.java` | overdue added to VO / SHG / women lists and to a woman's loans |
| `src/.../dashboard/ceoloan/service/CeoDashCustomExport.java` | **NEW file** (create it in the `service` package) |
| `src/.../dashboard/ceoloan/web/CeoLoanIntelligenceServlet.java` | `custom` and `customPreview` actions |
| `WebContent/dashboards/ceo-loan-intelligence/CeoLoanIntelligence.jsp` | overdue fields in the page data, new asset version |
| `WebContent/dashboards/ceo-loan-intelligence/app.js` | screens |
| `WebContent/dashboards/ceo-loan-intelligence/app.css` | styles |

(`src/...` = `src/in/gov/ap/serp/sthreenidhi`.) No new jar, no `web.xml` or `jboss-web.xml` change.
Then clean + build the EAR exactly as before.

## After the deploy: what to check

1. `server.log` (search `[CEO-DASH]`):
   - `Saved snapshot is from an older release (no overdue figures); building a new one` - normal on the first start.
   - `DAO getMandalOverdueRollup rows=... ms=...` - the overdue query worked (about 600 to 700 rows).
   - `DAO getOverdueByUnit VO ...` / `getOverdueByLoan` appear when someone opens a VO, SHG or woman (should take well under a second).
   - Instead: `Overdue figures not available (...)` - the query failed; send me the reason (usually a permission on
     `SN.SHG_MEMBER_LOAN_STATUS_NEW`). The dashboard keeps working without overdue.
   - `Overdue figures look wrong for district ...; not shown` - a safety check refused the numbers.
2. The first build takes about as long as before plus the overdue query (a minute or two more).
3. Overview: **Loans at Risk** should show roughly **Rs 123 crore overdue, 1.7 lakh loans in arrears,
   about Rs 8,380 crore outstanding** (the figures from our database checks; small differences are normal because the
   dashboard counts active women only).
4. Click the green **Custom Excel** button: pick *Districts*, *Preview*, then *Download Excel*. Open the file: sheet
   `Report`, sheet `About` (lists every choice and the data date).
5. Check Loans Given > "Rank by Overdue amount", and the Employee page "Overdue %".

## If something looks wrong on the live server (quick guide)

| What you see | Most likely cause | What to do |
|---|---|---|
| Page opens, everything as before, but no "Loans at Risk", no overdue tiles, Overdue greyed in Custom Excel | The overdue query failed or is switched off. `server.log` has `Overdue figures not available (...)` | Nothing breaks. Send me that log line. To switch overdue off on purpose add `-Dceo.dash.overdue=false` to JBoss and restart. |
| `Overdue figures look wrong for district ...` | The safety check refused the numbers | Same as above; send the line. |
| Right after the deploy the page shows the **old** dashboard without overdue for about 20 to 30 minutes | Normal: the previous release's saved data is shown while the new data (with overdue) builds | Wait for `Snapshot PUBLISHED` in the log, then reload. |
| "Dashboard data is being prepared" for a long time | The build is failing (a query error). Look for `ERROR` after `Loading CEO dashboard snapshot` | Send me the error. The old EAR can be put back (see Rollback). |
| Green Custom Excel button missing or panel will not open | A script error; the rest of the page still works | Press F12 > Console, send me the red message. |
| Custom Excel says an error text under the buttons | The choices were refused (for example months outside the data) | The text says what to change. |
| Download starts but the Excel is empty / wrong | Send me the choices (the `About` sheet lists them) | - |
| A VO / SHG / woman list shows no overdue | `DAO getOverdueByUnit ...` failed (log line `Overdue for VO list not added`) | The list itself still works. Send me the line. |
| Browser shows the old look after the deploy | Cached script | Hard refresh (Ctrl+F5). The page asks for `app.js?v=20261008a`, a new name on every release. |

The dashboard never depends on overdue: every overdue part is optional and hides itself when its data is missing.

## Optional JBoss settings

| `-D` option | Meaning | Default |
|---|---|---|
| `ceo.dash.statusTable` | table the overdue figures are read from | `SN.SHG_MEMBER_LOAN_STATUS_NEW` |
| `ceo.dash.overdue` | `false` = do not read overdue at all (the rest of the dashboard is unchanged) | `true` |

## How overdue is defined (so the figures can be explained)

Per open loan, from the daily status table: **arrears = `LOAN_DUE`** (the amount behind before this month's instalment),
**outstanding = `OUTSTANDING`**, **EMI = `LOAN_EMI`**. We checked on real loans that
`amount payable = EMI + arrears - advance` and that arrears match the loans' real repayment history. Loans are counted
only if the loan table also says OPEN (loans shown closed in one table and open in the other are left out). Bands compare
the arrears with the EMI: up to 1 EMI, 1 to 3 EMIs, over 3 EMIs (or no EMI left: loans past their term).
Overdue is *today's* picture (as on the last 12-hourly build), not tied to the months or financial year chosen.

## Rollback

Keep the previous EAR. To go back, replace the EAR with it. If the new snapshot file misbehaves, delete
`sthreenidhi-ceo-snapshot.ser.gz` from the JBoss `data` folder and restart (it rebuilds).

## Not done yet (ideas for next time)

- Overdue age in days (the table has the due date of the latest instalment only).
- Signed-link security (`-Dsthreenidhi.token.secret`), then share the signing method with the external site.
- A per-loan overdue line in the member profile.
