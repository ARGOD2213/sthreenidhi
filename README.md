# CEO Loan Intelligence Dashboard

Designed and architected by **CHINTALA MAHINDRA**

Live link (no login needed):
`https://serp.ap.gov.in/AWFPREPORTS/CeoLoanIntelligence?action=page`

Other files in this folder:
- `CEO_Dashboard_SQL_Reference.sql` - every SQL query the dashboard uses. Each one can be run in QueryTool.
- `CEO_Loan_Intelligence_Technical_Overview.pdf` - diagrams and design.
- `Data_Clarifications.md` - questions about the data that the data team / DBA must answer.

---

## 1. What is this dashboard?

It is a web page for the CEO. It shows Stree Nidhi loans and repayments for the whole state, and lets the user go down level by level:

**State -> District -> Mandal -> VO -> SHG -> Woman**

It has five sections (we call them chapters):

| Chapter | What it shows |
|---|---|
| Overview | State totals, map of districts, best and weakest districts / mandals, online payment share |
| Loans Given | How many loans and how much money was given, by district, mandal, VO, SHG, project, purpose |
| Repayments | How much money was collected, and how it was paid (UPI, POS, auto-debit or cash) |
| Employee | Performance of each DGM, AGM and Manager, zone map, profile page for each person, "Who keys the cash" |
| Calendar | Month view (month-to-date totals against the same days of the last month, district map, top districts, today's attention). The date in the page header opens the month calendar; a chosen day opens the day view (totals, map, top districts, and Zones / Districts / Mandals / Top & Bottom). The day is part of the link (`#/calendar/day/2026-10-05`), so Back returns to the month |

Every page has an **Excel download** button.

Only **Stree Nidhi (SN)** loans are counted. Other schemes such as Unnathi (OSN) are left out.

---

## 2. How does it work? (step by step)

1. **When JBoss starts**, the dashboard starts a background job.
2. The job runs **15 big queries** on the SNBSAP database. These queries add up all loans and repayments by district, mandal, month and day.
3. The job then **checks the totals** (for example: the sum of all days must equal the total for the year). If the totals do not agree, the new data is **thrown away** and the old data stays on the page.
4. If the check passes, the data is kept **in the server's memory**. We call this the **snapshot**.
5. A copy of the snapshot is also **saved to a file** on the server: `ceo-dash-snapshot.ser.gz`. After a restart, the server reads this file in a few seconds instead of running all the queries again.
6. When someone opens the page, the data comes **from memory**. That is why Overview, district and mandal pages open instantly, and they do not touch the database.
7. Only when the user clicks **below mandal level** (VO, SHG, woman), the dashboard runs **one small query** for that one VO / SHG / woman. The answer is kept in memory until the next refresh, so the second click is instant.
8. To protect the database, **at most 4** of these small queries can run at the same time. If more people click at once, they see "Please try again in a minute".

**Important:** a failed refresh never breaks the page. The page keeps showing the last good data.

---

## 3. When does the data refresh?

The background job runs **every 12 hours**.

**Recommended setting: fixed times 8:00 AM and 8:00 PM.** Add this JBoss option:

```
-Dceo.dash.refresh.hour=8
```

Where to add it (JBoss 5):
- Windows: in `bin\run.conf.bat` add
  `set "JAVA_OPTS=%JAVA_OPTS% -Dceo.dash.refresh.hour=8"` (JBoss restart needed)
- Linux: in `bin/run.conf` add
  `JAVA_OPTS="$JAVA_OPTS -Dceo.dash.refresh.hour=8"` (JBoss restart needed)
- Or, without restarting JBoss: add the line `ceo.dash.refresh.hour=8` in `server/<profile>/deploy/properties-service.xml`, then redeploy the application.

Good to know:
- The refresh **starts** at 8:00. Today it takes about **20 minutes**, so the new data appears around 8:20. Until then the page shows the previous data.
- If the setting is **not** given, the refresh runs 12 hours after the last successful refresh, so the time moves after every restart.
- If the server starts and the saved data is **older than 12 hours** (or missing), it refreshes **immediately once**, and then follows 8:00 / 8:00.
- "8" means 8 o'clock on the **server clock**. Check that the server is on Indian time (see the log line in section 7.1).
- Someone can also force a refresh with `...?action=refresh`. This is allowed at most once every 15 minutes.

---

## 4. Files and where they go

| File | Copy to | What it does |
|---|---|---|
| `src/com/tcs/shg/accounting/DAO/CeoLoanIntelligenceDAO.java` | same package | list of all database queries |
| `src/com/tcs/shg/accounting/DAO/CeoLoanIntelligenceDAOImpl.java` | same package | the SQL itself (uses data source `SNBSAP_DS`) |
| `src/com/tcs/shg/accounting/reqhandler/CeoLoanIntelligenceServlet.java` | same package | the public link; answers the page's requests |
| `src/com/tcs/shg/accounting/reqhandler/CeoLoanIntelligenceRH.java` | same package | the same page through FrontServlet |
| `src/com/tcs/shg/ceo/bean/CeoDashboardSnapshot.java` | same package | the snapshot (all data in memory) |
| `src/com/tcs/shg/ceo/bean/CeoDashboardSnapshotValidator.java` | same package | checks the totals before the data is used |
| `src/com/tcs/shg/ceo/bean/CeoDashCube.java` | same package | fast in-memory totals by month / day |
| `src/com/tcs/shg/ceo/cache/CeoDashboardSnapshotBuilder.java` | same package | runs the 15 queries and builds the snapshot |
| `src/com/tcs/shg/ceo/cache/CeoDashCache.java` | same package | holds the current snapshot |
| `src/com/tcs/shg/ceo/cache/CeoDashCacheLoader.java` | same package | the 12-hour timer, save to file, read from file |
| `src/com/tcs/shg/ceo/listener/CeoDashStartupListener.java` | same package | starts and stops the job with the application |
| `src/com/tcs/shg/ceo/service/CeoDashboardService.java` | same package | answers clicks (VO, SHG, woman, trends) |
| `src/com/tcs/shg/ceo/service/CeoDashExport.java` | same package | Excel downloads (Apache POI HSSF, already on the server for QueryTool) |
| `src/com/tcs/shg/ceo/util/CeoLog.java`, `CeoFiscalYear.java` | same package | log lines, financial-year dates |
| `src/com/tcs/shg/ceo/util/CeoGzip.java` | same package | sends the page, the JSON answers, `app.js` and `app.css` compressed (about 1.3 MB down to about 0.3 MB on a fresh open) |
| `WebContent/accounting/CeoLoanIntelligence.jsp` | `accounting/` | the page itself |
| `WebContent/ceo-loan-intelligence/app.js` | `/scripts/app.js` | page screens (plain JavaScript, works in IE11) |
| `WebContent/ceo-loan-intelligence/app.css` | `/css/app.css` | page design |
| `config/*.xml` | already in office `web.xml` and `AWFP_ConfigDetails.xml` | for reference only |

**Rule:** always copy **all 16 Java files together**, plus the JSP, `app.js` and `app.css`. The Java files depend on each other; copying only some of them can break the build or the saved file.

---

## 5. How to deploy

1. Copy all files from section 4.
2. Clean build and redeploy (same as any other change).
3. **Do not delete** `ceo-dash-snapshot.ser.gz` for this release. The data format did not change, so the server reads it in seconds. (Delete it only when a release note says "snapshot format changed". Even if you forget, the server notices the old format, ignores the file and rebuilds by itself.)
4. Set the refresh time if not done yet (section 3).
5. Open the link and press **Ctrl + F5** once, so the browser takes the new `app.js` and `app.css`.
   (The JSP adds `?v=<ASSET_VERSION>` to these files. When `app.js` or `app.css` changes, the `ASSET_VERSION` in the JSP must be changed too. Current value: `20261005h`.)
   `app.js` and `app.css` are still copied to `/scripts` and `/css`: the page reads them through the dashboard link (`?action=asset`, compressed) and falls back to those plain files if that ever fails.
6. Check that it is working (section 6) and read the log (section 7).

**To go back to the old version:** put back the old Java classes, JSP, app.js and app.css and redeploy. Nothing in the database needs to be undone, because the dashboard only reads.

---

## 6. How to check that it is working

Open:
`https://serp.ap.gov.in/AWFPREPORTS/CeoLoanIntelligence?action=status`

You will see:

```
ready=true
loading=false
lastAttemptMillis=1791028142266
lastSuccessMillis=1791028142266
lastError=
```

| Line | Good value | Meaning |
|---|---|---|
| `ready` | `true` | data is available. `false` = still loading the first time |
| `loading` | `false` | `true` = a refresh is running right now (normal for about 20 minutes, twice a day) |
| `lastAttemptMillis` | a number | when the last refresh started (milliseconds since 1970) |
| `lastSuccessMillis` | same as above | when the last **good** refresh finished. If this is much older than `lastAttemptMillis`, the last refresh failed |
| `lastError` | empty | the reason of the last failure, if any |

To change the number into a date: in the browser press F12 -> Console, type `new Date(1791028142266)` and press Enter.

---

## 7. Reading the log (and what each exception means)

Every dashboard line in `server.log` starts with **`[CEO-DASH]`**. To take only these lines:

- Linux: `grep "CEO-DASH" server.log > ceo.log`
- Windows: `findstr "CEO-DASH" server.log > ceo.log`

Each line has a level: **INFO** (normal), **WARN** (the page still works, but something in the data needs attention), **ERROR** (something failed).

### 7.1 Normal lines at start-up and at each refresh (in this order)

| Line | What it means |
|---|---|
| `CeoDashStartupListener: initializing` | the application has started. Must appear once after every deploy. **If missing:** the listener is not in `web.xml`. |
| `Snapshot RESTORED from <file> in N ms, built M min ago` | the saved file was read. The page is ready in seconds. Best case after a restart. |
| `No saved snapshot at <file>; building from SNBSAP` | no saved file. Normal on the very first deploy. **If it appears after every restart:** the folder is not kept or not writable; ask the server team. |
| `Saved snapshot is for FY ..., current FY is ...; ignored` | a new financial year started (1 April). Normal once a year. |
| `Loading CEO dashboard snapshot fy=2026-27` | a refresh has started. |
| `Snapshot build start fy=... period=[...]` | the queries are starting. |
| `DAO <name> rows=R ms=T` | one query finished: R rows, T milliseconds. There are 15 such lines per refresh. Note the `ms=` values. |
| `Snapshot build done in N ms: ...` | all queries finished. N = total refresh time. |
| `Snapshot validation PASSED ...` | the totals agree. |
| `Snapshot PUBLISHED fy=... builtAt=...` | the page now shows the new data. |
| `Snapshot saved to <file> (K KB, T ms)` | the copy on disk is written. |
| `Scheduling CEO dashboard refresh every 43200 seconds, next in M min` | the timer is set. Time of this line + M minutes = next refresh. With `refresh.hour=8` this must land on 8:00 or 20:00. If it is 5 hours 30 minutes off, the server clock is not on Indian time. |
| `CeoDashStartupListener: initial load + schedule complete` | start-up finished. |

### 7.2 Warnings (WARN) - the page still works

| Line | What it means | What to do |
|---|---|---|
| `DAO <name> duplicate key <key>` | a master or mapping table has the same row twice | collect the list and give it to the data team |
| `Mandal <id> mapped to more than one officer; keeping the first` | in `DIST_DGM_AGM_MANG_MAPPING` one mandal has two managers | correct the mapping row |
| `District <id> has no map slug` | a district name does not match the map, so it shows grey on the map | send the district name; a name alias is added in code |
| `Mandal targets X != district targets Y` | target rows do not match mandals | check the target table for that year |
| `Load already in progress; skipping` | a refresh was asked while one was already running | nothing, harmless |
| `Application was undeployed during the build; result discarded` | someone redeployed during a refresh | nothing, harmless |
| `Snapshot not saved to <file>` / `Could not rename ...` / `Could not replace ...` | the copy on disk could not be written | the page works, but after a restart it will take ~20 minutes. Ask the server team for write rights on the folder |
| `Saved snapshot <file> could not be read (...)` | the file is damaged or from a very old version | nothing, the server rebuilds by itself |
| `Saved snapshot failed validation (...)` | the saved file did not pass the checks | nothing, the server rebuilds by itself; send the line if it repeats |

### 7.3 Errors (ERROR) - something failed

| Line | What it means | What to do |
|---|---|---|
| `DAO <name> failed after T ms` followed by a Java stack trace | one refresh query failed: database timeout (limit 30 minutes per query), no permission, or SQL error | the refresh stops and the **old data stays on the page**. Send the full stack trace. If T is close to 1800000, the query hit the 30-minute limit |
| `Snapshot refresh failed: validation failed: <reason>` | the totals did not agree, so the new data was refused | old data stays. Send the reason (it says which total did not match) |
| `Snapshot load failed` + stack trace | an unexpected error in the refresh | old data stays. Send the stack trace |
| `drill ... failed`, `member ... failed`, `shg ... failed`, `trend failed`, `keyedBy failed` | one click on the page failed; the user sees a "Retry" button | send the line and the time. Usually a slow database at that moment |
| `export failed` | an Excel download failed | send the line; the page itself keeps working |
| `CEO dashboard page failed` | the page could not open through FrontServlet | send the stack trace |
| `CeoDashStartupListener failure` | the background job could not start | send the stack trace; the page will say "data is being prepared" |

**Common Java exceptions you may see inside these stack traces:**

| Exception text | Usual cause |
|---|---|
| `SQLException: The query has timed out` / `Query timeout` | the database was too slow (busy, or blocking). Old data stays. Usually fine at the next refresh. |
| `NamingException ... SNBSAP_DS` | the data source name is not found in JBoss. Check the `-ds.xml` file. |
| `SQLException: ... permission was denied` | the database login has no rights on a table. Ask the DBA. |
| `OutOfMemoryError` | JBoss memory too low. Ask the server team to check `-Xmx`. |
| `InvalidClassException` / `ClassCastException` while reading the saved file | Java files from two different versions were copied. Copy all 16 files together and redeploy. |

### 7.4 Problems you may see on the page

| What you see | Likely reason | What to do |
|---|---|---|
| "Dashboard data is being prepared" for a long time | first refresh still running, or it failed | open `?action=status`; read section 7.3 |
| Old design or blank page after deploy | browser kept the old `app.js` | press Ctrl + F5; check `ASSET_VERSION` was changed in the JSP |
| "Please try again in a minute" on a click | 4 detail queries already running | normal at busy times; try again |
| Online share 0 everywhere | payment modes switched off (`ceo.dash.paymodes=false`) | check JBoss options |
| A district is grey on the map | no data that day, or the district name does not match the map | see `has no map slug` in the log |
| Totals differ from another report | different rules (SN only, active women only, dates) | see section 8 and `Data_Clarifications.md` |

---

## 8. How the numbers are counted

- **Loan counted** when: the member code has at least 20 characters, the issue date is after 1 January 2000, the status is OPEN or CLOSED, and the project is a Stree Nidhi project (`PROJECT_TYPE_LOAN_MAPPING.LOAN_TYPE = 'SN'`).
- **Woman counted** when: she is active (`IS_MEM_ACTIVE = 'Y'`), her SHG and VO are active, and her mandal is active and rural (not MEPMA). A woman is counted once, even if her id appears twice.
- **Repayment counted** (same rule as the finance team's daily figure) when: it is on a valid Stree Nidhi loan, its bank credit has arrived (`BANKS_CREDIT_INFO.CREDITED_DATE`), and its VO credit is closed (`VO_CREDIT_INFO.VO_REPAY_STATUS = 'CLOSED'`). Both tables are matched on the bank reference number after being reduced to one row per reference, so a repeated reference never counts a repayment twice. A repayment that is entered but not yet credited / closed is not counted until it is. The woman's own payment list (member popup) still shows every payment she made.
- **Dates:** a loan belongs to its **issue date**; a repayment belongs to its **bank credit date**. A period "1 April to 1 July" means 1 April up to 30 June.
- **Check:** `CEO_Repayment_Check.sql` puts the finance team's figure for a day next to the dashboard's, and lists where any difference comes from.
- **Payment mode** (from `VO_CREDIT_INFO.CREATED_BY` of the closed VO credit, linked by bank reference number):
  - `PAYTM PAYMENT SERVICE` = POS
  - `Phi PAYMENT SERVICE` = UPI
  - `SHG AUTO DEBIT PROCESS` = Auto-debit
  - anything else = Cash / manual
  - Online = POS + UPI + Auto-debit
- **Bands** (Employee and Repayments pages) compare each person's cash share with the state's cash share: up to 0.75 times = Strong, up to 1.05 = Good, up to 1.5 = Attention, above = Concern.
- **Targets** come from `LIVELIHOOD_MANDALWISE_TARGET_FY18` for the year, read as crore.
- **Privacy:** mobile numbers show only the last 4 digits. Aadhaar, ration card and bank account numbers are never read.

---

## 9. Is what we use now correct?

**Checked and confirmed on SNBSAP:**
- The payment-mode link never counts a repayment twice (one mode per bank reference). Totals with and without it are the same.
- UPI starts in May 2025, so April 2025 correctly shows no UPI.
- Stree Nidhi only: for April-September 2026, SN repayments Rs 2,692.8 crore are counted and Unnathi (OSN) Rs 115.6 crore are left out.
- The "Phi PAYMENT Unnathi" channel belongs only to OSN loans, so it is correctly left out.
- Every loan's project exists in the project mapping table.
- 99.9% of repayments are entered within one day, so day-wise figures are reliable.
- Every refresh checks its own totals before the page uses them.

**Not yet confirmed (we follow a rule, but the data team must say if it is right).** Full list with QueryTool checks in `Data_Clarifications.md`. The most important:
- Loans of women / SHGs / VOs that later became **inactive** are not counted at all.
- A loan is shown in the mandal of the SHG's **current** VO, not the mandal written on the loan.
- Loan statuses other than OPEN / CLOSED are not counted.
- Repayment rows are counted whatever their status, processed flag or adjustment type.
- Target unit (crore?) and target table.
- The officer mapping has no history, so past results are shown under today's officer.
- "BY Service" in `VO_CREDIT_INFO`: the real staff login is in `SHG_CREDIT_INFO.CREATED_BY`.

**Known limits:**
- The public link has **no login**. Names of women and their loans are visible to anyone who has the link. Simplest fix: allow only office IP addresses at the web server.
- There is no "amount due / overdue / outstanding" yet, because we have not found the EMI schedule table.
- A refresh takes about 20 minutes and reads the big tables many times. A faster method is planned (see section 11).

---

## 10. Settings (JBoss `-D` options)

All are optional. Without them the default is used.

| Option | Default | What it does |
|---|---|---|
| `ceo.dash.refresh.hour` | not set | 0-23. Refresh at this hour and 12 hours later. **Use `8` for 8 AM and 8 PM.** |
| `ceo.dash.refresh.seconds` | 43200 (12 hours) | time between refreshes. 86400 = once a day |
| `ceo.dash.refresh.min.seconds` | 900 (15 min) | minimum gap between two manual `?action=refresh` calls |
| `ceo.dash.sql.timeout.seconds` | 1800 (30 min) | longest time one refresh query may run |
| `ceo.dash.gzip` | true | `false` sends everything uncompressed (only needed if a proxy between the server and the users cannot handle compressed answers) |
| `ceo.dash.drill.max.concurrent` | 4 | how many click queries may run at the same time |
| `ceo.dash.paymodes` | true | `false` = do not read payment modes (if the database is very slow) |
| `ceo.dash.snOnly` | true | `false` = count all schemes, not only Stree Nidhi |
| `ceo.dash.snapshot.file` | JBoss data folder | where the saved file is kept |
| `ceo.dash.fy` | current year | force a year, for example `2026-27` |

Fixed in code: a click query may run at most 2 minutes, waits at most 20 seconds for a free slot; totals may differ by at most 0.5% in the check.

Other links on the same address (`...?action=`): `status`, `refresh`, `drill`, `member`, `shg`, `getBorrowers`, `trend`, `keyedBy`, `export`. The page uses these itself; only `status` and `refresh` are for people.

---

## 11. Next steps

1. Deploy, then send the `[CEO-DASH]` log lines from the first start and from one restart, plus the `?action=status` output.
2. Get answers for `Data_Clarifications.md`.
3. Faster refresh (planned, not built yet): read each big table **once** per refresh using temporary tables, instead of up to 11 times. Expected: about 20 minutes down to about 5. Needs DBA agreement for temporary-table use (about 1 GB of tempdb for a few minutes).
4. Optional, only if the DBA agrees after testing: add two columns to an existing index on `SHG_CREDIT_INFO` to make the refresh even faster.

**What to bring to the next session:** the log lines, the status output, screenshots of anything wrong (with the full link, including the part after `#`), and any browser errors (F12 -> Console) if a page is blank.

---

## 12. Change history

- **2026-10-05, Employee lower levels** (`ASSET_VERSION 20261005h`, `app.js`, `app.css`, JSP): AGM and manager pages no longer repeat the state map and zone table (state and DGM pages keep them); a manager's mandals are one ranked list (rank by online share, cash share, disbursement vs target or collected; click opens the mandal's collections); compact person cards and profile tiles on phones; page margins on desktop.
- **2026-10-05, Loans Given lower levels** (`ASSET_VERSION 20261005g`, `app.js`, `app.css`, JSP): district, mandal and VO pages list the level below (rank by amount given, number of loans, women or active loans; click to open), so every level opens the next without the filters. The VO / SHG chips show the name instead of the id when a page is opened by link. The SHG page drops the project / activity / social cards, which only repeated its women list.
- **2026-10-05, compact drill-down pages** (`ASSET_VERSION 20261005f`, `app.js`, `app.css`, JSP): Repayments district / mandal / VO pages show one ranked list of the level below (rank by collected, repayments, online % or cash %; tag = online share against the state) next to the payment channels, instead of three separate lists of the same places. Phones and narrow windows: two cards per row, compact project / activity / social tiles in Loans Given, shorter header, wide tables scroll sideways.
- **2026-10-05, Loans Given** (`ASSET_VERSION 20261005e`, `app.js` and JSP only): the "Top SHGs" block is removed from Loans Given (the SHG filter at the top already picks an SHG); Repayments keeps it. One less database query each time a mandal is opened in Loans Given.
- **2026-10-05, repayments as finance counts them** (`ASSET_VERSION 20261005d`; DAO, JSP, `app.js`, `app.css`): every repayment figure (Overview, Repayments, Calendar, Employee, drill-downs, Excel, "Who keys the cash") now counts a repayment when its bank credit has arrived and its VO credit is CLOSED, on the bank credit date - the same rule as the finance team's daily query (section 8). Manual entries that are not yet credited / closed no longer count, so collected and cash figures come down and the online share goes up. **After deploying, open `?action=refresh` once** so the saved data is rebuilt with the new rule (until then the old figures are shown). The refresh may take longer than before: it now also reads `BANKS_CREDIT_INFO` and the closed rows of `VO_CREDIT_INFO`. Calendar: the state map is now as large as the Overview map; district, mandal, VO and SHG day pages redesigned (day cards from the level below, ranking or table, responsible person, highlights).
- **2026-10-05, faster loading** (`ASSET_VERSION 20261005c`, new `CeoGzip.java`, servlet, JSP, `app.js`): the page, the JSON answers, `app.js` and `app.css` go out compressed (page 665 KB -> 127 KB, app.js 412 KB -> 108 KB, app.css 236 KB -> 36 KB); `app.js` / `app.css` are kept by the browser for 30 days per version. On a mandal page the top-100 SHG query now starts after the VO list has answered, so the database runs one large query at a time instead of two. No SQL, number or snapshot change.
- **2026-10-05, Calendar redesign** (`ASSET_VERSION 20261005b`, page files only: JSP, `app.js`, `app.css`): web fonts no longer hold up the first paint and the unused Noto Sans font is no longer requested. Calendar split into a month view and a day view as per the new design. Date chip in the page header opens the month calendar (heat by collections, day summary with online and cash share, "View this day" / "Month view"). Map colours in fixed bands with a legend and three modes (Collections, Repayments, Online %). Day view tabs: Zones (DGM -> AGM -> manager -> mandal), Districts, Mandals (searchable) and Top & Bottom. Opening a district keeps the chosen day; Back returns to the day, then to the month. No Java, SQL or snapshot change.
- **2026-10-04, 3rd release** (`ASSET_VERSION 20261004d`, page files only): checked at screen widths 1920, 1366 and 1100 and with Back / Forward; nothing wider than the screen, no popup left open. Pale text colours made darker for easier reading. Calendar redesigned: month heatmap is the date picker, zone (DGM) cards drill down to AGM -> Manager -> Mandal for the chosen day. Employee: "Who keys the cash" in a popup, colour-coded hierarchy view, even grid of person cards. Repayments page redesigned with a clickable path (breadcrumb) instead of filter boxes.
- **2026-10-04, 2nd release:** Excel download on every page; "Who keys the cash"; Total Loans tile; period filter (year / quarter / month) on Loans Given and Repayments; Employee headline counts; people reporting to more than one boss; top 100 SHGs of a mandal; SHG history; Calendar month totals; Employee zone map and profiles with 24-month trend. Fixed: page looked frozen after closing a popup.
- **2026-10-04, 1st release (live):** Stree Nidhi only; payment modes; safer logging; asset version in the JSP; optional refresh hour.
- **2026-10-03:** all chapters built on real data; saved file on disk for fast restarts.
