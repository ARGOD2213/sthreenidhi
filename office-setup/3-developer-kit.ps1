# STEP 3 - makes the developer kit inside ui-src (the tools that let the developer send back ONLY his changes). Paste the whole text into PowerShell.
# Run it AFTER step 1 and step 2, and BEFORE you zip ui-src and ui-mock for the developer.
$p   = "C:\Users\2728376\live WorkSpace\STHREENIDHI"
$enc = New-Object System.Text.UTF8Encoding($false)
if (-not (Test-Path "$p\ui-src\css\1-foundation-and-first-pages.css")) { throw "Run step 1 first (ui-src\css is missing)." }
function Save($rel, $text, $crlf) {
    $t2 = (($text -replace "`r`n", "`n").TrimEnd("`n")) + "`n"
    if ($crlf) { $t2 = $t2 -replace "`n", "`r`n" }
    [System.IO.File]::WriteAllText("$p\ui-src\$rel", $t2, $enc)
}

$t = @'
# Helper functions used by SEND-MY-CHANGES.ps1 and APPLY-CHANGES.ps1. Nobody needs to open or edit this file.
$script:Enc = New-Object System.Text.UTF8Encoding($false)
$script:TrimChars = [char[]](13, 10, 32, 9)
$script:Window = 300     # how far ahead we look to find where the two versions match again
$script:Look = 3         # how many equal lines in a row count as "matching again"

function Norm([string]$s) { return $s.TrimEnd($script:TrimChars) }

function Split-Raw([string]$text) {
    $list = New-Object System.Collections.ArrayList
    if ($text.Length -gt 0) {
        foreach ($p in [regex]::Split($text, '(?<=\n)')) { if ($p.Length -gt 0) { [void]$list.Add($p) } }
    }
    return ,$list
}

function Read-RawLines([string]$path) {
    return ,(Split-Raw ([System.IO.File]::ReadAllText($path, $script:Enc)))
}

function Get-Norm($raw) {
    $r = New-Object System.Collections.ArrayList
    foreach ($s in $raw) { [void]$r.Add((Norm $s)) }
    return ,$r
}

function Test-Sync($a, $b, $i, $j) {
    $n = $a.Count; $m = $b.Count
    for ($t = 0; $t -lt $script:Look; $t++) {
        $ei = ($i + $t) -ge $n; $ej = ($j + $t) -ge $m
        if ($ei -and $ej) { return $true }
        if ($ei -or $ej) { return $false }
        if ($a[$i + $t] -cne $b[$j + $t]) { return $false }
    }
    return $true
}

function Get-Hash($h) {
    [long]$v = 7
    foreach ($s in $h.Del) { foreach ($c in $s.ToCharArray()) { $v = ($v * 31 + [int]$c) % 1000003 }; $v = ($v * 31 + 10) % 1000003 }
    $v = ($v * 31 + 1) % 1000003
    foreach ($s in $h.Ins) { foreach ($c in $s.ToCharArray()) { $v = ($v * 31 + [int]$c) % 1000003 }; $v = ($v * 31 + 10) % 1000003 }
    return [string]$v
}

# $a and $b are lists of normalised lines (before / after). Returns the list of changes.
function Get-Hunks($a, $b) {
    $hunks = New-Object System.Collections.ArrayList
    $n = $a.Count; $m = $b.Count; $i = 0; $j = 0
    while ($i -lt $n -or $j -lt $m) {
        if ($i -lt $n -and $j -lt $m -and $a[$i] -ceq $b[$j]) { $i++; $j++; continue }
        $dx = -1; $dy = -1
        for ($d = 1; $d -le $script:Window -and $dx -lt 0; $d++) {
            for ($x = 0; $x -le $d; $x++) {
                $y = $d - $x
                if (($i + $x) -gt $n -or ($j + $y) -gt $m) { continue }
                if (Test-Sync $a $b ($i + $x) ($j + $y)) { $dx = $x; $dy = $y; break }
            }
        }
        if ($dx -lt 0) { $dx = $n - $i; $dy = $m - $j }
        $h = @{ Start = $i + 1; Ctx = $null; Del = $a.GetRange($i, $dx); Ins = $b.GetRange($j, $dy); Hash = '' }
        if ($i -gt 0) { $h.Ctx = $a[$i - 1] }
        $h.Hash = Get-Hash $h
        [void]$hunks.Add($h)
        $i += $dx; $j += $dy
    }
    return ,$hunks
}

function Add-HunkText($sb, [string]$file, $hunks) {
    [void]$sb.AppendLine("FILE $file")
    foreach ($h in $hunks) {
        [void]$sb.AppendLine("@@ $($h.Start) $($h.Del.Count) $($h.Ins.Count) $($h.Hash)")
        if ($h.Ctx -ne $null) { [void]$sb.AppendLine("=" + $h.Ctx) }
        foreach ($s in $h.Del) { [void]$sb.AppendLine("-" + $s) }
        foreach ($s in $h.Ins) { [void]$sb.AppendLine("+" + $s) }
    }
}

# Applies the changes to the raw lines of a file and returns the new text. Throws (and writes nothing) if the file is not what the changes expect.
function Apply-Hunks($raw, $hunks, [string]$name) {
    $nl = "`n"
    if ($raw.Count -gt 0 -and $raw[0].EndsWith("`r`n")) { $nl = "`r`n" }
    $n = $raw.Count; $pos = 0
    $sb = New-Object System.Text.StringBuilder
    foreach ($h in $hunks) {
        $s = $h.Start - 1
        if ($s -lt $pos -or ($s + $h.Del.Count) -gt $n) { throw "$name : a change points to line $($h.Start), which does not fit this file." }
        if ($h.Ctx -ne $null) {
            if ($s -lt 1 -or (Norm $raw[$s - 1]) -cne $h.Ctx) { throw "$name : line $($s) is not what the changes expect (the file is different from the developer's starting copy)." }
        }
        for ($k = 0; $k -lt $h.Del.Count; $k++) {
            if ((Norm $raw[$s + $k]) -cne $h.Del[$k]) { throw "$name : line $($s + $k + 1) is not what the changes expect (the file is different from the developer's starting copy, or the changes were already applied)." }
        }
        for ($k = $pos; $k -lt $s; $k++) { [void]$sb.Append($raw[$k]) }
        if ($h.Ins.Count -gt 0 -and $sb.Length -gt 0 -and $sb[$sb.Length - 1] -ne [char]10) { [void]$sb.Append($nl) }
        foreach ($t in $h.Ins) { [void]$sb.Append($t).Append($nl) }
        $pos = $s + $h.Del.Count
    }
    for ($k = $pos; $k -lt $n; $k++) { [void]$sb.Append($raw[$k]) }
    return $sb.ToString()
}

# Reads the text of a changes file. Returns a list of @{ File; Hunks }. Throws a plain-English message if the text is damaged.
function Read-Changes([string]$text) {
    $lines = [regex]::Split($text, "\r?\n")
    $files = New-Object System.Collections.ArrayList
    $cur = $null; $k = 0; $count = 0; $ended = $false; $started = $false
    while ($k -lt $lines.Length) {
        $line = $lines[$k]
        if ($line -eq '') { $k++; continue }
        if (-not $started) {
            if ((Norm $line) -ne 'CSS-CHANGES v1') { throw "This is not a changes text: the first line must be CSS-CHANGES v1." }
            $started = $true; $k++; continue
        }
        if ($line.StartsWith('FILE ')) {
            $name = (Norm $line.Substring(5))
            if ($name -notmatch '^(css|theme)/[A-Za-z0-9._-]+\.css$') { throw "Line $($k + 1): the file name '$name' is not allowed." }
            $cur = @{ File = $name; Hunks = (New-Object System.Collections.ArrayList) }
            [void]$files.Add($cur); $k++; continue
        }
        if ($line.StartsWith('@@ ')) {
            $m = [regex]::Match($line, '^@@ (\d+) (\d+) (\d+) (\d+)\s*$')
            if (-not $m.Success -or $cur -eq $null) { throw "Line $($k + 1) is damaged. The text was probably cut or re-wrapped by the email. Ask the developer to send it again as plain text." }
            $dn = [int]$m.Groups[2].Value; $an = [int]$m.Groups[3].Value
            $h = @{ Start = [int]$m.Groups[1].Value; Ctx = $null; Del = (New-Object System.Collections.ArrayList); Ins = (New-Object System.Collections.ArrayList); Hash = $m.Groups[4].Value }
            $k++
            if ($k -lt $lines.Length -and $lines[$k].StartsWith('=')) { $h.Ctx = (Norm $lines[$k].Substring(1)); $k++ }
            for ($q = 0; $q -lt $dn; $q++) {
                if ($k -ge $lines.Length -or -not $lines[$k].StartsWith('-')) { throw "Line $($k + 1) is damaged (a removed line is missing). The text was probably cut or re-wrapped. Ask the developer to send it again." }
                [void]$h.Del.Add((Norm $lines[$k].Substring(1))); $k++
            }
            for ($q = 0; $q -lt $an; $q++) {
                if ($k -ge $lines.Length -or -not $lines[$k].StartsWith('+')) { throw "Line $($k + 1) is damaged (an added line is missing). The text was probably cut or re-wrapped. Ask the developer to send it again." }
                [void]$h.Ins.Add((Norm $lines[$k].Substring(1))); $k++
            }
            if ((Get-Hash $h) -ne $h.Hash) { throw "A change in $($cur.File) near line $($h.Start) was damaged on the way (check sum does not match). Ask the developer to send it again as plain text." }
            [void]$cur.Hunks.Add($h); $count++
            continue
        }
        if ($line.StartsWith('END ')) {
            if ([int](Norm $line.Substring(4)) -ne $count) { throw "The text has $count changes but it should have $(Norm $line.Substring(4)). Part of it is missing." }
            $ended = $true; $k++; continue
        }
        throw "Line $($k + 1) is not understood. The text was probably cut or re-wrapped by the email. Ask the developer to send it again as plain text."
    }
    if (-not $started) { throw "The changes text is empty." }
    if (-not $ended) { throw "The text is cut: the last line (END ...) is missing. Paste the complete text." }
    return ,$files
}
'@
Save '_changes-lib.ps1' $t

$t = @'
# DEVELOPER: run this when you finish (double-click SEND-MY-CHANGES.bat). It writes the file MY-CHANGES-TO-SEND.txt
# that contains ONLY the lines you changed. Copy the whole text of that file into your email.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $root '_changes-lib.ps1')
$orig = Join-Path $root '_original'
if (-not (Test-Path $orig)) { throw "The folder _original is missing. Do not delete it: it is the untouched copy used to find what you changed." }

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('CSS-CHANGES v1')
$total = 0
foreach ($dir in 'css', 'theme') {
    foreach ($f in (Get-ChildItem (Join-Path $orig $dir) -Filter '*.css' | Sort-Object Name)) {
        $cur = Join-Path (Join-Path $root $dir) $f.Name
        if (-not (Test-Path $cur)) { throw "The file $dir\$($f.Name) is missing. Put it back (do not delete or rename the css files)." }
        $ra = Read-RawLines $f.FullName
        $rb = Read-RawLines $cur
        $a = Get-Norm $ra
        $b = Get-Norm $rb
        $hunks = Get-Hunks $a $b
        if ($hunks.Count -eq 0) { continue }
        # safety check: applying the changes to the original must give exactly your file
        $again = Get-Norm (Split-Raw (Apply-Hunks $ra $hunks $f.Name))
        $same = ($again.Count -eq $b.Count)
        for ($k = 0; $same -and $k -lt $b.Count; $k++) { if ($again[$k] -cne $b[$k]) { $same = $false } }
        if (-not $same) { throw "Internal check failed for $($f.Name). Please send the whole ui-src folder to the person who gave you this project instead." }
        Add-HunkText $sb "$dir/$($f.Name)" $hunks
        Write-Host ("  {0,-45} {1} change(s)" -f "$dir/$($f.Name)", $hunks.Count)
        $total += $hunks.Count
    }
}
if ($total -eq 0) { Write-Host "You have not changed anything yet, so there is nothing to send."; exit 0 }
[void]$sb.AppendLine("END $total")
# final check: the text we are about to write must read back correctly
[void](Read-Changes $sb.ToString())
$out = Join-Path $root 'MY-CHANGES-TO-SEND.txt'
[System.IO.File]::WriteAllText($out, $sb.ToString(), $script:Enc)
Write-Host ""
Write-Host ("Done: {0} change(s), {1} KB. File: {2}" -f $total, [math]::Round($sb.Length / 1024), $out)
Write-Host "Copy ALL the text of that file into the body of your email (do not attach, do not edit it)."
try { Start-Process notepad.exe ('"' + $out + '"') } catch { }
'@
Save 'SEND-MY-CHANGES.ps1' $t

$t = @'
# OFFICE PC: applies the developer's changes to ui-src\css and ui-src\theme, then builds app.css.
# Before running: save the developer's text as  ui-src\incoming-changes.txt  (Notepad: paste, Save As, file type All Files).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $root '_changes-lib.ps1')
$in = Join-Path $root 'incoming-changes.txt'
if (-not (Test-Path $in)) { Write-Host "File not found: $in"; Write-Host "Paste the developer's text into Notepad and save it with exactly that name."; exit 1 }
try {
    $files = Read-Changes ([System.IO.File]::ReadAllText($in, $script:Enc))
    # check everything first; nothing is written unless every file fits
    $results = @{}
    foreach ($fe in $files) {
        $path = Join-Path $root $fe.File
        if (-not (Test-Path $path)) { throw "The file $($fe.File) does not exist here." }
        $raw = Read-RawLines $path
        $results[$fe.File] = Apply-Hunks $raw $fe.Hunks $fe.File
    }
} catch {
    Write-Host ""
    Write-Host "NOTHING WAS CHANGED." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bak = Join-Path $root "_backup_$stamp"
foreach ($dir in 'css', 'theme') { Copy-Item (Join-Path $root $dir) (Join-Path $bak $dir) -Recurse -Force }
foreach ($fe in $files) {
    [System.IO.File]::WriteAllText((Join-Path $root $fe.File), $results[$fe.File], $script:Enc)
    Write-Host ("applied  {0}  ({1} change(s))" -f $fe.File, $fe.Hunks.Count)
}
Write-Host "Backup of the old css: $bak"
Write-Host "Building app.css ..."
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'build.ps1')
# the applied files become the new starting point for the next round
$o = Join-Path $root '_original'
if (Test-Path $o) { Remove-Item $o -Recurse -Force }
foreach ($dir in 'css', 'theme') { Copy-Item (Join-Path $root $dir) (Join-Path $o $dir) -Recurse -Force }
Write-Host ""
Write-Host "DONE. Open ui-mock\index.html to look at it, then build the EAR and deploy as usual." -ForegroundColor Green
'@
Save 'APPLY-CHANGES.ps1' $t

$t = @'
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0SEND-MY-CHANGES.ps1"
echo.
pause
'@
Save 'SEND-MY-CHANGES.bat' $t $true

$t = @'
CEO LOAN DASHBOARD - STYLING JOB   (read this first, it takes 3 minutes)
=======================================================================

WHAT YOU DO
  Change how the dashboard LOOKS: colours, spacing (padding / margin), font sizes, borders, shadows,
  card and table looks. Page by page.

WHAT YOU DO NOT DO
  - Do not edit any .js, .jsp or .java file. Do not rename classes or ids. They are used by the program.
  - Do not delete, rename or move any file or folder.
  - Do not use "Format document", "Beautify", "Minify" or any auto-format on the css files.
    (It rewrites every line, and then your changes cannot be sent.)
  - Do not hide any number, label or button. The CEO must still see everything.

WHAT YOU NEED
  Only a browser (Chrome or Edge) and Notepad / VS Code / Notepad++. Nothing to install. No server, no database.

STEP 1 - OPEN THE DASHBOARD
  Unzip the folder. Open:   ui-mock\index.html     (right-click > Open with > Chrome)
  You see the full dashboard with FAKE numbers. Click around: every page, every drill-down, every popup works.

STEP 2 - FIND WHAT TO CHANGE
  In Chrome press F12, click the small arrow icon (top-left of the F12 panel), then click the thing you want
  to change on the page. The panel shows its class name, for example   cd-loan-kpi-chevron
  Now search for that class name in the css files:
      ui-src\css\1-foundation-and-first-pages.css       header, menu, buttons, base styles, first pages
      ui-src\css\2-overview-and-loans.css               Overview page, Loans Given page
      ui-src\css\3-loans-employees-calendar-popups.css  Loans, Repayment, Employees, Calendar, popups
      ui-src\css\4-employees-explorer-excel.css         Employees, drill-down tables, Custom Excel
  (In VS Code: Ctrl+Shift+F searches all files at once.)
  The F12 panel also lets you try a change live (edit a value there) before you write it in the file.

STEP 3 - CHANGE IT
  Open the css file, change the value (for example  padding: 12px  ->  padding: 16px,  or a colour),
  Save, go to the browser and press F5. You see the result at once.

  If you need a completely NEW rule, add it at the bottom of   ui-src\theme\5-theme.css
  (that file loads last, so it wins over older rules).

RULES FOR THE CSS (the CEO's office uses an older browser, so keep it simple)
  - Plain CSS only. No   var(--x)   variables, no   gap   on flex, no new CSS tricks.
  - Check the page at 1366 px and 1920 px screen widths.
  - Colours: use normal hex codes like #1a73e8.

OTHER SITUATIONS TO CHECK (once per page, at the end)
  Add this to the address in the browser:
      ui-mock\index.html?scenario=slow          shows the loading look
      ui-mock\index.html?scenario=empty         shows the "no data" look
      ui-mock\index.html?scenario=servererror   shows the error look
      ui-mock\index.html?scenario=notready      shows the "data is being prepared" screen
      ui-mock\index.html?scenario=nooverdue     shows the page without the overdue columns
  (If the page looks odd after you add this, remove it from the address and press F5.)

WHEN YOU ARE FINISHED (or at the end of each day)
  1. Double-click   ui-src\SEND-MY-CHANGES.bat
  2. A black window appears, then Notepad opens a file called  MY-CHANGES-TO-SEND.txt
  3. In Notepad press Ctrl+A, Ctrl+C. Paste ALL the text into the BODY of an email to the person who gave you
     this project. Do not attach the file, do not edit the text, do not use the "formatted / rich text" mode
     (use plain text if your email has the option).
  4. If the black window says "You have not changed anything yet", you did not save your css files.

THAT IS ALL. The text you send contains only the lines you changed, so it is short.

Questions about what something does? Ask before changing it. Do not guess on anything that is not styling.
'@
Save 'START-HERE.txt' $t $true


# the untouched copy that the developer's changes are measured against (made once; delete the folder _original to refresh it)
if (-not (Test-Path "$p\ui-src\_original")) {
    New-Item -ItemType Directory "$p\ui-src\_original" -Force | Out-Null
    Copy-Item "$p\ui-src\css" "$p\ui-src\_original\css" -Recurse -Force
    Copy-Item "$p\ui-src\theme" "$p\ui-src\_original\theme" -Recurse -Force
    Write-Host "Made the untouched copy ui-src\_original"
} else { Write-Host "ui-src\_original already exists (kept)." }

Write-Host ""
Write-Host "Done. Now zip the two folders for the developer (only these two, nothing else):"
Write-Host "   Compress-Archive -Path ""$p\ui-src"", ""$p\ui-mock"" -DestinationPath ""$p\..\ceo-dashboard-ui-kit.zip"" -Force"
