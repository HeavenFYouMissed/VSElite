# V3Code fast dev iteration script.
# Watches react/src/ and auto-rebuilds through the full pipeline.
# Usage: .\dev.ps1            -> watch mode (rebuilds on file change)
#        .\dev.ps1 -Once      -> single build + launch
#        .\dev.ps1 -ReactOnly -> skip gulp, just react rebuild (fast, needs prior gulp)
param(
    [switch]$Once,
    [switch]$ReactOnly
)

$ErrorActionPreference = "Stop"
$env:PATH = "C:\nvm4w\nodejs;" + $env:PATH
Set-Location "c:\Users\heave\Desktop\mcp\vselite"

$root        = "c:\Users\heave\Desktop\mcp\vselite"
$reactDir    = "$root\src\vs\workbench\contrib\void\browser\react"
$reactOut    = "$reactDir\out\sidebar-tsx\index.js"
$hostOut     = "$root\out\vs\workbench\contrib\void\browser\react\out\sidebar-tsx\index.js"
$electronExe = "$root\.build\electron\V3Code.exe"

function Build-React {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Building React..." -ForegroundColor Cyan
    Push-Location $reactDir
    try {
        npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Host "  scope-tailwind FAILED" -ForegroundColor Red; return $false }
        npx tsup 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Host "  tsup FAILED" -ForegroundColor Red; return $false }
    } finally { Pop-Location }
    Write-Host "  React bundle built ($((Get-Item $reactOut).Length / 1KB)KB)" -ForegroundColor Green
    return $true
}

function Copy-ToHost {
    if ($ReactOnly) { return $true }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Copying to host bundle..." -ForegroundColor Cyan
    $src = "$reactDir\out"
    $dst = "$root\out\vs\workbench\contrib\void\browser\react\out"
    if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst -Force | Out-Null }
    Copy-Item -Path "$src\*" -Destination $dst -Recurse -Force
    Write-Host "  Host bundle updated" -ForegroundColor Green
    return $true
}

function Build-Gulp {
    if ($ReactOnly) { return $true }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Running gulp compile-client..." -ForegroundColor Cyan
    npx gulp compile-client 2>&1 | ForEach-Object { if ($_ -match "error|Error") { Write-Host "  $_" -ForegroundColor Red } }
    if ($LASTEXITCODE -ne 0) { Write-Host "  gulp FAILED" -ForegroundColor Red; return $false }
    Write-Host "  Gulp complete" -ForegroundColor Green
    return $true
}

function Launch-V3Code {
    if (-not (Test-Path $electronExe)) {
        Write-Host "  V3Code.exe not found at $electronExe" -ForegroundColor Yellow
        return
    }
    Get-Process -Name "V3Code" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 300
    Start-Process -FilePath $electronExe -ArgumentList @(
        ".",
        "--user-data-dir", "$root\.tmp\user-data",
        "--extensions-dir", "$root\.tmp\extensions"
    ) -WorkingDirectory $root
    Write-Host "  V3Code launched" -ForegroundColor Green
}

function Do-FullBuild {
    $ok = Build-React
    if (-not $ok) { return }
    if (-not $ReactOnly) {
        $ok = Build-Gulp
        if (-not $ok) { return }
    } else {
        Copy-ToHost | Out-Null
    }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] BUILD COMPLETE" -ForegroundColor Green
    Write-Host ""
}

# --- Single build mode ---
if ($Once) {
    Do-FullBuild
    Launch-V3Code
    exit 0
}

# --- Watch mode ---
Write-Host "=== V3Code Dev Watch Mode ===" -ForegroundColor Magenta
Write-Host "Watching: $reactDir\src\" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

Do-FullBuild
Launch-V3Code

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = "$reactDir\src"
$watcher.IncludeSubdirectories = $true
$watcher.Filter = "*.*"
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName

$lastBuild = [DateTime]::MinValue
$debounceMs = 1500

$handler = {
    $now = [DateTime]::Now
    if (($now - $script:lastBuild).TotalMilliseconds -lt $script:debounceMs) { return }
    $script:lastBuild = $now
    $ext = [System.IO.Path]::GetExtension($Event.SourceEventArgs.FullPath)
    if ($ext -match '\.(tsx?|css|js)$') {
        Write-Host ""
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Change detected: $($Event.SourceEventArgs.Name)" -ForegroundColor Yellow
        Do-FullBuild
    }
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
    Write-Host "Watch stopped." -ForegroundColor Gray
}
