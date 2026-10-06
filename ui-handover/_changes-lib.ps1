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
