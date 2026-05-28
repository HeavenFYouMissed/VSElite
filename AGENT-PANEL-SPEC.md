# V3Code Agent Panel — Design Spec

## The "Holy Shit" Moment

User opens V3Code, sees a button. Clicks it. The entire editor transforms into an agent-first workspace. Context Bridge auto-loads. The agent already knows their codebase.

---

## Concept

Three modes, toggled by a single indented button in the title bar (inspired by Trae's design):

```
┌──────────────────────────────────────────────────────┐
│  V3Code  │ [Agent: ON ◆] │  Project name            │
├──────────┴───────────────┴──────────────────────────┤
│                                                      │
│   ┌─ Editor (agent chat replaces sidebar) ────────┐ │
│   │                                                │ │
│   │  [Chat 1] [Chat 2] [+]                        │ │
│   │  ┌──────────────────────────────────────────┐ │ │
│   │  │ Agent: What should I build?              │ │ │
│   │  │ You: Refactor the auth module            │ │ │
│   │  │ Agent: (streaming) Analyzing...          │ │ │
│   │  └──────────────────────────────────────────┘ │ │
│   │  [Attach files] [@symbol] [Browser] [Phone]  │ │ │
│   │                                                │ │
│   └────────────────────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Three Modes

### Mode 1: Normal (default)
- Regular VS Code. Sidebar has file explorer. Chat is a side panel (Ctrl+L like Void).
- Agent toggle is OFF.

### Mode 2: Agent Side Panel
- Toggle ON → sidebar slides to agent chat. File explorer moves to a compact secondary bar.
- Chat is the dominant UI. Agent has context bridge.
- The editor area still shows code, agent edits stream in.

### Mode 3: Full Agent (the "holy shit" mode)
- Toggle to full → the editor BECOMES the agent. Chat takes the main area.
- Code opens in a split or pop-out. Agent can spawn multiple chat threads.
- Side panel holds: Browser preview, File tree (compact), Terminal output, Symbol explorer.
- This is the mode that makes people tweet screenshots.

## The Toggle Button

```
┌──────────────┐
│  ◆ AGENT ON  │  ← Indented into the title bar, Trae-style
└──────────────┘
```

States:
- **Off** (gray) — Normal VS Code
- **On** (purple glow) — Agent side panel active
- **Full** (purple + border) — Full agent mode

Click cycles: Off → On → Full → Off

## Multi-Chat Tabs

Top of the agent panel: tabs for multiple chat threads.

```
[Chat 1 ●] [Chat 2] [Chat 3 ○] [+ New]
```

- `●` = active, `○` = idle/background
- Each chat is an independent agent session
- Background chats continue running
- Drag to reorder, right-click to close/rename
- This is the "cursor killer" feature — nobody else has real multi-chat

## Side Panel Tools (in Full Agent mode)

┌──────────────────┐
│ 📁 Files (mini)  │  ← Compact file tree, 2-3 levels
│ 🌐 Browser       │  ← Integrated browser view
│ ⚡ Terminal      │  ← Last command output
│ 🔍 Symbols       │  ← Context Bridge outline
│ 📱 Phone Preview │  ← Mirrored view for phone
└──────────────────┘

## Browser + Phone Preview

Two buttons in the chat toolbar:

- **🌐 Browser** — Opens integrated browser (Void has WebView, use that). Renders the app.
- **📱 Phone** — Shrinks browser to phone size + PNG bezel overlay. User's high-quality transparent PNG wraps it.

```
┌─────────────────┐
│ ┌─────────────┐ │
│ │             │ │  ← Phone bezel PNG (user's transparent overlay)
│ │  App Here   │ │
│ │             │ │
│ └─────────────┘ │
└─────────────────┘
```

## Implementation Plan

### Phase 1: Toggle + Side Panel (this sprint)
1. Add toggle button to title bar (`void.contribution.ts` + new `agentToggleAction.ts`)
2. Wire toggle states in `sidebarPane.ts`
3. Multi-chat tabs in `SidebarThreadSelector.tsx` (already exists!)
4. Side panel tools area in `Sidebar.tsx`

### Phase 2: Full Agent Mode (next sprint)
5. Layout switch: chat takes main editor area
6. Side panel with browser/files/symbols
7. PNG phone bezel overlay + browser resize

### Phase 3: Multi-Chat Engine (after Context Bridge)
8. Independent agent sessions per tab
9. Background agent execution
10. Session persistence

## Files to touch

- `browser/void.contribution.ts` — register toggle + commands
- `browser/sidebarPane.ts` — mode-aware sidebar
- `browser/react/src/sidebar-tsx/Sidebar.tsx` — multi-chat layout
- `browser/react/src/sidebar-tsx/SidebarThreadSelector.tsx` — tab bar
- `browser/react/src/sidebar-tsx/SidebarChat.tsx` — chat UI
- `browser/react/src/void-editor-widgets-tsx/VoidCommandBar.tsx` — toggle button
- New: `browser/agentPanelService.ts` — mode state machine
- New: `browser/react/src/sidebar-tsx/AgentToolbar.tsx` — browser/phone buttons
- New: `browser/react/src/sidebar-tsx/PhonePreview.tsx` — phone bezel + browser
