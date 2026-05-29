# V3Code VIBE / DEV Mode — Progress Log

Live record of what's built, what's changed, and how the pieces connect.

## May 28, 2026 — Session Lessons

### Build Pipeline (CRITICAL — got this wrong twice)
1. `npm run buildreact` — builds React TSX to `react/out/`
2. `npx gulp compile-client` — **MUST run AFTER buildreact**. Gulp copies React `out/` into VS Code output tree at compile time.
3. Launch `.\scripts\code.bat` from `vselite/` directory
4. Pre-existing gulp bug: randomly fails with `ENOENT: markerService.test.js`. Workaround: create stub at `out/vs/platform/markers/test/common/markerService.test.js`

### What NOT to do
- Don't build UI from scratch — use the existing working components and enhance them
- Don't break working features (model picker, reasoning slider, @ mention)
- Don't add placeholder buttons that don't work
- Don't remove functionality when adding new UI
- ChatCore components in `react/src/ChatCore/` are available but should only be used when they fully replace AND improve existing functionality

### Render chain (verified)
1. `Sidebar.tsx` → DEV mode renders `SidebarChat`, VIBE mode renders `VibeAgentPanel`
2. `SidebarChat.tsx` → `inputChatArea` = `<VoidChatArea>` (has working model dropdown, reasoning slider, @ mention)
3. React runs directly in VS Code DOM (NOT a webview) — imports resolved by gulp at compile time

## Mode model

`VIBE` is the agent-forward layout. `DEV` is the standard VS Code layout.
There is **no zen mode** involved. Switching modes only toggles which
workbench parts are visible — files stay reachable via the activity bar.

| Mode | Sidebar (file explorer) | Auxiliary Bar (chat) | Editor |
|------|-------------------------|-----------------------|--------|
| DEV  | restored to user state  | restored to user state | normal |
| VIBE | hidden                  | shown — takes the freed canvas | hidden (snapshot/restored on exit) |

State is persisted per-workspace in storage (`v3code.vibeMode`).
`enterVibe()` hides SIDEBAR_PART, PANEL_PART, **and EDITOR_PART** so the
auxiliary bar expands across the whole window. `exitVibe()` restores from the
snapshot taken on entry. Activity bar + status bar stay visible — files
remain one click away.

## Files in play

```
src/vs/workbench/contrib/void/browser/
├── vibeModeService.ts          ← state machine, layout switching
├── vibeModeActions.ts          ← command palette + keybinding
└── react/src/sidebar-tsx/
    ├── Sidebar.tsx             ← root entry, conditional render
    ├── VibeToggleButton.tsx    ← polished slide-pill toggle
    ├── VibeAgentPanel.tsx      ← full VIBE UI (9 tool tabs + chat)
    ├── VibeTodoPlan.tsx        ← plan / todo widgets
    ├── VibeComponents.tsx      ← shared pill / button atoms
    └── V3Icons.tsx             ← line-icon SVG set (no emoji)
```

React DI whitelist: `react/src/util/services.tsx` — `IVibeModeService`
registered via string key with a safe fallback.

## VibeToggleButton design (current)

- Slide-pill, 132×26, two halves: `DEV | VIBE`.
- Pressed half is "sunk-in" — inset shadow + accent gradient + glow.
- Inactive half is flat dark, dim text.
- The thumb slides with cubic-bezier on toggle.
- No emoji, no icons inside the pill — just letterspaced labels.

## Render chain (one trip through the React tree)

1. `Sidebar` runs, calls `useAccessor()`.
2. Tries `accessor.get('IVibeModeService')` (string key).
3. Subscribes to `onDidChangeMode`, mirrors mode to React state.
4. If `vibe`: returns `<VibeAgentPanel />` (no DEV chrome).
5. If `dev`: returns the standard chat layout with `<VibeToggleButton />` in the header.

## Chat composer (SuperClaw-style upgrade — shipped)

Edits to `react/src/sidebar-tsx/SidebarChat.tsx`:

- **`VoidChatArea` wrapper** — now `rounded-2xl`, `p-3`, `border-void-border-3`.
  - `focus-within:` brightens the border to violet `#8B5CF6` and adds a soft
    3px violet halo plus a subtle top inset highlight. Real "presence."
  - `transition-[border-color,box-shadow] duration-200` for a smooth focus glow.
- **Toolbar row** (bottom of composer, left side):
  - Functional `@` mention button (lucide `AtSign`) — inserts `@` into the
    textarea and dispatches an `input` event so the existing mention menu
    triggers naturally. Hover state: text and bg both lift.
  - Chat-mode dropdown + Model dropdown remain in the same row.
- **Textarea** — `min-h-[80px]` (was `60px`). About 4 lines tall by default,
  grows on type, scrolls past ~8.
- **`ButtonSubmit`** — now a violet gradient (`#8B5CF6 → #6D28D9`) with an
  outer glow + inner highlight, brightens on hover. Disabled state keeps the
  themed neutral button bg so it doesn't shout when there's no input.
- File-changes summary above the input is **already** rendered by
  `CommandBarInChat` (existing component) — we did not add a duplicate.

The existing chat pipeline (streaming, reasoning dropdown, model selector,
DeepSeek, MCP, `@` mention menu, edit-message bubble) is untouched.

### Next composer steps (not yet shipped)
- `#` tags button and attachment button (need backend wiring before the
  buttons can be added — no placeholder UI per house rules).
- Agent-mode pill inside the composer toolbar.
- File-changes summary bar with explicit "No files with changes" /
  "N files changed — Done" wording (currently lives inside `CommandBarInChat`).

## Build commands (do not deviate)

```powershell
$env:PATH = "C:\nvm4w\nodejs;" + $env:PATH
cd c:\Users\heave\Desktop\mcp\vselite

npm run buildreact          # ~8s — react/out/*/index.js
npx gulp compile-client     # ~2.5 min — out/vs/**/*.js + out/main.js
.\.build\electron\V3Code.exe . --disable-extension=vscode.vscode-api-tests
```

`npx gulp compile` is broken (crashes on `pathCompletionFixtures/about.css`). Use `compile-client`.

## Gotchas

- **React accessor is a whitelist, not VS Code DI.** Any service used by
  React must be added to `getReactAccessor()` in `services.tsx` AND retrieved
  via string key (`accessor.get('IVibeModeService')`). Passing the decorator
  object silently returns `undefined`.
- **`Sidebar.tsx` imports `IVibeModeService` as `type` only.** The actual
  value retrieval goes through the whitelist by string. Importing the
  decorator as a value works but pollutes bundle size.
- **Layout API:** `IWorkbenchLayoutService.setPartHidden(hidden, Parts.X)`.
  `Parts.SIDEBAR_PART` is the file explorer side. `Parts.AUXILIARYBAR_PART`
  is the secondary side (where the chat lives).
- **NO emoji.** All visual glyphs are SVG via `V3Icons.tsx`. Typographic
  characters (`○ ◉ ✓ ✗`) are allowed for status markers.

## Recent changes

- `2026-05-27` — Built ChatCore component library from Trae-extracted patterns:
  - `InputBox.tsx` — Multi-line auto-resize textarea (Trae ekm/eku/ekc patterns)
  - `Composer.tsx` — Full input area with toolbar (@ mention, agent mode pill, model selector, submit)
  - `ChatContainer.tsx` — Shared container for sidebar/fullpanel/inline layouts with DEV/VIBE pill toggle
  - `MessageThread.tsx` — Messages, tool call cards, inline diff cards, thought process, checkpoints
  - `FileChangeSummaryBar.tsx` — Expandable file changes list above input
- `2026-05-27` — Integrated Composer into SidebarChat.tsx, added controlled inputValue state
- `2026-05-27` — Studied Trae bundle (12MB) — extracted textarea, input wrapper, char count, zoom toggle patterns
- `2026-05-27` — Studied Cursor bundle (61MB) — identified chat patterns, composer structure
- `2025-XX-XX` — Replaced zen-mode approach with layout-service part hiding.
- `2025-XX-XX` — Rewrote `VibeToggleButton` as a slide-pill, removed all icons/emoji from inside the button.
- `2025-XX-XX` — Added `V3Icons.tsx`, replaced emoji in `VibeAgentPanel` and `VibeTodoPlan` headers.
- `2025-XX-XX` — `IVibeModeService` whitelisted in React accessor with safe fallback.
- `2025-XX-XX` — `Sidebar.tsx` now uses `accessor.get('IVibeModeService')` (string key).
