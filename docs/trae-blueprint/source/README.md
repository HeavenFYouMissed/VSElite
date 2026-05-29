# Trae / Cursor Source Extraction

These bundles are **local reference only** — gitignored, never committed.

## How to re-extract on a fresh machine

```powershell
# Trae chat module
$traeDest = "docs\trae-blueprint\source"
mkdir $traeDest -Force
Copy-Item "$env:LOCALAPPDATA\Programs\Trae\resources\app\node_modules\@byted-icube\ai-modules-chat\dist\index.mjs" "$traeDest\trae-chat.mjs"
Copy-Item "$env:LOCALAPPDATA\Programs\Trae\resources\app\node_modules\@byted-icube\ai-modules-chat\dist\index.css" "$traeDest\trae-chat.css"

# Cursor workbench
$cursorDest = "docs\cursor-blueprint\source"
mkdir $cursorDest -Force
Copy-Item "$env:LOCALAPPDATA\Programs\cursor\resources\app\out\vs\workbench\workbench.desktop.main.js" "$cursorDest\cursor-workbench.js"
Copy-Item "$env:LOCALAPPDATA\Programs\cursor\resources\app\out\vs\workbench\workbench.desktop.main.css" "$cursorDest\cursor-workbench.css"
```

## What each contains

- **trae-chat.mjs** (12.81 MB, ~7,733 lines) — React chat module. Multi-line dev-build, parseable. Contains all chat panel components, agent UI, layout primitives.
- **trae-chat.css** (1.86 MB) — Full chat styling, all `--vscode-icube-*` variables and `icube-*` classes.
- **cursor-workbench.js** (61.59 MB) — Cursor's full forked workbench. Contains composer, todo system, subagent breadcrumbs, meta-agent. Heavily minified.
- **cursor-workbench.css** (1.99 MB) — Cursor's full styling, glass morphism, 1,381 CSS vars.

## Usage policy

These are studied as **structural reference only** — class names, CSS values, component patterns. We re-implement using V3Code's own JSX/styling. Nothing is copy-pasted verbatim into shipped code.
