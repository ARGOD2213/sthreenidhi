# Builds dist\sthreenidhi.ear for JBoss 5 (what you ran by hand before), after two safety checks.
#   powershell -ExecutionPolicy Bypass -File tools\build-ear.ps1
# Before running: in Eclipse do Project > Clean and make sure the Problems tab shows 0 errors.
param(
    [string]$Jar = "C:\temp\jdk1.6.0_43\jdk1.6.0_43\bin\jar.exe",
    [string]$ContextRoot = "/sthreenidhi"
)
$ErrorActionPreference = "Stop"
$p = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $p

# 1. the deployed app.js / app.css must be built from ui-src (nothing to do if nobody used ui-src)
if (Test-Path "$p\ui-src\build.ps1") {
    & powershell -ExecutionPolicy Bypass -File "$p\ui-src\build.ps1" -Check
    if ($LASTEXITCODE -ne 0) { throw "app.js / app.css are out of date. Run: powershell -File ui-src\build.ps1   then run this script again." }
}

# 2. no mock / preview text inside what goes into the EAR
$bad = @()
foreach ($dir in @("WebContent", "src", "ear")) {
    if (Test-Path "$p\$dir") {
        Get-ChildItem "$p\$dir" -Recurse -File | Where-Object { $_.Extension -notin @(".jar", ".png", ".jpg", ".gif", ".class", ".ico") } | ForEach-Object {
            if (Select-String -Path $_.FullName -Pattern "mock|devtools|ui-src" -Quiet) { $bad += $_.FullName }
        }
    }
}
if ($bad.Count -gt 0) { Write-Host "Mock / dev text found in:"; $bad | ForEach-Object { Write-Host "  $_" }; throw "Remove the mock / dev text above before building the EAR." }
if (Test-Path "$p\WebContent\devtools") { throw "devtools must not be inside WebContent" }

# 3. the EAR
Remove-Item "$p\build\war", "$p\build\ear", "$p\dist" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory "$p\build\war", "$p\build\ear", "$p\dist" | Out-Null
Copy-Item "$p\WebContent\*" "$p\build\war" -Recurse -Force
Remove-Item "$p\build\war\META-INF\MANIFEST.MF" -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory "$p\build\war\WEB-INF\classes" -Force | Out-Null
Copy-Item "$p\build\classes\*" "$p\build\war\WEB-INF\classes" -Recurse -Force
& $Jar cf "$p\build\ear\sthreenidhi.war" -C "$p\build\war" .
New-Item -ItemType Directory "$p\build\ear\META-INF" | Out-Null
(Get-Content "$p\ear\META-INF\application.xml") -replace '@CONTEXT_ROOT@', $ContextRoot | Set-Content "$p\build\ear\META-INF\application.xml"
Copy-Item "$p\ear\META-INF\jboss-app.xml" "$p\build\ear\META-INF\"
& $Jar cf "$p\dist\sthreenidhi.ear" -C "$p\build\ear" .
Get-Item "$p\dist\sthreenidhi.ear" | Select-Object Name, Length
Write-Host "Inside the WAR (should list the servlet, the custom export and poi):"
& $Jar tf "$p\build\ear\sthreenidhi.war" | Select-String "CeoDashCustomExport.class|CeoLoanIntelligenceServlet.class|poi-3.9"
Write-Host "Done. Copy dist\sthreenidhi.ear to the JBoss deploy folder."
