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
