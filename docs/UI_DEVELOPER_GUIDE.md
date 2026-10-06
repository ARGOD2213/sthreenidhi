# UI developer guide (colours, spacing, look and feel)

You change **how the dashboard looks**. You do not touch the Java backend, and you do not need the database: a mock server
with fake data runs on your own computer.

## 1. Start in 3 minutes

1. Install **Node.js 12 or newer** (https://nodejs.org). Nothing else.
2. Double-click `devtools/mock/start-mock.bat` (Windows) or run `sh devtools/mock/start-mock.sh`.
   A browser tab opens on the scenario page. Click **normal**, then use the dashboard.
3. Edit a file in `ui-src/` and save. **The page reloads by itself** - there is no build step while you work.

All numbers you see are made up. The mock never reaches the real server.

## 2. Where things are

```
ui-src/
  css/     the existing style rules, cut into 28 numbered parts (the number = the order they apply in). Do not reorder.
  theme/   YOUR files: new styles per page. Joined AFTER css/, so a rule here wins over an old one.
  js/      the existing scripts, cut into 28 numbered parts (one per screen / feature). Visual-only edits.
  build.js / build.ps1   joins the parts into app.js and app.css (run once before handing over)
devtools/mock/   the fake-data server (never deployed)
tools/           release checks
WebContent/dashboards/ceo-loan-intelligence/   app.js, app.css (GENERATED - never edit them by hand), the page shell .jsp
```

**Do not touch:** `src/` (Java), `WebContent/WEB-INF/`, `ear/`, `lib-provided/`, `build.xml`.

## 3. Which file for which page

| Page | Page root class | Script part | Old CSS parts (css/) | Your file (theme/) |
|---|---|---|---|---|
| Header, menu | `.top-header`, `.cd-chapter-nav` | `14-chapter-nav.js` | `14-header-nav-brand` | `00-theme-global.css` |
| Overview | `.cd-overview-chapter` | `21-chapter-overview.js` | `13-overview-core`, `15-overview-panels-cards-leaders`, `26-late-overrides-risk-frame` (risk section) | `10-theme-overview.css` |
| Loans Given | `.cd-chapter--loan-journey` | `22-chapter-loans.js`, `20-explorer.js` | `01`, `11`, `16`, `21` | `20-theme-loans.css` |
| Repayment & Payments | `.cd-chapter--repayment-journey` | `23-chapter-repayments.js` | `03`, `05`, `10`, `23`, `25` | `30-theme-repayments.css` |
| Employee Performance | `.cd-chapter--performance-map` | `24-chapter-employees.js` | `08`, `17`, `20`, `22`, `24` | `40-theme-employees.css` |
| Calendar | `.cd-chapter--calendar` | `25-chapter-calendar.js` | `07`, `18` | `50-theme-calendar.css` |
| Custom Excel button + panel | `.cd-cx-panel`, `.cd-cx-fab` | `26-custom-excel.js` | `27-custom-excel-and-women-cards` | `60-theme-custom-excel.css` |
| Popups (woman's record, list of cash) | `.cd-modal`, `.cd-member-*` | `19-modal.js` | `19-modal-toast-member-transitions`, `12-member-drawer-breadcrumb-pills` | `00-theme-global.css` |

Find the class of anything on screen with the browser's **Inspect** (F12), then search the project for it.

## 4. How to restyle a section (the safe way)

1. Open the page in the mock, right-click the section > Inspect, note its class names.
2. In the page's file under `ui-src/theme/`, write the new rule **starting with the page root class**, e.g.

   ```css
   .cd-overview-chapter .stat-card { background: #f0fdf4; border-radius: 18px; }
   ```
3. Save. The mock reloads. If your rule does not win, make it a little more specific (add a parent class) - do not use
   `!important` unless you must, and do not edit the old parts.
4. Use the **scenarios** (`/sthreenidhi/mock`) to see each state: `normal`, `nooverdue`, `overduefailed`, `empty`,
   `notready` (the "being prepared" screen), `slow` (loading states), `servererror` (error states).

### Where the colours are
See `docs/UI_COLOR_INVENTORY.md`. In short: the **main palette** is in `ui-src/js/09-theme.js` (`THEMES.executive.colors`,
and it writes a style tag *after* app.css, so it can win over your CSS - the inventory lists those selectors); most colours are
in `css/`; a few (chart colours, rank bars, payment-mode colours) are written by the scripts. Changing a colour string inside a
`.js` part is allowed. Changing logic is not.

## 5. Hard rules (the dashboard must keep working exactly the same)

- **Do not rename or remove a class or an `id`** - the scripts look elements up by them. Add new classes freely.
- **Do not change the markup** the scripts create unless you are told to. Pure styling goes in `theme/`.
- **ES5 only in `.js` parts** (the office uses Internet Explorer 11 and an old Java server): no `let`, `const`, `=>`,
  template strings (backticks), `Array.includes`, `Object.assign`. CSS: avoid `inset`, CSS variables in new rules for IE11
  pages, `gap` on flex. Test in the mock with the browser's responsive mode: laptop (1440), tablet (1024), phone (390).
- Do not add libraries, fonts from other sites, or images from other sites. Local images go in `WebContent/Assets/Images/`
  (ask first).
- Keep text and numbers as they are. This is a CEO dashboard: no layout shift when numbers change length.
- Never put real names, ids or phone numbers into a mock or a screenshot.

## 6. Hand-over checklist

1. `node ui-src/build.js` (or `powershell -File ui-src\build.ps1` if Node is not installed) - it rewrites `app.js`, `app.css`
   and the version number in the `.jsp` so browsers fetch the new look.
2. `node tools/check-release.js` must say **"Release check passed"**.
3. Commit everything: `ui-src/`, and the three generated files.
4. Tell the backend owner. They copy **only** `app.css`, `app.js` and `CeoLoanIntelligence.jsp` into the office project and build
   the EAR with `tools/build-ear.ps1`. The mock and `ui-src` are never part of the EAR.

## 7. If something looks broken

| Problem | Do this |
|---|---|
| Blank page | F12 > Console. A red error names the file and line of `app.js` - find it in the part files (line numbers are of the joined file). |
| Style not applied | Your selector is weaker than an old one: add the page root class in front. Also check `docs/UI_COLOR_INVENTORY.md` for script-written rules. |
| Page does not reload | The mock reads `ui-src/`; a changed file outside it (for example the `.jsp`) needs a manual refresh. |
| `check-release` says STALE | Run the build (step 1) and commit the three generated files. |
