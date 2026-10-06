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
