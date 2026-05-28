# Generate V3Code app icons + Start Menu tile from the SVG brand mark.
#
# Prerequisites: ImageMagick on PATH (`magick --version` must work).
# Install: winget install ImageMagick.ImageMagick
#       OR choco install imagemagick
#       OR https://imagemagick.org/script/download.php#windows
#
# Sources:
#   void_icons/v3code-cube-isolated.svg  — primary brand mark, used for all app icons
#   void_icons/v3code-cube-platform.svg  — splash/hero composition (not currently piped into a build asset; Void uses programmatic splash via theme colors)
#
# Outputs (overwrites Void's existing icons in place):
#   resources/win32/code.ico               — Windows app icon, multi-resolution (16/32/48/64/128/256)
#   resources/win32/code_150x150.png       — Windows Start Menu tile
#   resources/darwin/code.icns             — macOS app icon, multi-resolution
#   resources/linux/code.png               — Linux app icon (512x512)
#   void_icons/v3code-mark-1024.png        — high-res reference, useful for marketing / Open VSX listing

$ErrorActionPreference = 'Stop'

# Resolve repo root from script location
$repoRoot = Split-Path -Parent $PSScriptRoot
$src = Join-Path $repoRoot 'void_icons\v3code-cube-isolated.svg'
$win32 = Join-Path $repoRoot 'resources\win32'
$darwin = Join-Path $repoRoot 'resources\darwin'
$linux = Join-Path $repoRoot 'resources\linux'
$voidIcons = Join-Path $repoRoot 'void_icons'

if (-not (Test-Path $src)) {
	Write-Error "Brand SVG not found at $src"
	exit 1
}

if (-not (Get-Command magick -ErrorAction SilentlyContinue)) {
	Write-Error "ImageMagick (`magick` command) not on PATH. Install: winget install ImageMagick.ImageMagick"
	exit 1
}

Write-Host "Generating V3Code icons from $src ..."

# Reference high-res PNG (used by Open VSX, marketing, and the Linux icon)
$ref1024 = Join-Path $voidIcons 'v3code-mark-1024.png'
magick -background none -density 600 $src -resize 1024x1024 $ref1024
Write-Host "  ✓ $ref1024"

# Windows app icon — multi-resolution .ico
$winIco = Join-Path $win32 'code.ico'
magick -background none -density 600 $src -define icon:auto-resize=256,128,64,48,32,16 $winIco
Write-Host "  ✓ $winIco"

# Windows Start Menu tile (square)
$winTile = Join-Path $win32 'code_150x150.png'
magick -background none -density 600 $src -resize 150x150 $winTile
Write-Host "  ✓ $winTile"

# macOS .icns — multi-resolution
$macIcns = Join-Path $darwin 'code.icns'
magick -background none -density 600 $src `
	-define icon:auto-resize=1024,512,256,128,64,32,16 $macIcns
Write-Host "  ✓ $macIcns"

# Linux PNG (512 is the conventional install size)
$linuxPng = Join-Path $linux 'code.png'
magick -background none -density 600 $src -resize 512x512 $linuxPng
Write-Host "  ✓ $linuxPng"

Write-Host ""
Write-Host "Icons generated. Next steps:"
Write-Host "  1. Rebuild Electron app: npm run watch (or Ctrl+Shift+B in VS Code)"
Write-Host "  2. Launch dev window:    .\scripts\code.bat --user-data-dir .\.tmp\user-data --extensions-dir .\.tmp\extensions"
Write-Host "  3. New icons appear in taskbar / dock / window chrome"
