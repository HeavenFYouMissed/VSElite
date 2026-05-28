# V3Code Brand Assets

Status of brand assets and where each one gets used. The SVG cube logo and the colored nebula raster variants are by Daniel (Grok Imagine + hand-finishing).

---

## Current assets

| Asset | Location | Purpose | Status |
|---|---|---|---|
| **Cube isolated (SVG)** | [void_icons/v3code-cube-isolated.svg](void_icons/v3code-cube-isolated.svg) | **Primary brand mark.** Source for app icons (.ico/.icns/.png), activity bar, favicon, tray — anywhere the cube alone is the right composition. Scales cleanly to any size from 16×16 favicon to 1024×1024 macOS. Nebula-textured faces in deep purple-blue with gray rock edges. | ✅ Shipped |
| **Cube on platform with aurora (SVG)** | [void_icons/v3code-cube-platform.svg](void_icons/v3code-cube-platform.svg) | **Splash / hero composition.** Full scene: cube floating above a circular platform with green aurora light beam behind it. Use for splash screen, About dialog hero, marketing site hero. Don't use for small icons — the platform + aurora won't read below 256px. | ✅ Shipped |
| Original Void icons (legacy) | `void_icons/logo_cube_noshadow.png`, `slice_of_void.png`, `cubecircled.png`, `code.ico` | Currently used by Void; **replace these in the rebrand sweep** when icons are rendered to PNG/ICO | 🔄 Replace |

---

## Size variants needed (derived from the assets above)

For Windows / macOS / Linux app installer + tray + favicon:

| Variant | Size | Source |
|---|---|---|
| `.ico` (Windows app icon — multi-resolution) | 16, 32, 48, 64, 128, 256 | Generate from `v3code-mark-light.png` or directly from `v3code-cube.svg` |
| `.icns` (macOS app icon — multi-resolution) | 16, 32, 64, 128, 256, 512, 1024 | Same source |
| Linux PNG icons | 16, 32, 48, 64, 128, 256, 512 | Same source |
| Favicon | 32, 192, 512 | Web-only, from SVG |
| Tray icon (Windows) | 16, 32 monochrome | Adapt SVG to single color (white on transparent) |
| Splash screen | 600×400 PNG | `v3code-splash.png` cropped/composed |
| Installer banner (Windows InnoSetup) | 150×57 | New asset — logo + wordmark horizontal layout |
| Open VSX listing | 256×256 | From `v3code-mark-light.png` |

### Conversion pipeline — automated

Two scripts at `scripts/`, pick one based on what you have installed:

**Option A — ImageMagick (preferred):**
```powershell
# One-time install:
winget install ImageMagick.ImageMagick

# Generate everything:
.\scripts\generate-v3code-icons.ps1
```

Outputs:
- `resources/win32/code.ico` (multi-res 16/32/48/64/128/256)
- `resources/win32/code_150x150.png` (Start Menu tile)
- `resources/darwin/code.icns` (multi-res 16-1024)
- `resources/linux/code.png` (512×512)
- `void_icons/v3code-mark-1024.png` (high-res reference for marketing)

**Option B — Pure Node (no ImageMagick install):**
```powershell
# One-time install:
npm install --no-save @resvg/resvg-js png-to-ico png2icons

# Generate everything:
node scripts/generate-v3code-icons.mjs
```

Same outputs. Uses WASM-based SVG renderer (no native compilation, works anywhere Node runs).

### Splash screen — no asset needed

Void inherits VS Code's **programmatic splash** (rendered by `src/vs/workbench/contrib/splash/browser/partsSplash.ts` — paints the editor skeleton in theme colors before the workbench loads). There's no splash PNG to replace. The splash colors will automatically pick up our V3Code palette from the workbench theme — already wired via the CSS changes in `contrib/void/browser/react/src/styles.css` and `contrib/void/browser/media/void.css`.

---

## Where each asset gets wired into the build

These are the file references that need updating after assets land:

| Build target | Reference file | What to change |
|---|---|---|
| Windows installer icon | `build/win32/code.ico` (or wherever VS Code references it) | Replace with new `code.ico` |
| Splash screen | `src/vs/code/electron-sandbox/processExplorer/` or `src/vs/workbench/electron-sandbox/` | Hunt for splash image references |
| Activity bar logo | `product.json` icon references + workbench theme | Set icon path |
| About dialog | `src/vs/workbench/contrib/welcomeBanner/` or similar | Bundled image |
| README / docs / GitHub repo | `README.md`, social preview image | New SVG/PNG |

These touches require editing files OUTSIDE `src/vs/workbench/contrib/void/` — needs Daniel's explicit go-ahead per `.voidrules`. Save the icon files first, then we do the wiring sweep in one batch when greenlit.

---

## Heroicons vs Lucide React — recommendation

Daniel asked about [Heroicons](https://github.com/tailwindlabs/heroicons) for UI icons.

**Status:** Void already ships **`lucide-react@^0.503.0`** as a dependency (see `package.json`). Lucide and Heroicons are aesthetically very similar — both clean minimalist line icons. Lucide is a Feather Icons fork; Heroicons is by the Tailwind team. Either looks professional.

**Recommendation: stick with Lucide for now.** Reasons:
- Already wired in — no new dependency
- Existing Void React components import from `lucide-react`
- Lucide has ~1,500 icons; Heroicons has ~300 — Lucide covers more cases
- Visually compatible — switching to Heroicons later wouldn't disrupt anything

If you specifically want the Heroicons aesthetic for a particular surface (e.g. the onboarding flow), we can `npm install @heroicons/react` and use it side-by-side — they don't conflict. One-liner addition; not blocking anything.

**Useful Lucide icons for V3Code UI** (some recommendations for when we wire up brand accents in React components):
- `Sparkles` — AI assistant indicator (subtle, not cliche)
- `Brain` — agent thinking/processing state
- `Activity` — agent acting / tool execution
- `Bookmark` — saved memory / sticky note
- `Network` — call graph / symbol relationships
- `Search` — find_text fallback
- `Code` — symbol context
- `FileText` — file context
- `Layers` — pack_context bundle
- `Database` — memory store / remember tool
- `CircleDot` — pulsing status indicator
- `MoreHorizontal` — action menu

These are available right now via `import { Sparkles, Brain, ... } from 'lucide-react'` inside any React component in `browser/react/src/`.

---

## What I need from Daniel

1. **Save the two PNG files** from chat to `void_icons/v3code-splash.png` and `void_icons/v3code-mark-light.png` (right-click → Save As).
2. **Confirm icon strategy**: Lucide as primary (recommendation), or add Heroicons too?
3. **Greenlight to touch files outside `contrib/void/`** for wiring the new icons into the build system, OR keep this scoped to inside `contrib/void/` for now and wire icons in a later authorized sweep.
4. **Logo direction preference**: keep the current cube SVG as-is (galaxy texture + gray faces), or commission a simplified abstract variant for small-size contexts (16×16 favicon — current detail level won't read at that size)?

Once items 1 + 3 are done, the full icon swap is a 30-minute sweep.
