# Upgrade Target Comparison — 1.122 vs 1.113 vs 1.105

> Measured 2026-05-29 against your **latest `origin/main`** `contrib/void` (which removed
> ~7,260 lines vs the prior version — the fork is now leaner). Base is still 1.99.3.
> 1.123 is **not released** (newest upstream tag is 1.122; 1.123 ≈ June). All numbers are
> from static import/symbol resolution + 3-way touchpoint merges; no working-tree changes.

## Results

| Metric | 1.122 (newest) | 1.113 | 1.105 |
|---|---|---|---|
| Broken module imports (of 646) | 0 | 0 | 0 |
| Broken symbols (of 854) | 2 | 2 | 2 |
| Touchpoint conflict files (of 25) | 8 | 7 | 5 |
| Total conflict hunks | ~17 | ~15 | ~7 |
| Files moved (electron-sandbox→electron-browser) | 2 | 2 | 2 |
| Integrated browser (1.109) | ✅ | ✅ | ❌ |
| `editor-browser` debug (1.112) | ✅ | ✅ | ❌ |
| Mermaid + HTML preview (1.121) | ✅ | ❌ | ❌ |
| **Device emulation + element picker (1.122)** | ✅ | ❌ | ❌ |

The 2 broken symbols are identical on every target: `inputBackground` / `inputForeground`
moved from `colorRegistry.ts` to `colors/inputColors.ts` (the split predates 1.105). One-line
import fix.

## Conflict files by target (hunk counts)

- **1.105 (5 files):** layout.ts(1), editorGroupWatermark.ts(1), chatActions.ts(1), chatParticipant.contribution.ts(3), workbenchThemeService.ts(1)
- **1.113 (7 files):** editorOptions.ts(1), layout.ts(1), editorGroupWatermark.ts(6), chatActions.ts(2), chatParticipant.contribution.ts(2), workbenchThemeService.ts(2), workbench.common.main.ts(1)
- **1.122 (8 files):** above + workbench.contribution.ts(1), workbench.common.main.ts(2)
- All three: `electron-sandbox/{desktop.contribution,parts/dialogs/dialogHandler}.ts` MOVED → `electron-browser/`

## Verdict: target **1.122**

Going 1.105 → 1.122 adds only **~3 conflict files / ~10 hunks** — an hour of difference. But:
- **1.105** has **no browser** (integrated browser starts 1.109).
- **1.113** has the browser + debug but **no device emulation, no Mermaid, no HTML preview**.
- **1.122** is the **only** target with the full browser suite (emulation, element picker,
  Mermaid, HTML preview) — for ~2 hunks more than 1.113.

The fallback premise ("newer = much harder") does not hold here; newer is marginally harder
and strictly more capable. **Do not fall back — upgrade to 1.122.** Re-test if/when 1.123
tags (expect a near-identical, very small delta).
