# Cuts WebContent\...\app.js and app.css into the numbered part files in ui-src\js and ui-src\css (lossless).
#   powershell -ExecutionPolicy Bypass -File tools\split-ui.ps1
$p   = "C:\Users\2728376\live WorkSpace\STHREENIDHI"
$src = "$p\WebContent\dashboards\ceo-loan-intelligence"
$enc = New-Object System.Text.UTF8Encoding($false)
New-Item -ItemType Directory "$p\ui-src\js", "$p\ui-src\css", "$p\ui-src\theme" -Force | Out-Null

# ---- JS: one part per "/* ---------- Title ---------- */" section
$jsNames = 'dom-helpers','popups','format','arrears-line','svg-charts','state','router','context','theme','transitions','toast','virtual-list','hierarchy','chapter-nav','data-loader','drill-rows','rankings','breadcrumb','modal','explorer','chapter-overview','chapter-loans','chapter-repayments','chapter-employees','chapter-calendar','custom-excel','startup'
$js = [System.IO.File]::ReadAllText("$src\app.js", $enc)
$lines = [regex]::Split($js, '(?<=\n)')
$idx = @(); for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i].StartsWith('/* ---------- ')) { $idx += $i } }
if ($idx.Count -ne $jsNames.Count) { throw ("app.js has " + $idx.Count + " sections, expected " + $jsNames.Count + ". Take the ui-src folder from GitHub instead.") }
$cuts = @(0) + $idx
for ($k = 0; $k -lt $cuts.Count; $k++) {
    $a = $cuts[$k]; if ($k + 1 -lt $cuts.Count) { $b = $cuts[$k + 1] } else { $b = $lines.Count }
    if ($k -eq 0) { $nm = 'header' } else { $nm = $jsNames[$k - 1] }
    [System.IO.File]::WriteAllText(("{0}\ui-src\js\{1:00}-{2}.js" -f $p, $k, $nm), (($lines[$a..($b - 1)]) -join ''), $enc)
}

# ---- CSS: cut at fixed line numbers (the first 10104 lines are the old rules; anything after is new theme text)
$cssNames = 'base-and-app-shell','loans-composition','hierarchy-waterfall-trend','repayments-command-and-kpis','tiles-risk-action-perf','repayments-payment-ecosystem','rankings-drawer-loading','calendar-header-base','employees-rings-and-base','state-badge-perf-legend-filters','payments-behavior-command','loans-command','member-drawer-breadcrumb-pills','overview-core','header-nav-brand','overview-panels-cards-leaders','loans-page-and-card-groups','employees-page','calendar-cards','modal-toast-member-transitions','employees-msm-card','explorer-lists-and-loans-details','employees-map-and-calendar-extras','repayments-crumbs-and-frame','employees-hierarchy-view','repayments-cv-cards','late-overrides-risk-frame','custom-excel-and-women-cards'
$starts = 1,781,828,1057,1482,1630,1671,1914,2178,2713,2958,3302,3778,4118,4945,5143,5843,6383,6949,7238,8251,9073,9307,9459,9519,9656,9847,9984
$css = [System.IO.File]::ReadAllText("$src\app.css", $enc)
$cl = [regex]::Split($css, '(?<=\n)')
if ($cl.Count -lt 10104) { throw "app.css has fewer than 10104 lines. Take the ui-src folder from GitHub instead." }
for ($k = 0; $k -lt $starts.Count; $k++) {
    $a = $starts[$k] - 1; if ($k + 1 -lt $starts.Count) { $b = $starts[$k + 1] - 2 } else { $b = 10103 }
    [System.IO.File]::WriteAllText(("{0}\ui-src\css\{1:00}-{2}.css" -f $p, $k, $cssNames[$k]), (($cl[$a..$b]) -join ''), $enc)
}
Write-Host ("Done: " + (Get-ChildItem "$p\ui-src\js").Count + " js parts, " + (Get-ChildItem "$p\ui-src\css").Count + " css parts in $p\ui-src")
