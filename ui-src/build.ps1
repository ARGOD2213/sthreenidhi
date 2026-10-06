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
