# ui-src

The dashboard's look and scripts, cut into small numbered parts. Read `docs/UI_DEVELOPER_GUIDE.md` first.

- `css/`  existing styles in cascade order (28 parts) - leave the order alone
- `theme/` new styles per page; joined after `css/`
- `js/`   existing scripts (28 parts)
- `build.js` / `build.ps1`  join the parts into `WebContent/dashboards/ceo-loan-intelligence/app.js` and `app.css`

The parts joined in order are byte-for-byte the files the live server served before the split.
