# V3Code reliable build + launch pipeline.
# Usage: .\build.ps1            -> full build + launch
#        .\build.ps1 -NoLaunch  -> build only
#        .\build.ps1 -SkipGulp  -> react only (fast iteration, ONLY valid if you've gulped once since editing non-react files)
param(
    [switch]$NoLaunch,
    [switch]$SkipGulp,
    [string]$ExpectedString = "BUILDTEST-12345"
)

$ErrorActionPreference = "Stop"
$env:PATH = "C:\nvm4w\nodejs;" + $env:PATH
Set-Location "c:\Users\heave\Desktop\mcp\vselite"

$root        = "c:\Users\heave\Desktop\mcp\vselite"
$reactBundle = "$root\src\vs\workbench\contrib\void\browser\react\out\sidebar-tsx\index.js"
$hostBundle  = "$root\out\vs\workbench\contrib\void\browser\react\out\sidebar-tsx\index.js"
$electronExe = "$root\.build\electron\V3Code.exe"

function Fail($msg) {
    Write-Host ""
    Write-Host "FAIL: $msg" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Step 0: Kill any running V3Code ===" -ForegroundColor Cyan
Get-Process -Name "V3Code" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

Write-Host ""
Write-Host "=== Step 1: Building React (buildreact) ===" -ForegroundColor Cyan
npm run buildreact
if ($LASTEXITCODE -ne 0) { Fail "npm run buildreact failed" }

Write-Host ""
Write-Host "=== Step 2: Verify React bundle on disk ===" -ForegroundColor Cyan
if (-not (Test-Path $reactBundle)) { Fail "React bundle missing: $reactBundle" }
$reactContent = Get-Content $reactBundle -Raw
Write-Host "  React bundle: $($reactContent.Length) chars"
if ($reactContent -notmatch [regex]::Escape($ExpectedString)) {
    Fail "Expected string '$ExpectedString' NOT found in React bundle. The string never made it through scope-tailwind/tsup. Check src/sidebar-tsx/SidebarChat.tsx."
}
Write-Host "  React bundle contains '$ExpectedString'" -ForegroundColor Green

if (-not $SkipGulp) {
    Write-Host ""
    Write-Host "=== Step 3: Building VS Code host (gulp compile-client) ===" -ForegroundColor Cyan
    npx gulp compile-client
    if ($LASTEXITCODE -ne 0) { Fail "gulp compile-client failed" }
} else {
    Write-Host ""
    Write-Host "=== Step 3: SKIPPED (gulp) ===" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Step 4: Verify host bundle has the string ===" -ForegroundColor Cyan
if (-not (Test-Path $hostBundle)) { Fail "Host bundle missing: $hostBundle  -- gulp didn't copy react/out to out/vs" }
$hostContent = Get-Content $hostBundle -Raw
Write-Host "  Host bundle: $($hostContent.Length) chars"
if ($hostContent -notmatch [regex]::Escape($ExpectedString)) {
    Fail "Expected string '$ExpectedString' NOT in host bundle ($hostBundle). React rebuilt but gulp didn't propagate it. Re-run without -SkipGulp."
}
Write-Host "  Host bundle contains '$ExpectedString'" -ForegroundColor Green

if ($NoLaunch) {
    Write-Host ""
    Write-Host "=== Done (no launch) ===" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "=== Step 5: Launching V3Code ===" -ForegroundColor Cyan
if (-not (Test-Path $electronExe)) { Fail "Electron exe missing: $electronExe" }
Start-Process -FilePath $electronExe -ArgumentList @(
    ".",
    "--user-data-dir", "$root\.tmp\user-data",
    "--extensions-dir", "$root\.tmp\extensions"
) -WorkingDirectory $root

Write-Host ""
Write-Host "Launched. Open the V3Code sidebar — composer placeholder should read '$ExpectedString'." -ForegroundColor Green
