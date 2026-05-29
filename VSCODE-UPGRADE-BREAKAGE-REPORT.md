# Empirical Breakage Report — VSElite/V3Code (1.99.3) → VS Code 1.122.0

> Generated 2026-05-29 by **statically dry-running the upgrade against vanilla VS Code 1.122.0**,
> with **zero changes to the real repo, branch, or working tree** (analysis done against
> git trees + a throwaway `/tmp` copy). This is the "what would break" map.
>
> **Method:** fetched vanilla `1.99.3` (our true ancestor) and `1.122.0` tags from
> `microsoft/vscode`; 3-way-merged our upstream touchpoints; resolved every cross-module
> import and named symbol our `contrib/void` code pulls from core against the 1.122 tree.

---

## Headline verdict: the upgrade is GREEN. Surprisingly clean.

| Test | Result |
|---|---|
| `contrib/void` → core **module imports** that break in 1.122 | **0 of 570** |
| `contrib/void` → core **named symbols** that moved/vanished | **2 of 761** (trivial) |
| Upstream **touchpoint files** with merge conflicts | **7** (all small) |
| Upstream touchpoint files that **moved** (layer rename) | **2** |
| Your **152 added** `contrib/void` files | carry over unchanged |

Your chat's structural dependency on VS Code core is **almost entirely stable across 23
versions**. Nothing found suggests a rewrite. The work is small, surgical re-application
plus runtime adaptation.

---

## 1. Symbol drift (2 fixes, ~2 lines total)

`colorRegistry.ts` was split upstream into `theme/common/colors/*.ts`. Two tokens moved:

| Symbol | Old import (1.99.3) | New location (1.122) |
|---|---|---|
| `inputBackground` | `vs/platform/theme/common/colorRegistry` | `vs/platform/theme/common/colors/inputColors` |
| `inputForeground` | `vs/platform/theme/common/colorRegistry` | `vs/platform/theme/common/colors/inputColors` |

**Fix:** update the import path in the void file(s) that use them. That's the entire symbol-level breakage.

## 2. Upstream touchpoint merge conflicts (7 files — small, manual 3-way)

These are upstream files you edited that upstream *also* changed. Conflicts are minor:

| File | Conflict hunks | Nature |
|---|---|---|
| `src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts` | 6 | Largest — your watermark/branding customization vs upstream watermark changes |
| `src/vs/workbench/contrib/chat/browser/actions/chatActions.ts` | 2 | Your hooks into the chat action surface |
| `src/vs/workbench/contrib/chat/browser/chatParticipant.contribution.ts` | 2 | Chat participant registration tweaks |
| `src/vs/workbench/services/themes/common/workbenchThemeService.ts` | 2 | Theme service edit |
| `src/vs/workbench/workbench.common.main.ts` | 2 | Void contribution registration (re-add your import lines) |
| `src/vs/workbench/browser/layout.ts` | 1 | Layout tweak |
| `src/vs/workbench/browser/workbench.contribution.ts` | 1 | Workbench config tweak |

**Fix:** resolve each with `git diff 1.99.3 HEAD -- <file>` as the spec for what you added; re-apply on top of 1.122.

## 3. Upstream files that MOVED — the `electron-sandbox → electron-browser` rename

VS Code renamed the `electron-sandbox` layer to `electron-browser`. Two files you edited moved:

| Your edit (1.99.3 path) | New path in 1.122 |
|---|---|
| `src/vs/workbench/electron-sandbox/desktop.contribution.ts` | `src/vs/workbench/electron-browser/desktop.contribution.ts` |
| `src/vs/workbench/electron-sandbox/parts/dialogs/dialogHandler.ts` | `src/vs/workbench/electron-browser/parts/dialogs/dialogHandler.ts` |

**Fix:** re-apply your edits to the new `electron-browser/` paths. Good news: your
`contrib/void` code has **0 literal `electron-sandbox` references** and **0 broken imports**
from the rename, so the blast radius is just these 2 touchpoints.

## 4. Your 152 `contrib/void` files

All carry over **unchanged at the file level** — they're additions, and 0 of their 570 core
imports break. They will *compile* against 1.122 modulo the 2 symbol fixes above (and any
signature-level drift not detectable statically — see limits).

---

## What this analysis CANNOT see (do not skip these — they need a real build)

Static import/symbol checks prove the *shapes* line up. They do **not** catch:
- **Changed function/constructor signatures** (same symbol name, new/changed params or types) — surfaces only under `tsc`.
- **Changed interface/type shapes** consumed by void.
- **Runtime/behavioral** changes: **Electron 35→37 / Node 20→22** (the `navigator` global now exists in the ext host), **EditContext** input default-on (1.101), **webview CSS anchor-positioning rework** (1.118/1.119) — your React chat is a webview, this is the most likely runtime snag.
- **The React/esbuild bundle** under `contrib/void/browser/react/` (its own deps/build).
- **New default themes** (1.113) color-token reconciliation.
- Removing the **built-in Copilot** extension that upstream bundles from 1.116.

**Realistic expectation:** file-level merge is a few hours. The time sink is iterating on
`tsc` signature errors and getting the React chat webview to render/behave on the new
runtime — bounded, not a rewrite.

---

## Reproduce this analysis yourself

```bash
git remote add vscode https://github.com/microsoft/vscode.git
git fetch --depth 1 vscode refs/tags/1.99.3:refs/tags/vanilla-1.99.3
git fetch --depth 1 vscode refs/tags/1.122.0:refs/tags/vanilla-1.122.0
git diff --stat vanilla-1.99.3 HEAD          # your full fork delta
# 3-way merge a touchpoint to preview its conflict:
git merge-file -p <(git show HEAD:FILE) <(git show vanilla-1.99.3:FILE) <(git show vanilla-1.122.0:FILE)
```
