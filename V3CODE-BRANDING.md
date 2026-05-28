# V3Code — Branding & Visual Identity Guide

*For use by Daniel and Claude Code when building the Void fork.*
*Design direction: aiwebpad.com's hacker aesthetic, toned down for all-day IDE use.*
*Purple + green + black. Sharp, agentic, alive — not noisy.*

---

## Name

**V3Code**

Domain: **`v3code.dev`** (owned)

Stylization:
- Brand display: **V3Code** (capital V, numeric 3, capital C)
- CLI / file paths / executable: **`v3code`** (lowercase, no hyphen) — `v3code.exe`, `.v3code/`, `v3code-server`, `dev.v3code.code`
- Internal class/variable names: leave Void's existing `VoidOnboarding`, `VoidCommandBar`, etc. for v0.1 (rename in a Phase 2 sweep)

Why it works:
- **Domain locked** — `v3code.dev` ends the naming bikeshed and starts SEO from a clean slate
- **`.dev` TLD** is dev-tool authentic (signals you sought it intentionally)
- Implicit positioning: *"the next version of VS Code"* without ever literally saying it. Reads as an evolution, not a fork
- Visual rhyme with `VS` (V-three vs V-S) — anchors familiarity for VS Code users
- Pronounceable: "vee-three-code" — three syllables, sounds like a tool, not a brand stunt
- No major trademark collision in the dev tool space
- Clean install copy: `npm install -g v3code`, `v3code --help`

Tagline candidates (pick one or iterate):
- *"Code, three steps ahead."*
- *"VS Code with an AI that actually reads your codebase."*
- *"Structural code intelligence, wired in."*
- *"The IDE that never forgets."*

**Recommendation:** lead marketing with *"VS Code with an AI that actually reads your codebase."* — anchors what it is for anyone who's heard of Copilot. Use *"Structural code intelligence, wired in."* in technical docs and README.

---

## Color Palette

### Base (layered blacks — NOT flat black)

These create depth without being distracting. Slight purple tint separates V3Code from generic dark themes.

| Name | Hex | Usage |
|---|---|---|
| Abyss | `#07080C` | Deepest background (editor canvas) — darker than Cursor's `#1E1E1E` by a mile |
| Void | `#0B0D14` | Panels, sidebars — slight blue undertone like aiwebpad's bg |
| Obsidian | `#10121A` | Secondary panels, chat background |
| Slate | `#161820` | Elevated surfaces (dropdowns, modals, hover cards) |
| Ash | `#1C1E27` | Borders, subtle dividers, input backgrounds |
| Smoke | `#252730` | Inactive tabs, muted interactive elements |

> **Note:** Cursor uses ~`#1E1E1E` as its base. Our Abyss (`#07080C`) is dramatically darker.
> The slight blue undertone (`#0B0D14` vs pure `#0B0B0B`) matches the aiwebpad feel —
> not warm, not neutral, slightly cold/blue-dark. This is the "deeper than Cursor" energy.

### Primary Accent — Amethyst (purple)

The intelligence color. Used for AI-related elements, selections, active states, branding.

| Name | Hex | Usage |
|---|---|---|
| Amethyst | `#8B5CF6` | Primary brand color, logo, AI chat accent |
| Amethyst Glow | `#A78BFA` | Hover states, lighter accents |
| Amethyst Deep | `#6D28D9` | Pressed states, darker variant |
| Amethyst Muted | `#7C3AED20` | Selection backgrounds (20% opacity) |
| Amethyst Wash | `#8B5CF610` | Subtle tints on surfaces |

### Secondary Accent — Venom (green)

The alive color. Terminal energy from aiwebpad, toned down. Used for success, memory, agent-active states. *(Color name kept as Venom — accent color, not product name. The injection metaphor still applies to what the color signals: targeted, surgical, alive.)*

| Name | Hex | Usage |
|---|---|---|
| Venom | `#7FE650` | Secondary brand color, terminal, success states |
| Venom Bright | `#9FFF3D` | Sparingly — cursor caret, "alive" indicators |
| Venom Muted | `#7FE65030` | Memory/sticky-note gutter icons (30% opacity) |
| Venom Deep | `#4ADE20` | Terminal prompt accent |

### Semantic Colors

| Name | Hex | Usage |
|---|---|---|
| Error | `#EF4444` | Red — errors, destructive actions |
| Warning | `#F59E0B` | Amber — warnings, caution states |
| Info | `#8B5CF6` | Uses Amethyst — info matches brand |
| Success | `#7FE650` | Uses Venom — success matches brand |

### Text

| Name | Hex | Usage |
|---|---|---|
| Text Primary | `#E4E4ED` | Main text, code |
| Text Secondary | `#9898A6` | Comments, descriptions, muted labels |
| Text Tertiary | `#5A5A6E` | Placeholders, disabled text |
| Text Bright | `#FFFFFF` | Active tab labels, focused input text |

---

## Typography

### UI Chrome (menus, tabs, sidebar, status bar)
- **Font:** Inter or Geist Sans
- **Weight:** 400 (regular) for labels, 500 (medium) for active/selected, 600 (semibold) for headers
- **Size:** 12px sidebar labels, 13px tab labels, 11px status bar

### Code Editor
- **Font:** JetBrains Mono (industry standard, excellent readability)
- **Size:** 14px default, user-configurable
- **Line height:** 1.6

### Branding / Logo Text
- **Font:** Custom angular monospace or Rajdhani / Share Tech Mono / Orbitron
- **Character:** Sharp terminals, geometric, slightly condensed
- **Wordmark:** `V3Code` (mixed case) or `V3CODE` (all caps in tag/title contexts)

### Chat Panel
- **Font:** Same as UI chrome (Inter/Geist) for messages
- **Code blocks in chat:** JetBrains Mono, slightly smaller (13px)

---

## Logo

### Concept

Void's logo is a 3D cube — *"a slice of the void."* Clean, geometric.

V3Code evolves this: same geometric cube DNA, with the **`3`** as a deliberate identity hook.

**Direction options:**

1. **Cube with embedded "3":** the cube has the numeral 3 cut into one face (negative space) or formed by the edges of three stacked cubelets. The "3" becomes the recognition hook.
2. **Stylized V³ wordmark:** "V" + superscript "3" + "Code" — typographic-only mark for the wordmark variant. Could pair with a separate icon.
3. **Geometric V/3 fusion:** "V" formed by the geometric cube's silhouette from one angle, with the "3" emerging from the structure.
4. **Simplest:** the cube outline in white/light grey, with one vertex or edge highlighted in Amethyst (the point of intelligence), and a small "3" inside or beside it.

Pick direction in the asset pipeline. Constraint: must read at 16x16 favicon size — keep complexity low.

### Logo Variants Needed

| Variant | Usage |
|---|---|
| Full mark (icon + "V3Code" wordmark) | Website header, About dialog, splash screen |
| Icon only (the cube + 3) | App icon, taskbar, favicon, VS Code activity bar |
| Monochrome white | Dark backgrounds, loading screens |
| Monochrome black | Light contexts (documentation, print) |

### Logo Colors

- **Icon:** Amethyst `#8B5CF6` primary with Venom `#7FE650` accent detail (one edge, one vertex, or the "3" itself glowing Venom)
- **Wordmark:** `#E4E4ED` (Text Primary) or white
- **Background:** transparent or Void `#0B0D14`

### What to Avoid in the Logo

- No mascots, no characters, no demons/skulls (serious tool energy, not gaming)
- No gradients that look like they're from 2015
- No more than 2 colors in the icon
- Don't make it too complex — must be recognizable at 16x16 favicon size
- Don't lean too hard on the "3" — should read as a tech mark first, "3" second

---

## UI Design Principles

### 1. Toned-Down Hacker (the aiwebpad translation)

The aiwebpad site uses a specific visual language worth studying:

- **Backgrounds:** Nearly black with subtle blue undertone and faint chevron/arrow texture — NOT flat black
- **Green placement is surgical:** terminal dots, button fills, LIVE badges, status codes, interactive shell accents — NOT on large surfaces, NOT on text bodies
- **Monospace dominates** but in a clean, spaced-out way — generous line-height, not cramped
- **The one loud moment:** the neon yellow-green "FOR AI AGENTS" banner — everything else is restrained. In V3Code, the equivalent is the AI-active state — the one moment where color goes loud, and only briefly
- **Stats/data in clean grid layout:** monospace labels, generous spacing, clear hierarchy without borders
- **The mobile chat widget:** dark card, green dot for "READY," monospace prompt, green send button — minimal, functional, alive

For V3Code, translate each element:
- aiwebpad's dark background → Abyss/Void base colors (darker than Cursor)
- aiwebpad's chevron texture → skip (too busy for code editing) but keep the blue undertone in the base
- aiwebpad's green terminal dots → green cursor caret, green gutter dots for memory, green status indicators
- aiwebpad's monospace layout → monospace in status bar, terminal, branding; proportional for sidebar/chat readability
- aiwebpad's "one loud moment" banner → the AI-thinking/acting pulse is the one loud moment in V3Code
- aiwebpad's clean data grids → the `get_symbol_context` output formatting in the chat panel

### 2. Layered Depth, Not Flat

Flat dark themes feel dead. Layered blacks (Void → Obsidian → Slate → Ash) create a sense of depth and hierarchy without borders everywhere. Use background shade changes instead of visible borders where possible.

### 3. Color Restraint

- Most of the UI is greyscale/neutral (the black layers + text colors)
- **Amethyst** appears only where intelligence/AI is present
- **Venom** appears only where something is alive/active/succeeding
- If you removed all color, the UI should still be fully usable — color adds meaning, not structure

### 4. The Agent Mode Transition

When the user switches from editor to agent chat (the tab toggle in top-left):

- The panel background shifts from Obsidian to a slightly warmer tone (barely perceptible)
- A thin Amethyst line appears at the top of the chat panel (the "awake" indicator)
- AI responses have a faint Amethyst border-left (2px) — not a full glow, just a hint
- User messages are plain cards on Slate background
- Typing/thinking indicator: a small Amethyst pulse, not spinning dots

### 5. Memory Indicators (the "never forgets" feel)

- When a symbol has a sticky note attached, a tiny Venom dot appears in the editor gutter (like a green pixel)
- When the AI references a memory in its response, the memory text has a faint Venom tint background
- The AGENTS.md / project journal gets a small icon in the explorer tree — a book icon tinted Amethyst
- These are subtle. The user should *discover* them, not be overwhelmed by them

### 6. Status Bar

- **Background:** Obsidian `#0F0F17`
- **Default state:** muted grey text
- **AI idle:** small Amethyst dot (barely visible — "I'm here")
- **AI thinking:** Amethyst dot pulses slowly
- **AI acting (tool calls):** Venom dot pulses (something is happening)
- **Error state:** Error red dot
- **Memory active:** tiny Venom "M" indicator

---

## Competitive Visual Differentiation

| Editor | Visual Identity | How V3Code Differs |
|---|---|---|
| VS Code | Blue, corporate, neutral | V3Code is darker, sharper, purple-green personality |
| Cursor | Blue accent, clean, professional | V3Code is moodier, more personality, alive-feeling |
| Trae | Blue/teal, TikTok-adjacent, friendly | V3Code is serious, hacker-adjacent, not friendly-cute |
| Void | Dark neutral, minimal, no strong color identity | V3Code has strong color identity and agentic personality |
| Windsurf | Green accent, clean, corporate | V3Code green is different (neon-alive vs corporate-fresh) |
| Zed | Orange/warm, fast-focused | Completely different palette and energy |

**Nobody in the IDE space uses purple + green on layered blacks.** This palette is unique and immediately recognizable.

---

## `product.json` Rebrand Fields

These are the fields in the Void fork's `product.json` that need updating. **Use this as the canonical source — supersedes any earlier brand-naming tables in DEEPSEEK-HANDOFF.md or other docs.**

```json
{
  "nameShort": "V3Code",
  "nameLong": "V3Code",
  "applicationName": "v3code",
  "dataFolderName": ".v3code",
  "win32MutexName": "v3code",
  "serverApplicationName": "v3code-server",
  "serverDataFolderName": ".v3code-server",
  "tunnelApplicationName": "v3code-tunnel",
  "win32DirName": "V3Code",
  "win32NameVersion": "V3Code",
  "win32RegValueName": "V3Code",
  "win32AppUserModelId": "V3Code.Editor",
  "win32ShellNameShort": "V3&Code",
  "win32TunnelServiceMutex": "v3code-tunnelservice",
  "win32TunnelMutex": "v3code-tunnel",
  "darwinBundleIdentifier": "dev.v3code.code",
  "linuxIconName": "v3code",
  "urlProtocol": "v3code",
  "win32x64AppId": "{{NEW-UUID-HERE}}",
  "win32arm64AppId": "{{NEW-UUID-HERE}}",
  "win32x64UserAppId": "{{NEW-UUID-HERE}}",
  "win32arm64UserAppId": "{{NEW-UUID-HERE}}",
  "extensionsGallery": {
    "serviceUrl": "https://open-vsx.org/vscode/gallery",
    "itemUrl": "https://open-vsx.org/vscode/item"
  },
  "reportIssueUrl": "https://github.com/<v3code-org>/v3code/issues/new",
  "licenseUrl": "https://github.com/<v3code-org>/v3code/blob/main/LICENSE.txt",
  "linkProtectionTrustedDomains": [
    "https://v3code.dev",
    "https://github.com/<v3code-org>/v3code",
    "https://ollama.com"
  ]
}
```

Also grep for `Void` in:
- About dialog strings
- Splash screen text
- Window title format
- Onboarding flow text
- Any user-facing strings in `contrib/void/`

---

## Icon Assets Needed

Replace everything in `void_icons/` with V3Code versions:

| Asset | Size(s) | Notes |
|---|---|---|
| App icon (Windows `.ico`) | 16, 32, 48, 256 | Cube + 3 in Amethyst+Venom |
| App icon (macOS `.icns`) | 16-1024 | Same icon, macOS format |
| App icon (Linux `.png`) | 128, 256, 512 | Same icon, PNG |
| Splash/loading image | 600x400 | V3Code logo centered on Void background |
| Favicon | 32x32 | Simplified cube + 3 |
| Tray icon (Windows) | 16x16 | Monochrome white version |
| Installer banner (Windows) | 150x57 | Logo + wordmark, horizontal |
| Open VSX listing icon | 256x256 | Full mark (icon + wordmark) |

### Daniel's Asset Pipeline (from memory)

Grok Imagine with reference image anchoring → optional hand-redraw → background removal → drop into asset folder. Daniel has portrait and tattoo art skills (pencil, colored pencil, airbrush) and can hand-redraw AI-generated assets — use this for the final icon polish.

---

## CSS Variables (for the VS Code theme engine)

When implementing the V3Code theme in the fork, these map to VS Code's theme color API:

```json
{
  "editor.background": "#07080C",
  "editor.foreground": "#E4E4ED",
  "sideBar.background": "#0B0D14",
  "sideBarTitle.foreground": "#9898A6",
  "activityBar.background": "#07080C",
  "activityBar.foreground": "#8B5CF6",
  "activityBar.activeBorder": "#8B5CF6",
  "statusBar.background": "#0B0D14",
  "statusBar.foreground": "#9898A6",
  "titleBar.activeBackground": "#0B0D14",
  "titleBar.activeForeground": "#E4E4ED",
  "tab.activeBackground": "#10121A",
  "tab.activeForeground": "#E4E4ED",
  "tab.inactiveBackground": "#0B0D14",
  "tab.inactiveForeground": "#5A5A6E",
  "tab.activeBorderTop": "#8B5CF6",
  "editor.selectionBackground": "#7C3AED30",
  "editor.selectionHighlightBackground": "#7C3AED15",
  "editorCursor.foreground": "#7FE650",
  "terminal.background": "#07080C",
  "terminal.foreground": "#E4E4ED",
  "terminal.ansiGreen": "#7FE650",
  "terminal.ansiBrightGreen": "#9FFF3D",
  "terminal.ansiMagenta": "#8B5CF6",
  "terminal.ansiBrightMagenta": "#A78BFA",
  "list.activeSelectionBackground": "#7C3AED25",
  "list.activeSelectionForeground": "#E4E4ED",
  "list.hoverBackground": "#10121A",
  "focusBorder": "#8B5CF680",
  "input.background": "#10121A",
  "input.border": "#1C1E27",
  "input.foreground": "#E4E4ED",
  "button.background": "#8B5CF6",
  "button.foreground": "#FFFFFF",
  "button.hoverBackground": "#A78BFA",
  "badge.background": "#7FE650",
  "badge.foreground": "#07080C",
  "panel.background": "#0B0D14",
  "panel.border": "#1C1E27",
  "editorLineNumber.foreground": "#5A5A6E",
  "editorLineNumber.activeForeground": "#9898A6",
  "editorGutter.addedBackground": "#7FE650",
  "editorGutter.modifiedBackground": "#8B5CF6",
  "editorGutter.deletedBackground": "#EF4444",
  "gitDecoration.addedResourceForeground": "#7FE650",
  "gitDecoration.modifiedResourceForeground": "#8B5CF6",
  "gitDecoration.deletedResourceForeground": "#EF4444",
  "scrollbarSlider.background": "#25273050",
  "scrollbarSlider.hoverBackground": "#25273080",
  "scrollbarSlider.activeBackground": "#8B5CF650",
  "minimap.background": "#07080C",
  "editorWidget.background": "#10121A",
  "editorWidget.border": "#1C1E27",
  "peekView.border": "#8B5CF680",
  "peekViewTitle.background": "#0B0D14",
  "peekViewResult.background": "#0B0D14",
  "peekViewEditor.background": "#07080C",
  "debugToolBar.background": "#10121A",
  "notifications.background": "#10121A",
  "notifications.border": "#1C1E27"
}
```

---

## Launch Checklist (Visual/Brand)

- [ ] Generate logo concepts (Grok Imagine → hand-redraw → finalize)
- [ ] Create all icon sizes from final logo
- [ ] Implement CSS variables as VS Code theme in the fork
- [ ] Update `product.json` with all V3Code branding strings
- [ ] Generate new Win32 UUIDs for app IDs
- [ ] Replace all `void_icons/` assets
- [ ] Grep and replace all user-facing "Void" strings
- [ ] Design splash/loading screen
- [ ] Screenshot the final product for Open VSX listing
- [ ] Build `v3code.dev` landing page — aiwebpad-style, toned down, terminal-feel hero
- [ ] Register npm scope (if any public surface) — `v3code` namespace
- [ ] Register GitHub org — `v3code` or under existing KandD Labs umbrella

---

*Branding guide for V3Code. Fork of Void Editor (Apache 2.0). Domain: `v3code.dev`. Design direction: aiwebpad.com hacker aesthetic refined for professional daily use. Purple (intelligence) + Green (alive) + Black (depth). Built by Daniel, KandD Labs.*
