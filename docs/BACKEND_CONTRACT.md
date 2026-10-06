# Backend contract (what the page needs from any server)

The screens (`app.js`, `app.css`) do not care whether the server is Java (JBoss) or .NET (IIS). They need **one HTML page**
that writes some variables, and **a handful of URLs that return JSON**. Everything below is what the Java side does today.
The mock server (`devtools/mock/server.js`) implements the same contract with fake data, so it is also a runnable example.

## 1. The host page (today `CeoLoanIntelligence.jsp`; would be an `.aspx` or a plain `.html` + script block)

```html
<link rel="stylesheet" href="<ctx>/CeoLoanIntelligence?action=asset&name=app.css&v=<version>">
<script>
  window.__CEO_LIVE = true;                 // always true on a real server
  window.__CEO_CTX = '<ctx>';               // the web application path, e.g. /sthreenidhi ('' if at the root)
  window.__CEO_INITIAL_CHAPTER = 'pulse';   // pulse | loan-journey | repayment-journey | performance-map | calendar
  window.__CEO_SNAPSHOT_MESSAGE = '';       // text shown when the data is not ready
  window.__CEO_RAND_ID = '';                // unused, keep empty
  window.__CEO_TOKEN = '';                  // API token (empty when links are not signed); the page adds it as &t= to every call
  window.__CEO_BOOT_DATA = { ... };         // section 2
</script>
<div id="cd-app-root"></div>
<script src="<ctx>/CeoLoanIntelligence?action=asset&name=app.js&v=<version>"></script>
```
`<version>` is any string that changes when app.js / app.css change (the build script writes it into the page shell).
The two assets are plain static files; any server can serve them (gzip and a long cache time recommended).

## 2. `__CEO_BOOT_DATA` (the "snapshot": everything for the first screen, about 0.5 MB)

`{ ready: false }` = not built yet (the page shows "being prepared"). Otherwise:

| Key | Content |
|---|---|
| `fyLabel`, `fyStart`, `fyEnd` | `"2026-27"`, `"2026-04-01"`, `"2027-04-01"` (end exclusive) |
| `builtAtMillis` | when the snapshot was built (epoch ms) |
| `fyList` | financial years offered, e.g. `["2026-27","2025-26"]` |
| `targetUnit` | `"crore"` (targets are in crore rupees; every other money value is in rupees) |
| `totals` | state totals: `activeMembers, membersWithLoans, membersLoanSide, membersRepaySide, loanCount, openLoans, closedLoans, repayTxns, disbursed, repaid, repaidClosed, repaidUnprocessed, repaidAdjustment, targetAmount` and the overdue block below, `overdueReady` (1 = overdue figures are valid) |
| `districts[]` | one per district: `id, name, slug` (slug = map key, e.g. `krishna`) + the same fields as `totals` + overdue block |
| `months[]` | 24 months `"yyyy-MM"`, oldest first |
| `monthly[]` | `{districtId, month, loanCount, disbursed, repayTxns, repaid}` per district and month |
| `daily{}` | `{"<districtId>": [["yyyy-MM-dd", loans, disbursed, repayTxns, repaid], ...]}` for the current FY |
| `projects[]` | `{districtId, projectType, projectName, loanCount, disbursed, openLoans, members}` |
| `purposes[]` | `{districtId ("ALL" = state), purpose, loanCount, disbursed, members}` |
| `mandals[]` | `{districtId, mandalId, name, loanCount, disbursed, openLoans, closedLoans, membersLoanSide, repayTxns, repaid, targetAmount (crore), officerUserId, officerName, officerRole, agmUserId, agmName, dgmUserId, dgmName}` + overdue block |
| `employees[]` | `{userId, empCode, officerName, officerRole, agmUserId, agmName, dgmUserId, dgmName, districtIds, mandalCount, loanCount, disbursed, repayTxns, repaid, targetAmount}` + overdue block |

**Overdue block** (all optional; absent/`overdueReady: 0` = the page simply hides overdue):
`statusLoans, overdueLoans, overdueAmount, outstanding, overdueOutstanding, od1Loans, od1Amount, od2Loans, od2Amount, od3Loans, od3Amount`.
Money is plain numbers (rupees, no formatting); counts are integers; ids are strings; unknown values are `null`.

## 3. URLs (all `GET <ctx>/CeoLoanIntelligence?action=...&t=<token>` unless noted)

| action | parameters | answer |
|---|---|---|
| `asset` | `name=app.js|app.css`, `v` | the static file (public) |
| `status` | - | text `ready=true|false`, `loading=true|false` (public) |
| `drill` | `group` (DISTRICT, MANDAL, VO, SHG, MEMBER, PROJECT, CATEGORY, PURPOSE), `districtId, mandalId, voId, shgId` (the scope), `from`, `to` (yyyy-MM-dd, end exclusive), optional `project` | `{source, payModes, rows:[ {id, name, districtId, activeMembers, loanCount, disbursed, openLoans, closedLoans, borrowers, repayTxns, repaid, payers, openAmount, posAmount, upiAmount, autoAmount, posTxns, upiTxns, autoTxns, targetCr, parentId?, od?:{open, loans, amount, outstanding, atRisk}} ]}` |
| `member` | `memberId` | `{member:{id,name,shgId,surname,fatherHusband,birthYear,marital,category,education,wellbeing,village,registered,disabled,mobileLast4}, loans:[{id,shgLoanAccNo,projectType,projectName,purpose,amount,status,issuedDate,repaid,repayTxns,lastRepaymentDate, arrears?,emi?,balance?,dueDate?, repayments:[{id,date,amount,status,processed,adjustType,creditedDate,mode}]}]}` |
| `shg` | `shgId` | `{shg:{id,name,voName,registered,members,category,village,wellbeing,grade,bank,branch,disabled,minority,mobileLast4}}` |
| `trend` | `districtId` or `mandals` (`did|mid,...`) | `{payModes, months:[{month,loanCount,disbursed,repayTxns,repaid,posAmount,upiAmount,autoAmount}]}` |
| `keyedBy` | `from`, `to` | `{rows:[{login,txns,amount,first,last}]}` (cash entered per staff login) |
| `export` | `kind=drill|employee`, the drill parameters, `title`, `label` | an `.xls` file (`Content-Disposition: attachment`) |
| `customPreview` (POST form) | `group, fromMonth, toMonth, districts, mandals, project, cols, sort, dir, top, trend, title` | `{status:"ok", count, head[], rows[][], total[], notes[]}` |
| `custom` (POST form) | same | an `.xls` file |
| `refresh` | admin link only | starts a rebuild |

Errors: `400` bad input, `503` not ready / busy, `500` other, each with `{"status":"error","message":"..."}`.
Security today: the page needs a signed link (`exp`, `sig`), data calls need the token the page was given (`t`). A .NET server
may use its own scheme as long as the page's `__CEO_TOKEN` is accepted as `t`.

## 4. Could this front end run on ASP.NET (ASPX) with a .NET backend? Which is better?

**Yes, it is possible**, because the front end only needs the contract above:

- `app.js`, `app.css` are static: copy them unchanged.
- The `.jsp` becomes an `.aspx` (or a static `.html` with a script block) that writes the same variables. About 40 lines.
- The URLs become `.ashx` handlers / Web API actions returning the same JSON.
- The data work behind them must be **re-written in C#**: the background build of the snapshot (a hosted service or timer plus
  a memory cache), the in-memory cubes, the SQL queries (they are plain T-SQL and can be reused as they are), the number checks
  (validator), the Excel files (`.xls` through NPOI; `.xlsx` through ClosedXML/EPPlus), the signed links.

**Which is better?** Not a simple yes/no - it depends on who runs the platform:

| | Keep Java 6 / JBoss 5 (today) | Move the back end to .NET |
|---|---|---|
| Effort | none; it works and its numbers are checked | several weeks to rebuild and re-verify every figure |
| Risk to the numbers | low | real: each total must be re-proved against the Java results |
| Platform health | Java 6 and JBoss 5 have been out of support for years (no security patches) | modern, supported (ASP.NET Core / .NET 8) if hosted on a supported server |
| Fit with the other sites | the external site is on a different stack either way (it only links to the page) | better if the department is standardising on .NET / IIS |
| Speed | fast: everything is answered from memory | equally fast if built the same way |

**Recommendation:** keep the Java back end for now (it is done and verified) and keep the front end independent, which it already
is. Move to .NET only when there is a platform reason (JBoss/Java 6 retirement, a .NET team to own it). If you do, do it in this
order so nothing breaks: (1) build the .NET service to return the same JSON for the same data, (2) run the Java and .NET
versions side by side and compare every endpoint's output automatically, (3) switch the host page, (4) retire the Java one.
This document plus the mock server are the specification for step 1.
