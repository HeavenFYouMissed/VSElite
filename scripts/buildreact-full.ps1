# Build the React subtree AND copy bundles to the workbench out folder
# where the Electron renderer actually reads from. This is the loop that
# `npm run buildreact` alone doesn't complete — it writes to src/.../react/out
# but the renderer loads from out/vs/.../react/out.
#
# Usage from any directory:
#   .\scripts\buildreact-full.ps1
#
# After this completes, Ctrl+R in the V3Code dev window picks up the changes.
# Full process relaunch is NOT required.

$ErrorActionPreference = 'Stop'

# Resolve repo root from script location
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Ensure Node is on PATH (nvm-windows installs to C:\nvm4w\nodejs)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
	if (Test-Path 'C:\nvm4w\nodejs\node.exe') {
		$env:Path = 'C:\nvm4w\nodejs;' + $env:Path
	} else {
		Write-Error 'Node not on PATH and not at C:\nvm4w\nodejs. Activate nvm or install Node.'
		exit 1
	}
}

# tsup wants more heap for the React build
$env:NODE_OPTIONS = '--max-old-space-size=8192'

Write-Host '=== npm run buildreact ===' -ForegroundColor Cyan
npm run buildreact 2>&1 | Select-Object -Last 8
if ($LASTEXITCODE -ne 0) {
	Write-Error "buildreact failed (exit $LASTEXITCODE)"
	exit $LASTEXITCODE
}

Write-Host ''
Write-Host '=== copying React bundles to workbench out folder ===' -ForegroundColor Cyan
$srcOut = 'src\vs\workbench\contrib\void\browser\react\out'
$dstOut = 'out\vs\workbench\contrib\void\browser\react\out'
if (-not (Test-Path $dstOut)) {
	New-Item -ItemType Directory -Force -Path $dstOut | Out-Null
}
Copy-Item -Recurse -Force "$srcOut\*" $dstOut
$copied = (Get-ChildItem $dstOut -Recurse -File | Measure-Object).Count
Write-Host "Copied $copied file(s) into $dstOut"

Write-Host ''
Write-Host '=== Done. Ctrl+R the V3Code dev window. ===' -ForegroundColor Green
