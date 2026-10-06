# Colour inventory (generated)

Where the colours of the dashboard are written, so a designer knows which file to open. Counts are how many times a hex colour appears.

**There are three places colours live:**

1. **`ui-src/js/09-theme.js`** - the main palette (`THEMES.executive.colors`: background, surface, border, primary, loan, repay, risk, text) and a small set of rules it writes into the page at start-up (the selectors are listed at the bottom). This is a *runtime style tag added after app.css*, so it wins over app.css rules of the same strength. Change the palette values here to recolour those parts everywhere.
2. **`ui-src/css/*.css`** - the older style rules (most colours). Put new colours in `ui-src/theme/*.css` instead of editing these (see the guide).
3. **`ui-src/js/*.js`** - a few colours are written inline by the scripts (charts, rank bars, payment-mode colours, status badges). They are listed below by file; changing them is a *visual-only* edit of a colour string.

## Whole project

Distinct colours in the CSS parts: 169 (used 1307 times). In the JS parts: 94 (used 274 times).

Most used colours overall: `#ffffff` x139, `#64748b` x117, `#0f172a` x106, `#e2e8f0` x98, `#fff` x91, `#15803d` x62, `#f1f5f9` x42, `#2563eb` x42, `#1d4ed8` x40, `#475569` x38, `#cbd5e1` x35, `#b45309` x34, `#f8fafc` x31, `#7c3aed` x25

## CSS parts (in cascade order)

| Part | colour uses | distinct | most used |
|---|---|---|---|
| `css/00-base-and-app-shell.css` | 10 | 9 | `#f6a400`, `#4fb8c4`, `#1b3a2f`, `#fff9ec`, `#14251d`, `#f0f7ee` |
| `css/01-loans-composition.css` | 0 | 0 |  |
| `css/02-hierarchy-waterfall-trend.css` | 0 | 0 |  |
| `css/03-repayments-command-and-kpis.css` | 7 | 6 | `#14251d`, `#f6a400`, `#31b85f`, `#f0f7ee`, `#f6f9fc`, `#b6c2bb` |
| `css/04-tiles-risk-action-perf.css` | 0 | 0 |  |
| `css/05-repayments-payment-ecosystem.css` | 0 | 0 |  |
| `css/06-rankings-drawer-loading.css` | 4 | 4 | `#fff`, `#f6f9fc`, `#f0f3f1`, `#f8f8f2` |
| `css/07-calendar-header-base.css` | 8 | 4 | `#f6f9fc`, `#ff9800`, `#fff`, `#17251d` |
| `css/08-employees-rings-and-base.css` | 20 | 9 | `#fff`, `#f6f9fc`, `#17325c`, `#ffffff`, `#f6a400`, `#e08600` |
| `css/09-state-badge-perf-legend-filters.css` | 0 | 0 |  |
| `css/10-payments-behavior-command.css` | 4 | 4 | `#fff`, `#14251d`, `#f0f7ee`, `#168442` |
| `css/11-loans-command.css` | 27 | 13 | `#fff`, `#0ea5e9`, `#22c55e`, `#14251d`, `#ff9800`, `#ef4444` |
| `css/12-member-drawer-breadcrumb-pills.css` | 24 | 18 | `#31b85f`, `#244634`, `#1c3124`, `#7c8b82`, `#0ea5e9`, `#14251d` |
| `css/13-overview-core.css` | 87 | 34 | `#1b3a2f`, `#4e5d52`, `#15803d`, `#fff`, `#ffffff`, `#ef4444` |
| `css/14-header-nav-brand.css` | 24 | 14 | `#ffffff`, `#e2e8f0`, `#0f172a`, `#9d482b`, `#64748b`, `#cbd5e1` |
| `css/15-overview-panels-cards-leaders.css` | 103 | 50 | `#ffffff`, `#0f172a`, `#15803d`, `#e2e8f0`, `#64748b`, `#475569` |
| `css/16-loans-page-and-card-groups.css` | 51 | 13 | `#ffffff`, `#64748b`, `#0f172a`, `#e2e8f0`, `#475569`, `#cbd5e1` |
| `css/17-employees-page.css` | 70 | 20 | `#fff`, `#e2e8f0`, `#64748b`, `#0f172a`, `#ffffff`, `#f8fafc` |
| `css/18-calendar-cards.css` | 42 | 14 | `#ffffff`, `#0f172a`, `#64748b`, `#f59e0b`, `#fff`, `#e2e8f0` |
| `css/19-modal-toast-member-transitions.css` | 144 | 41 | `#ffffff`, `#2563eb`, `#cbd5e1`, `#0f172a`, `#10b981`, `#e2e8f0` |
| `css/20-employees-msm-card.css` | 128 | 34 | `#ffffff`, `#2563eb`, `#3b82f6`, `#e2e8f0`, `#64748b`, `#059669` |
| `css/21-explorer-lists-and-loans-details.css` | 143 | 38 | `#64748b`, `#0f172a`, `#1d4ed8`, `#e2e8f0`, `#ffffff`, `#f1f5f9` |
| `css/22-employees-map-and-calendar-extras.css` | 92 | 23 | `#64748b`, `#0f172a`, `#e2e8f0`, `#fff`, `#f8fafc`, `#f1f5f9` |
| `css/23-repayments-crumbs-and-frame.css` | 35 | 20 | `#ffffff`, `#0f172a`, `#64748b`, `#1d4ed8`, `#cbd5e1`, `#fff` |
| `css/24-employees-hierarchy-view.css` | 82 | 23 | `#64748b`, `#fff`, `#0f172a`, `#f1f5f9`, `#e2e8f0`, `#b45309` |
| `css/25-repayments-cv-cards.css` | 87 | 21 | `#0f172a`, `#475569`, `#fff`, `#9a3412`, `#e2e8f0`, `#f1f5f9` |
| `css/26-late-overrides-risk-frame.css` | 28 | 20 | `#ffffff`, `#e2e8f0`, `#f1f5f9`, `#64748b`, `#334155`, `#eef2f6` |
| `css/27-custom-excel-and-women-cards.css` | 87 | 31 | `#ffffff`, `#15803d`, `#e2e8f0`, `#0f172a`, `#64748b`, `#f1f5f9` |

## JS parts that write colours inline

| Part | colour uses | distinct | most used |
|---|---|---|---|
| `js/05-svg-charts.js` | 1 | 1 | `#e2e5ea` |
| `js/09-theme.js` | 18 | 14 | `#ffffff`, `#b45309`, `#0f172a`, `#f8fafc`, `#f1f5f9`, `#e2e8f0` |
| `js/19-modal.js` | 1 | 1 | `#334155` |
| `js/20-explorer.js` | 17 | 7 | `#7c3aed`, `#1d4ed8`, `#15803d`, `#0284c7`, `#0d9488`, `#b45309` |
| `js/21-chapter-overview.js` | 50 | 41 | `#b91c1c`, `#90b8a0`, `#64748b`, `#f87171`, `#94a3b8`, `#15803d` |
| `js/22-chapter-loans.js` | 35 | 23 | `#15803d`, `#0284c7`, `#a16207`, `#0d9488`, `#c026d3`, `#9d482b` |
| `js/23-chapter-repayments.js` | 34 | 20 | `#2563eb`, `#b45309`, `#0284c7`, `#06b6d4`, `#0d9488`, `#7c3aed` |
| `js/24-chapter-employees.js` | 67 | 32 | `#b45309`, `#15803d`, `#e2e8f0`, `#2563eb`, `#dbeafe`, `#0d9488` |
| `js/25-chapter-calendar.js` | 42 | 29 | `#b45309`, `#9a3412`, `#0284c7`, `#2563eb`, `#7c3aed`, `#15803d` |
| `js/26-custom-excel.js` | 4 | 4 | `#15803d`, `#2563eb`, `#7c3aed`, `#dc2626` |
| `js/27-startup.js` | 5 | 5 | `#15803d`, `#ffffff`, `#a16207`, `#94a3b8`, `#475569` |

## Selectors that `09-theme.js` styles at run time

If a rule in `ui-src/theme/` seems to be ignored, check this list first: these selectors get a rule from the script after app.css has loaded. Make your selector more specific (start it with `body `), or change the palette value in `09-theme.js`.

- `.cd-attention-card`
- `.cd-attention-card strong`
- `.cd-border`
- `.cd-brand-mark`
- `.cd-breadcrumb .cd-breadcrumb__segment`
- `.cd-breadcrumb .cd-breadcrumb__segment--current`
- `.cd-breadcrumb .cd-breadcrumb__segment--current:hover`
- `.cd-breadcrumb .cd-breadcrumb__segment:hover`
- `.cd-breadcrumb__sep`
- `.cd-chapter-nav`
- `.cd-chapter-nav__item`
- `.cd-chapter-nav__item--active`
- `.cd-chapter-nav__item:hover`
- `.cd-cta`
- `.cd-cta:hover`
- `.cd-flow-node`
- `.cd-flow-node--origin`
- `.cd-flow-node--origin:hover`
- `.cd-flow-node:hover`
- `.cd-flow-node__amt`
- `.cd-h-chevron`
- `.cd-h-divider`
- `.cd-h-row:hover`
- `.cd-insight-statement .cd-risk-word`
- `.cd-insight-statement strong`
- `.cd-num`
- `.cd-pulse-hero__chip`
- `.cd-pulse-hero__value`
- `.cd-repay-bar-dot`
- `.cd-repay-bar-fill`
- `.cd-repay-bar-track`
- `.cd-repay-command`
- `.cd-repay-command__summary, .cd-repay-command__evidence`
- `.cd-repay-hero-label`
- `.cd-repay-hero-value`
- `.cd-repay-kicker`
- `.cd-repay-node__value`
- `.cd-repay-pill`
- `.cd-repay-stage`
- `.cd-repay-stat, .cd-repay-node, .cd-repay-mini, .cd-repay-evidence-card`
- `.cd-surface`
- `.cd-surface-2`
- `.cd-surface:hover`
- `.cd-text-dim`
- `.cd-text-muted`
- `.cd-toggle-btn`
- `.cd-toggle-btn--active`
- `.cd-wf-bar--expected`
- `.cd-wf-bar--outstanding`
- `.cd-wf-bar--overdue`
- `.cd-wf-bar--received`
- `a.cd-link, .cd-link`
- `body`
- `h1, h2, h3, .cd-display`
- `html, body`
