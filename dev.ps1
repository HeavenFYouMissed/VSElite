# V3Code fast dev iteration loop.
#
# The pain this solves: the full `gulp compile-client` step takes ~3 minutes. For
# React/visual edits you DON'T need it -- the React bundle can be copied straight into
# the host output tree, and a window reload (Ctrl+R) picks it up in seconds.
#
# Usage:
#   .\dev.ps1                -> WATCH mode (fast): on save, rebuild React + copy to host.
#                               Launches V3Code once; press Ctrl+R IN V3Code to see changes.
#   .\dev.ps1 -Once          -> one fast build + launch, then exit.
#   .\dev.ps1 -FullGulp      -> one FULL build (gulp compile-client) + launch. Use this
#                               after editing .ts service files OUTSIDE react/ (e.g.
#                               toolsService.ts, chatThreadService.ts).
#   .\dev.ps1 -Watch -FullGulp -> watch mode but run full gulp each change (slow; rarely needed).
#
# RULE OF THUMB:
#   - Edited a .tsx/.css file under react/src/  -> fast path (default) is enough.
#   - Edited a .ts file in browser/ or common/  -> run `.\dev.ps1 -FullGulp` once.
param(
    [switch]$Once,
    [switch]$FullGulp,
    [switch]$Watch
)

# NOTE: deliberately NOT "Stop" -- npx writes harmless warnings (e.g. Browserslist) to
# stderr, which "Stop" would treat as fatal. We gate on $LASTEXITCODE explicitly instead.
$ErrorActionPreference = "Continue"
$env:PATH = "C:\nvm4w\nodejs;" + $env:PATH
$root = "c:\Users\heave\Desktop\mcp\vselite"
Set-Location $root

$reactDir    = "$root\src\vs\workbench\contrib\void\browser\react"
$reactOut    = "$reactDir\out\sidebar-tsx\index.js"
$reactOutDir = "$reactDir\out"
$hostOutDir  = "$root\out\vs\workbench\contrib\void\browser\react\out"
$electronExe = "$root\.build\electron\V3Code.exe"
$nlsFile     = "$root\out\nls.messages.json"

# CRITICAL: gulp compile-client wipes out/ and compiles with build=false, which does NOT
# generate out/nls.messages.json. The workbench bootstrap (src/main.ts) hard-requires that
# file or the renderer crashes to a BLACK SCREEN. In dev (build=false) all UI text comes
# from inline English, so the NLS array is unused -- an empty [] satisfies the bootstrap.
# This single missing file is the root cause of the chronic "won't open" builds.
function Ensure-NlsFile {
    if (-not (Test-Path $nlsFile)) {
        if (Test-Path "$root\out") {
            '[]' | Set-Content -Path $nlsFile -NoNewline -Encoding UTF8
            Write-Host "  Wrote out/nls.messages.json (required for the renderer to boot)." -ForegroundColor Green
        }
    }
}

function Build-React {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Building React (scope-tailwind + tsup)..." -ForegroundColor Cyan
    Push-Location $reactDir
    try {
        npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-" *> $null
        if ($LASTEXITCODE -ne 0) { Write-Host "  scope-tailwind FAILED" -ForegroundColor Red; return $false }
        npx tsup *> $null
        if ($LASTEXITCODE -ne 0) { Write-Host "  tsup FAILED (TypeScript error in a .tsx file)" -ForegroundColor Red; return $false }
    } finally { Pop-Location }
    if (Test-Path $reactOut) {
        Write-Host "  React bundle built ($([math]::Round((Get-Item $reactOut).Length / 1KB)) KB)" -ForegroundColor Green
    }
    return $true
}

# FAST path: copy the freshly-built react/out straight into the host output tree.
# This bypasses the ~3-min gulp. Valid for React/CSS edits (not .ts service edits).
function Copy-ToHost {
    if (-not (Test-Path $hostOutDir)) {
        Write-Host "  Host output dir missing -- you must run a full gulp build at least once first (.\dev.ps1 -FullGulp)." -ForegroundColor Yellow
        return $false
    }
    Copy-Item -Path "$reactOutDir\*" -Destination $hostOutDir -Recurse -Force
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Copied React bundle to host. Press Ctrl+R in V3Code to reload." -ForegroundColor Green
    return $true
}

# FULL path: gulp recompiles the whole workbench (needed for .ts changes). Slow.
function Build-Gulp {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Running gulp compile-client (full, ~3 min)..." -ForegroundColor Cyan
    $hadError = $false
    npx gulp compile-client 2>&1 | ForEach-Object {
        if ($_ -match "Error|error TS|errored") { Write-Host "  $_" -ForegroundColor Red; $hadError = $true }
    }
    if ($LASTEXITCODE -ne 0 -or $hadError) { Write-Host "  gulp compile-client FAILED" -ForegroundColor Red; return $false }
    Ensure-NlsFile
    Write-Host "  Gulp complete." -ForegroundColor Green
    return $true
}

function Launch-V3Code {
    if (-not (Test-Path $electronExe)) {
        Write-Host "  V3Code.exe not found at $electronExe (run a full build first)." -ForegroundColor Yellow
        return
    }
    Ensure-NlsFile  # belt-and-suspenders for the NLS file

    Get-Process -Name "V3Code" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 400
    # CRITICAL: a compile-client build is a DEV build. It MUST be launched with VSCODE_DEV=1
    # so the window loads workbench-dev.html + the dev module loader. Without these env vars
    # the app runs in PRODUCTION mode, expects bundled output that a dev build lacks, and the
    # renderer crashes to a BLACK SCREEN (MonacoBootstrapWindow undefined). This mirrors
    # scripts/code.bat and is the true fix for the chronic "won't open" builds.
    $env:VSCODE_DEV = "1"
    $env:NODE_ENV = "development"
    $env:VSCODE_CLI = "1"
    Start-Process -FilePath $electronExe -ArgumentList @(
        ".",
        "--user-data-dir", "$root\.tmp\user-data",
        "--extensions-dir", "$root\.tmp\extensions"
    ) -WorkingDirectory $root
    Write-Host "  V3Code launched (VSCODE_DEV=1)." -ForegroundColor Green
}

# A single iteration: react build, then either fast-copy or full gulp.
function Build-Once {
    param([bool]$useGulp)
    if (-not (Build-React)) { return $false }
    if ($useGulp) { return (Build-Gulp) }
    else { return (Copy-ToHost) }
}

# ---- -Once: fast single build + launch ----
if ($Once) {
    if (Build-Once -useGulp:$FullGulp) { Launch-V3Code }
    exit 0
}

# ---- -FullGulp (no -Watch): one full build + launch ----
if ($FullGulp -and -not $Watch) {
    if (Build-Once -useGulp:$true) { Launch-V3Code }
    exit 0
}

# ---- WATCH mode (default) ----
$useGulpInWatch = $FullGulp.IsPresent
Write-Host "=== V3Code Dev Watch ($(if ($useGulpInWatch) { 'FULL gulp' } else { 'FAST copy' }) mode) ===" -ForegroundColor Magenta
Write-Host "Watching: $reactDir\src\" -ForegroundColor Gray
if (-not $useGulpInWatch) {
    Write-Host "FAST mode: after each rebuild, press Ctrl+R inside V3Code to see changes." -ForegroundColor Gray
    Write-Host "If you edit a .ts service file (not .tsx), stop and run: .\dev.ps1 -FullGulp" -ForegroundColor Gray
}
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

Build-Once -useGulp:$useGulpInWatch | Out-Null
Launch-V3Code

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = "$reactDir\src"
$watcher.IncludeSubdirectories = $true
$watcher.Filter = "*.*"
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName

$script:lastBuild = [DateTime]::MinValue
$script:useGulp = $useGulpInWatch
$debounceMs = 1200

$handler = {
    $now = [DateTime]::Now
    if (($now - $script:lastBuild).TotalMilliseconds -lt $debounceMs) { return }
    $ext = [System.IO.Path]::GetExtension($Event.SourceEventArgs.FullPath)
    if ($ext -notmatch '\.(tsx?|css|js)$') { return }
    $script:lastBuild = $now
    Write-Host ""
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Changed: $($Event.SourceEventArgs.Name)" -ForegroundColor Yellow
    if (-not (Build-React)) { return }
    if ($script:useGulp) { Build-Gulp | Out-Null } else { Copy-ToHost | Out-Null }
}

Register-ObjectEvent $watcher Changed -Action $handler | Out-Null
Register-ObjectEvent $watcher Created -Action $handler | Out-Null
Register-ObjectEvent $watcher Renamed -Action $handler | Out-Null
$watcher.EnableRaisingEvents = $true

try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
    Get-EventSubscriber | Unregister-Event
    Write-Host "Watch stopped." -ForegroundColor Gray
}
