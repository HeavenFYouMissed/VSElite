# V3CODE UI EXTRACTION SPEC v2 — FINAL DESIGN DECISIONS

## PHILOSOPHY: Take Trae's layout + panel system. Take Cursor's chat + picker popups. Keep all existing V3Code services working.

---

## WHAT TO TAKE FROM EACH

### FROM TRAE (primary layout source — smaller codebase, cleaner patterns):
- Panel stacking system (Flow / Editor / Browser / DiffView / Agents tabs across the top)
- Browser/Preview panel — the FULL thing: URL bar, back/forward/reload, "Enter URL or select a running service", tabs, Select button, Deploy button, mobile/desktop responsive toggle
- DiffView panel — side-by-side diff viewer as a tab
- SOLO mode layout — chat left, panels right, clean split
- Tools dropdown (DocView, Terminal, Figma, Supabase, Integrations, MCP, Settings)
- Button styling — take Trae's exact button shapes, sizes, border-radius, padding
- Chat input bottom bar — @ # buttons, model selector, mic, submit arrow layout
- The "You are chatting with Agent now" status bar above input
- Agent/SOLO Agent toggle styling

### FROM CURSOR (chat quality + popups):
- Chat composer placeholder: "Plan, Build, / for commands, @ for context"
- Slash command popup — when you type `/` shows: Plan, Debug, Multitask, Ask, Image, Models, Skills, MCP Servers
- Model picker popup — searchable dropdown with Auto toggle, MAX Mode toggle, model list with speed labels (Fast, High, Medium)
- Agent mode picker — Agent ✓, Plan, Debug, Multitask, Ask with icons
- Chat tab system — tabs across top of chat panel showing conversation names
- Inline rendering in chat — how code blocks, tables, diffs render in the message stream
- File changes bar — "> 1 File" with Undo and Review buttons
- Context window popup — showing token breakdown (System prompt, Tools, Rules, etc.)

### FROM NEITHER (V3Code original):
- Context Bridge tool calls in chat (unique to V3Code)
- DEV/VIBE toggle (keep the pill toggle already built)
- Shader welcome screen
- Purple/green branding
- All existing service integrations (ModelDropdown, ChatModeDropdown, ReasoningSlider, VoidInputBox2)

---

## LAYOUT: AGENT MODE (VIBE)

Remove the current broken VibeAgentPanel. Replace with this:

```
┌──────────────────────────────────────────────────────────────────────┐
│  File  Edit  Selection  View  Go  Run  Terminal  Help               │
├─────────────────────────────────┬────────────────────────────────────┤
│                                 │  Flow │ Editor │ Browser │ DiffView│ Agents │
│         CHAT (full height)      ├────────────────────────────────────┤
│                                 │                                    │
│  Messages...                    │   [Active panel content]           │
│                                 │   Browser: URL bar + preview       │
│  Agent response with diffs...   │   DiffView: side-by-side diff      │
│                                 │   Editor: code editor              │
│  Tool calls inline...           │   Agents: agent management         │
│                                 │                                    │
│                                 │                                    │
├─────────────────────────────────┤                                    │
│ @Agent                          │                                    │
│ You are chatting with Agent now │                                    │
├─────────────────────────────────┤                                    │
│ Plan, Build, / for commands...  │                                    │
│                                 │                                    │
│ ∞ Agent ▾  deepseek-r ▾  🎤 ➤ │                                    │
├─────────────────────────────────┴────────────────────────────────────┤
│                         DEV  [VIBE]                                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Panel tabs (right side, take from Trae):
- **Flow** — shows the agent's task flow / plan view
- **Editor** — drops back to normal code editor view
- **Browser** — full browser preview with URL bar, tabs, deploy
- **DiffView** — side-by-side diff of current changes
- **Agents** — agent management (Chat, Agent, SOLO Agent, custom agents)

### How panels stack (like Cursor's tab system):
- Tabs across the top of the right panel
- Only one panel visible at a time
- Click a tab to switch
- The chat on the left stays constant — panels change on the right
- When agent makes a file change, auto-switch to DiffView
- When agent opens a preview, auto-switch to Browser

---

## LAYOUT: DEV MODE

Standard VS Code layout. Chat in the right sidebar. No panel tabs — just the chat.

```
┌──────────────────────────────────────────────────────────────────────┐
│  File  Edit  Selection  View  Go  Run  Terminal  Help               │
├──────────┬───────────────────────────────────┬───────────────────────┤
│ Explorer │                                   │  CHAT                 │
│          │         EDITOR                    │                       │
│ Files... │                                   │  Messages...          │
│          │         Code here                 │                       │
│          │                                   │  Agent response...    │
│          │                                   │                       │
│          │                                   ├───────────────────────┤
│          │                                   │ Plan, Build, / ...    │
│          │                                   │ ∞ Agent ▾  model ▾ ➤ │
├──────────┴───────────────────────────────────┴───────────────────────┤
│ Problems │ Output │ Terminal │ Debug Console     DEV  [VIBE]         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## CHAT COMPOSER — What to build

### Step 1: REVERT to working state
```
git checkout react/src/sidebar-tsx/SidebarChat.tsx
npm run buildreact && npx gulp compile-client
```
Confirm model selector, chat mode, reasoning slider all work again.

### Step 2: Restyle VoidChatArea (don't replace it)

Change the placeholder to: "Plan, Build, / for commands, @ for context"

Rearrange the bottom toolbar to match Cursor's layout:
```
Left side:  ∞ Agent ▾    deepseek-reasoner ▾    [ReasoningSlider if applicable]
Right side: 🎤  ➤  (mic optional, submit button)
```

Keep these EXISTING components — just restyle them:
- ChatModeDropdown → restyle as pill, rename: normal→"Ask", gather→"Plan", agent→"Agent"
- ModelDropdown → restyle as pill showing model name
- ReasoningOptionSlider → keep inline
- VoidInputBox2 → keep (has working @ mentions), increase min-height to 80px
- ButtonSubmit/ButtonStop → keep violet gradient
- CommandBarInChat → keep above input (file changes bar)

### Step 3: Add status bar above input
Like Trae: "@Agent ✖  You are chatting with Agent now. Type '/' for more capabilities"

### Step 4: Add slash command popup
When user types `/` at start of input, show dropdown above input:
- Agent (∞ icon) — sets chat mode to agent
- Plan (list icon) — sets chat mode to gather
- Ask (chat icon) — sets chat mode to normal
- Debug (bug icon) — sets chat mode to agent + prepends "Debug: " to message
- Models → (submenu showing ModelDropdown options)
- MCP → (submenu showing connected MCP servers)

On selection: set the mode, clear `/` from input, focus back on input.

---

## BROWSER PANEL — Take fully from Trae

### Grep the Trae bundle:
```
grep -n "browser\|Browser\|preview\|Preview\|iframe\|urlbar\|url.*input\|navigate\|Deploy" docs/trae-blueprint/source/trae-chat.mjs | head -50
grep -n "browser\|Browser\|preview\|Preview" docs/trae-blueprint/source/trae-chat.css | head -30
```

### What to extract:
- URL bar component: "Enter URL or select a running service" with dropdown
- Navigation: back/forward/reload buttons (left of URL bar)
- Tab system: Preview × | + (new tab)
- Toolbar buttons: console toggle, responsive mode, view source, element selector, #, Select, Deploy
- The iframe/webview that renders the preview
- Auto-detect running dev servers on localhost ports
- Mobile/responsive viewport toggle

### Implementation:
- Create as a new panel component that renders in the right side of VIBE mode
- Use VS Code's webview API for the iframe
- Register as one of the panel tabs (Flow / Editor / Browser / DiffView / Agents)

---

## DIFFVIEW PANEL — Take from Trae

### What Trae's DiffView shows (Image 4):
- Split view: old file left, new file right
- File header: `index.ts  mcp-server/src/index.ts  +38 -1`
- Close X button
- Full syntax highlighting in both panes
- Red/green highlighting for changes

### Implementation:
- Use VS Code's built-in diff editor (already exists as VoidDiffEditor)
- Register as a panel tab in VIBE mode
- When agent edits a file, auto-open DiffView showing the changes

---

## PANEL TAB BAR — Take from Trae

### What it looks like (Image 3, 4):
- Full-width tab bar across the top of the right panel
- Tabs: Flow | Editor | Browser | DiffView | Agents
- Active tab has a subtle highlight/underline
- `+` button to add new tab
- Clean, minimal, no borders between tabs — just text with active indicator

### What the `+` dropdown shows (Image 4, from Trae):
- DocView
- Terminal
- DiffView
- Figma
- Supabase
- Integrations
- MCP
- Settings

### For V3Code, simplify the `+` dropdown to:
- Terminal
- DiffView
- Integrations
- MCP
- Settings

---

## CHAT MESSAGE RENDERING — Keep existing + polish

The existing message rendering (UserMessageComponent, AssistantMessageComponent, 
ChatMarkdownRender, ToolHeaderWrapper, EditTool, CommandTool) already works well.

### Polish only:
- Tighten spacing between messages
- Make sure inline diffs (EditTool) match Cursor's card style: colored file badge, clean +/- counts
- Tool call headers should have consistent 8px border-radius
- Thought process dropdown should match Trae's style

### DO NOT rebuild message rendering from scratch.

---

## BUILD ORDER

1. **REVERT** SidebarChat.tsx to working state
2. **VERIFY** all existing features work (model select, chat mode, reasoning, @ mentions, submit, abort, file changes)
3. **RESTYLE** VoidChatArea composer — new placeholder, toolbar rearrangement, pill-style dropdowns
4. **ADD** status bar above input ("@Agent — You are chatting with Agent now")
5. **ADD** slash command popup on `/` key
6. **FIX** VIBE mode — chat left full-height, panel tabs right side
7. **BUILD** panel tab bar (Flow / Editor / Browser / DiffView / Agents)
8. **BUILD** browser panel (extract from Trae bundle)
9. **POLISH** diff cards and tool call headers (CSS only)
10. **BUILD BOTH**: `npm run buildreact && npx gulp compile-client`
11. **VERIFY** everything renders and works

---

## WHAT NOT TO BUILD (save for later)
- Custom themes / theme toggle (next session)
- Shader welcome screen changes (next session)
- Context Bridge graph visualization (next session)
- Custom agent builder (next session)
- Voice/mic input (next session)

## WHAT TO DELETE
- ChatCore/ directory — not used, replaced by restyling existing components
- VibeAgentPanel.tsx — replaced by simplified VIBE layout
- Any non-functional buttons (dead @ button, dead attachment button)

---

## REFERENCE: Trae Agent Open Source

bytedance/trae-agent is open source (11.6K stars, MIT license):
https://github.com/bytedance/trae-agent

This is the AGENT ENGINE (CLI, tool calling, orchestration, multi-LLM), 
NOT the IDE UI. The UI components (SOLO mode, browser panel, chat) are 
still proprietary and only available in the extracted bundle.

The trae-agent repo could be useful later for:
- Agent orchestration patterns
- Tool calling architecture  
- Trajectory recording for debugging
- Multi-LLM provider switching logic

But for THIS session, focus on the UI extraction from the bundle.
