# STEP 1 - cuts app.js and app.css into 5 + 4 part files (lossless), adds the new-styles file and the build script.
# Paste the whole text into PowerShell. Safe to run again.
$p   = "C:\Users\2728376\live WorkSpace\STHREENIDHI"
$src = "$p\WebContent\dashboards\ceo-loan-intelligence"
$enc = New-Object System.Text.UTF8Encoding($false)
foreach ($d in "ui-src\js", "ui-src\css", "ui-src\theme") { New-Item -ItemType Directory "$p\$d" -Force | Out-Null }
Get-ChildItem "$p\ui-src\js", "$p\ui-src\css" -File -ErrorAction SilentlyContinue | Remove-Item -Force

# ---- app.js: cut at the "/* ---------- Title ---------- */" section lines (27 sections), joined into 5 files
$js = [System.IO.File]::ReadAllText("$src\app.js", $enc)
$lines = [regex]::Split($js, '(?<=\n)')
$idx = @(); for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i].StartsWith('/* ---------- ')) { $idx += $i } }
if ($idx.Count -ne 27) { throw ("app.js has " + $idx.Count + " sections, expected 27 (it must be the latest version)") }
$cuts = @(0) + $idx
$jsFiles = '1-core-and-explorer', '2-overview', '3-loans-and-repayments', '4-employees', '5-calendar-custom-excel-startup'
$jsFrom  = 0, 21, 22, 24, 25
$jsTo    = 21, 22, 24, 25, 28
for ($k = 0; $k -lt 5; $k++) {
    $a = $cuts[$jsFrom[$k]]
    if ($jsTo[$k] -lt $cuts.Count) { $b = $cuts[$jsTo[$k]] } else { $b = $lines.Count }
    [System.IO.File]::WriteAllText("$p\ui-src\js\" + $jsFiles[$k] + ".js", (($lines[$a..($b - 1)]) -join ''), $enc)
}

# ---- app.css: the first 10104 lines are the old rules; cut into 4 files at fixed lines
$css = [System.IO.File]::ReadAllText("$src\app.css", $enc)
$cl = [regex]::Split($css, '(?<=\n)')
if ($cl.Count -lt 10104) { throw "app.css has fewer than 10104 lines (it must be the latest version)" }
$cssFiles  = '1-foundation-and-first-pages', '2-overview-and-loans', '3-loans-employees-calendar-popups', '4-employees-explorer-excel'
$cssStarts = 1, 3302, 5843, 8251
for ($k = 0; $k -lt 4; $k++) {
    $a = $cssStarts[$k] - 1
    if ($k -lt 3) { $b = $cssStarts[$k + 1] - 2 } else { $b = 10103 }
    [System.IO.File]::WriteAllText("$p\ui-src\css\" + $cssFiles[$k] + ".css", (($cl[$a..$b]) -join ''), $enc)
}

# ---- the file for NEW styles (joined last) and the build script
$theme = @'
/* =====================================================================================
   NEW STYLES (this file is joined AFTER every older rule, so a rule here wins over an old one)
   Put your changes here, page by page, under the page's heading below. Rules:
   - Start every selector with the page root class so nothing leaks to other pages.
   - Change colours, spacing, fonts here. Do not rename classes or ids, do not change the .js files for looks only.
   - Save, then press F5 in the preview page. When finished, run the build script (see the UI developer guide).
   ===================================================================================== */

/* ---------- EVERYTHING (header, menu, buttons, cards, popups) ---------- */
/* examples:  body .top-header { ... }   .cd-chapter-nav { ... }   .cd-surface { ... }   .cd-modal { ... } */


/* ---------- OVERVIEW        root: .cd-overview-chapter ---------- */
/* map card .map-card, KPI cards .stat-card, circles .tva-circle, risk section .cd-risk-*, mandal cards .cd-ov-mcard */


/* ---------- LOANS GIVEN     root: .cd-chapter--loan-journey ---------- */
/* KPI tiles .cd-loan-kpi-chevron, ranked list .cd-cv-top-row, status .cd-lg-status, cards .cd-project-card / .cd-activity-card / .cd-social-chevron-wrapper */


/* ---------- REPAYMENT & PAYMENTS   root: .cd-chapter--repayment-journey ---------- */
/* KPI cards .cd-repay-kpi-card, channel card .cd-rp-col-channels, ranked list .cd-rp-rankcard, women cards .cd-wm-card */


/* ---------- EMPLOYEE PERFORMANCE   root: .cd-chapter--performance-map ---------- */
/* cards .cd-em-card, map .cd-em-mapcard, leagues .cd-rp-half, hierarchy .cd-hv-* */


/* ---------- CALENDAR        root: .cd-chapter--calendar ---------- */
/* heatmap .cd-cal-*, attention list .cd-cal-attn-*, KPI .cd-cal-kpi */


/* ---------- CUSTOM EXCEL BUTTON AND PANEL   roots: .cd-cx-fab, .cd-cx-panel ---------- */

'@
[System.IO.File]::WriteAllText("$p\ui-src\theme\5-theme.css", ($theme -replace "`r`n", "`n") + "`n", $enc)

$build = @'
# Same as build.js for machines without Node.   powershell -File ui-src\build.ps1        (add -Check to only compare)
param([switch]$Check)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out  = Join-Path $root '..\WebContent\dashboards\ceo-loan-intelligence'

function Get-Parts($dirs, $ext) {
    $list = @()
    foreach ($d in $dirs) {
        $dir = Join-Path $root $d
        if (Test-Path $dir) { $list += Get-ChildItem $dir -Filter ("*" + $ext) | Sort-Object Name }
    }
    return $list
}
function Join-Parts($files) {
    $ms = New-Object System.IO.MemoryStream
    foreach ($f in $files) { $b = [System.IO.File]::ReadAllBytes($f.FullName); $ms.Write($b, 0, $b.Length) }
    return ,$ms.ToArray()
}
function Same($a, $b) {
    if ($a.Length -ne $b.Length) { return $false }
    for ($i = 0; $i -lt $a.Length; $i++) { if ($a[$i] -ne $b[$i]) { return $false } }
    return $true
}

$jobs = @(
    @{ Name = 'app.js';  Files = (Get-Parts @('js') '.js') },
    @{ Name = 'app.css'; Files = (Get-Parts @('css', 'theme') '.css') }
)
$stale = $false
# the page asks for app.js?v=<hash>; it changes whenever a part changes, so nobody has to remember to bump it
$all = New-Object System.IO.MemoryStream
foreach ($j in $jobs) { $d = Join-Parts $j.Files; $all.Write($d, 0, $d.Length) }
$sha = [System.Security.Cryptography.SHA1]::Create()
$version = (($sha.ComputeHash($all.ToArray()) | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 10)
foreach ($j in $jobs) {
    $data = Join-Parts $j.Files
    $target = Join-Path $out $j.Name
    $same = $false
    if (Test-Path $target) { $same = Same ([System.IO.File]::ReadAllBytes($target)) $data }
    if ($Check) {
        if ($same) { Write-Host ("OK     " + $j.Name + "  (" + $j.Files.Count + " parts)") } else { Write-Host ("STALE  " + $j.Name); $stale = $true }
    } else {
        if (-not $same) { [System.IO.File]::WriteAllBytes($target, $data) }
        Write-Host ($(if ($same) { "unchanged " } else { "written   " }) + $j.Name + "  " + $data.Length + " bytes from " + $j.Files.Count + " parts")
    }
}
$jsp = Join-Path $out 'CeoLoanIntelligence.jsp'
$jspText = [System.IO.File]::ReadAllText($jsp)
$jspNew = [regex]::Replace($jspText, '(ASSET_VERSION\s*=\s*")[^"]*(")', ('${1}' + $version + '${2}'))
if ($Check) {
    if ($jspNew -eq $jspText) { Write-Host ("OK     CeoLoanIntelligence.jsp  (ASSET_VERSION " + $version + ")") } else { Write-Host "STALE  CeoLoanIntelligence.jsp"; $stale = $true }
} elseif ($jspNew -ne $jspText) {
    [System.IO.File]::WriteAllText($jsp, $jspNew)
    Write-Host ("written   CeoLoanIntelligence.jsp  ASSET_VERSION = " + $version)
}
if ($Check -and $stale) { Write-Host "The deployed files do not match the parts. Run: powershell -File ui-src\build.ps1"; exit 1 }

'@
[System.IO.File]::WriteAllText("$p\ui-src\build.ps1", ($build -replace "`r`n", "`n") + "`n", $enc)

Write-Host "Done. Files in ui-src: js $((Get-ChildItem "$p\ui-src\js").Count), css $((Get-ChildItem "$p\ui-src\css").Count), theme $((Get-ChildItem "$p\ui-src\theme").Count)"
Write-Host "Check:  powershell -ExecutionPolicy Bypass -File ""$p\ui-src\build.ps1"" -Check     (the first two lines should say OK; the css one says STALE until the first build because of the new-styles file)"
