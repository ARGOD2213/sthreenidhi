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
   - Excel downloads (district, mandal lists and employee sheets) carry overdue columns.
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

## Optional JBoss settings

| `-D` option | Meaning | Default |
|---|---|---|
| `ceo.dash.statusTable` | table the overdue figures are read from | `SN.SHG_MEMBER_LOAN_STATUS_NEW` |

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

- Overdue for VOs, SHGs and members (needs an index check on the status table first - see `docs/RECHECK_QUERIES_NEXT.sql`).
- Overdue age in days (the table has the due date of the latest instalment only).
- Signed-link security (`-Dsthreenidhi.token.secret`), then share the signing method with the external site.
- A per-loan overdue line in the member profile.
