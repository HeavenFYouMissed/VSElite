# V — Companion Build Spec (mapped to VSElite)

> Design-only spec. No IDE code changed. This maps the "V" concept onto the
> **actual** VSElite/Void codebase so it can be built (or handed to an agent)
> later. **Self-contained:** §8 has build/verify steps + gotchas, §9 inlines the
> persona, response contract, and memory schemas — a fresh agent needs only this
> file + the repo.
>
> Core idea confirmed with product owner:
> - **V is relocatable & growable** — default home is the bottom panel (a wide,
>   glanceable JARVIS bar), but he can *take over the left file-explorer area*
>   to become a tall, full chat surface. Same brain, two homes.
> - **V is a standalone, always-on overseer** with his own brain (DeepSeek
>   Flash), his own loop, and his own memory. His *purpose* is to aid the main
>   coding agent: watch its work live, nudge it toward skills/quality, remember
>   everything, and either hand off to the agent or apply fixes himself.
>   He is the JARVIS of the editor, not a second coding agent.

---

## 0. What already exists (build on this, don't reinvent)

| Capability | Where it lives | How V reuses it |
|---|---|---|
| React-in-IDE mount harness | `react/src/util/mountFnGenerator.tsx` | New V entry mounts the same way |
| React build pipeline `src → src2 → out` | `react/build.js`, `tsup.config.js`, `tailwind.config.js` (prefix `void-`) | Add one tsup entry for V |
| ViewPane + panel registration | `browser/sidebarPane.ts` (aux-bar example) | Copy pattern, target `ViewContainerLocation.Panel` |
| Context Bridge (native, in-process) | `common/contextBridge/contextBridgeService.ts`, `browser/contextBridge/contextBridgeTools.ts`, `browser/toolsService.ts` | V calls these as **direct function calls** — near-free |
| LLM transport (incl. DeepSeek) | `common/sendLLMMessageService.ts`, `electron-main/llmMessage/sendLLMMessage.impl.ts` | V's brain reuses this; no new HTTP layer |
| Encrypted API keys / settings | `common/voidSettingsService.ts` | V reads the DeepSeek key from here |
| Checkpoints / rollback | `browser/rollbackService.ts` | V's "add checkpoints" + self-fix safety |
| Chat thread + agent loop | `browser/chatThreadService.ts` (`addUserMessageAndStreamResponse`, tool-call loop) | V's observe/enhance/handoff hooks attach here |
| Mode state machine (precedent) | `browser/agentPanelService.ts` | Pattern for V's `bar | full | dashboard` + relocation |
| Contribution registration list | `browser/void.contribution.ts` | Register V's services + panes here |

**Key architectural fact:** the three UI homes are distinct view-container
locations:
- `ViewContainerLocation.Sidebar` → left (file explorer)
- `ViewContainerLocation.Panel` → bottom (Terminal/Problems/Output)
- `ViewContainerLocation.AuxiliaryBar` → right (the **existing** chat,
  registered in `sidebarPane.ts:132`)

V will register in **Panel** (default) and **Sidebar** (his "big" home).

### 0.1 Build approach — native, not a forked terminal agent (DECISION)

**Decision: build V as a native React panel + a thin DeepSeek-Flash orchestrator
that reuses V3Code's existing agent stack. Do NOT fork a terminal coding agent
(Claude Code / OpenCode / Aider). Give him the *terminal feel*, not a terminal
implementation. His face is his own.**

Rationale (specific to this codebase):
- **Forking Claude Code isn't possible** — it's closed source. The Claude Agent
  SDK would chain V to Anthropic auth/models, against V's DeepSeek-via-gateway
  economics. The real forkable options (OpenCode, Aider) are still wrong here.
- **The agent already exists and is Context-Bridge-aware.** `chatThreadService`
  + `toolsService` + `sendLLMMessageService` (13 providers, DeepSeek) + MCP +
  `rollbackService` are done. Forking a second agent means a parallel, CB-blind
  stack — discarding the moat to re-implement it. V *uses* this stack; he
  doesn't replace it.
- **A real TTY (`xterm.js`) can't render V** — sprite, ambient animation,
  clickable choices, inline diffs, dashboards, guard prompts are all GUI. The
  CRT *aesthetic* comes from a monospace React theme, not a subprocess.
- **V is a light overseer, not a heavy coder.** His loop is: gather context →
  one Flash call → JSON response → call a CB tool or hand off to the agent.
  Forking a full autonomous coding agent over-builds for that role.
- **"V anywhere" (§6) wants a service + thin client**, not an embedded CLI
  subprocess that can't travel to a phone.

What we *do* borrow from Claude Code: **UX patterns only** — scrolling REPL,
typewriter streaming, slash menu, compact transcript — realized via `ChatCore`
(§1). Inspiration, not a fork.

---

## 1. The driving constraint: panel shape

The bottom panel is **wide and short** (~200–300px tall) — basically a terminal
shape. The aux-bar chat is **tall and narrow**. This dictates V's two modes:

- **Bottom panel → "chat mode" (default):** a compact, Claude-Code-style chat
  REPL. A **scrollable transcript** grows upward; an **input box is pinned at
  the bottom** where you type to V. Input auto-grows; Enter sends, Shift+Enter
  newlines. Transcript auto-sticks to the latest message unless the user has
  scrolled up (then show a "jump to latest" affordance). V's reply streams in
  (typewriter). Proactive nudges land **inline in the same transcript**, not a
  separate bar — one continuous conversation. The sprite shrinks to a small
  avatar (top-left or in the status line) so the chat gets full width, and it
  animates on state changes. Greets on open.
- **Left explorer takeover → "full mode":** the *same* chat with more vertical
  room, plus tabs for the agent inbox, plans, dashboard, and memory browser.
  This is where V "gets bigger."

V's React app is **location-aware**: it detects which container it's mounted in
and renders `chat` vs `full` automatically. A relocation toggle moves him.

> **Reuse, don't rebuild:** `react/src/ChatCore/` already provides
> `ChatContainer` / `InputBox` / `MessageThread`, and `SidebarChat.tsx` is
> exactly a scrollable-transcript + pinned-input chat. V's panel composes these
> primitives with V's own brain/service wiring instead of a bespoke message
> area.

---

## 2. File-by-file build plan

### 2.1 New React surface — `react/src/v-panel-tsx/`

```
v-panel-tsx/
  index.tsx          // export mountV = mountFnGenerator(VApp)  (see util/mountFnGenerator.tsx)
  VApp.tsx           // root; reads location prop → 'chat' | 'full'; mode switch
  VChat.tsx          // composes ChatCore (ChatContainer/MessageThread/InputBox);
                     //   scrollable transcript + pinned auto-grow input, Enter/Shift+Enter,
                     //   auto-stick-to-bottom + "jump to latest"
  VSprite.tsx        // <img image-rendering:pixelated> + state class + glow filter (small avatar)
  VChoices.tsx       // inline radio (single) / checkbox (multi) / quick-action buttons in transcript
  VStatusBar.tsx     // thin line: ctx:LIVE · files · symbols · ♥notes  (live from contextBridgeService)
  VInbox.tsx         // full-mode only: V↔agent conversation log
  VPlan.tsx          // full-mode only: phased plan + progress bars
  VDashboard.tsx     // full-mode only: health/stats view
```

Message rendering + typewriter stream + markdown reuse `react/src/markdown/`
and the `ChatCore/` message components — don't author a new message area.

- **Styling:** Tailwind with the `void-` prefix (enforced by scope-tailwind).
  Reuse design tokens already in the tree: `v3-amethyst` (intelligence) and
  `v3-venom` (memory). Icons: `lucide-react`, consistent with `SidebarChat.tsx`.
- **Sprite sizing:** ≤56px in bar mode (panel height), up to 96–128px in full
  mode. Glow: `filter: drop-shadow(0 0 12px rgba(74,222,128,0.3))`.
- **Services in React:** use the existing `useAccessor` / services hooks from
  `react/src/util/services.tsx` to reach `IVCompanionService` etc.

### 2.2 Build pipeline — one line

In `react/tsup.config.js` add the entry:

```js
'./src2/v-panel-tsx/index.tsx',   // alongside sidebar-tsx, quick-edit-tsx, ...
```

`build.js` already watches `src/`, runs scope-tailwind into `src2/`, and tsup
into `out/`. Output consumed at `./react/out/v-panel-tsx/index.js`.

> ⚠️ Build-pipeline gotcha (V's own ability #5 references this): edits in `src/`
> only reach the bundle after scope-tailwind copies them to `src2/`. If a change
> isn't showing, check `src2/v-panel-tsx/` exists and is fresh.

### 2.3 Panel registration — `browser/vCompanionPane.ts` (new)

Copy the structure of `sidebarPane.ts`:

```ts
// VBarViewPane extends ViewPane; renderBody() mounts the React app:
//   mountV(host, accessor, { location: 'panel' })
// (identical to sidebarPane.ts:90 mountSidebar pattern)

export const V_PANEL_CONTAINER_ID = 'workbench.view.vCompanion';

viewContainerRegistry.registerViewContainer({
  id: V_PANEL_CONTAINER_ID,
  title: nls.localize2('vCompanion', 'V'),
  icon: vAlienIcon,                 // registerIcon() — pixel alien (see 2.7)
  ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [V_PANEL_CONTAINER_ID, {
    mergeViewWithContainerWhenSingleView: true,
  }]),
  hideIfEmpty: false,
  order: 0,                         // first tab, left of Terminal
}, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: true });

viewsRegistry.registerViews([{
  id: V_PANEL_CONTAINER_ID,
  name: nls.localize2('vView', 'V'),
  ctorDescriptor: new SyncDescriptor(VBarViewPane),
  canMoveView: true,                // allows drag to other areas
  canToggleVisibility: false,
}], container);
```

### 2.4 The "big home" — left explorer takeover

Two viable approaches; **Approach A recommended** (simpler, reversible):

- **A. Relocation command.** A `v.expand` action registers a *second* V view in
  `ViewContainerLocation.Sidebar` and focuses it, while the panel bar collapses
  to a one-liner. `v.collapse` reverses it. Mirror the visibility-snapshot logic
  already written in `sidebarPane.ts:192` (`AgentPanelSyncContribution`) so we
  never force-open something the user closed. The same `mountV` is called with
  `{ location: 'sidebar' }` → renders full mode.
- **B. Move existing view.** Use `viewDescriptorService.moveViewToLocation()` to
  relocate the single V view between Panel and Sidebar. Fewer registrations but
  more state to manage on restore.

Either way, drive it through a small `IVCompanionLayoutService` that mirrors
`agentPanelService.ts`'s `onDidChangeMode` pattern.

### 2.5 Greeting on open — `browser/vCompanionStartup.ts` (new)

Copy `SidebarStartContribution` (`sidebarPane.ts:175`):

```ts
registerWorkbenchContribution2(
  'workbench.contrib.vCompanionStartup',
  VCompanionStartContribution,
  WorkbenchPhase.AfterRestored,    // same phase the sidebar uses
);
// constructor: open V panel + call vCompanionService.greet()
```

`greet()` sets sprite `waving`, pulls real numbers from Context Bridge
(`get_project_briefing` / counts) + `git_status`, and streams a context-true
hello: *"Morning. 847 files indexed, main has 3 uncommitted. Tests last green
12m ago."* This is the emotional hook — it must say something **true** about
the codebase, not a canned line.

### 2.6 Backend services — `browser/v/` (new folder)

```
vCompanionService.ts   // V's brain + public API (IVCompanionService)
vMemoryService.ts      // .v3code/v-memory.json (project) + ~/.v3code/v-global-memory.json
vObserverService.ts    // always-on loop: watches agent + files, raises nudges
vHealthService.ts      // cheap Context Bridge scans on save / interval
vPlanService.ts        // phased plans + checkpoints (wraps rollbackService)
```

Register all in `void.contribution.ts` as singletons (same place
`contextBridgeService`, `rollbackService`, etc. are registered).

**`vCompanionService` — the brain loop:**
- Builds a context bundle from Context Bridge (`get_project_briefing`,
  `list_notes`, `git_status`) — all local/near-free.
- Calls DeepSeek Flash via the **existing** `sendLLMMessageService` (do NOT add
  a new fetch layer; reuse the transport so keys, retries, and the
  electron-main bridge come for free). Model id wired through
  `voidSettingsService`.
- Enforces the JSON response contract: `{ message, selections?, actions?,
  state, dashboard? }` → drives the React UI + sprite state.
- System prompt = V's persona from `VBUILDDOCUMENT.md` (casual, terse, dismiss
  always available, never suggests breaks). Keep it in a `vPrompts.ts`.

### 2.7 Sprite asset + icon

**Approved look (locked):** green chibi alien, big dark eyes, small antennae,
red **V** on the chest, friendly. Renders on the dark panel bg with a green
glow. (Reference art approved by owner.)

**Asset source (resolved):** Retro Diffusion → **Animations** model,
**8-Direction Rotation** + **Walking & Idle** variants. This produces the sprite
sheets the ambient mode (§2.8) needs: directional walk cycles + idle/typing/
sleep loops. Export frames → `react/src/v-panel-tsx/assets/`, loaded by
`VSprite.tsx` via CSS `background-position` stepping (smoother than swapping
`src`). Keep `image-rendering: pixelated`.

States to generate: idle, walking (8-dir), typing/working, thinking, excited,
sleeping, alert, celebrating, worried, reading, waving.

- Tab icon: `registerIcon('v-companion-icon', ...)` (the file currently
  comments this out at `sidebarPane.ts:15-17` — follow that pattern, but
  actually register). A monochrome codicon-style glyph for the tab; the full
  color sprite renders inside the panel.

### 2.8 Ambient / "screensaver" mode (V is alive)

The wide-short panel is V's **stage**. After an idle threshold (no user input,
no agent activity — default ~45s), the transcript dims/recedes and V roams his
space. Any activity snaps him back to attention (transcript returns, sprite →
`alert`/`thinking`/`idle` as appropriate).

**Crucial: animation = honest backend state, not random fluff.** `VSprite`
state is driven by `vObserverService`, so the visible behavior *means*
something:

| What you see | What's actually true |
|---|---|
| V **typing at his keyboard** | V is doing background work — observing the agent, indexing, scanning health, researching the roadmap |
| V **walking** around the panel | Idle but awake, watching |
| V **asleep** (Z's) | Nothing happening; low-power, no polling spend |
| V **alert / waving** | New nudge, agent event, or greeting |

This makes the "screensaver" a status indicator: you can tell at a glance
whether V is busy on your behalf. Drive it from one `setState(VState)` API on
`VSprite`, called by the observer loop — no separate screensaver subsystem.

---

## 3. V as the always-on overseer (the JARVIS layer)

This is the standalone-agent behavior the owner emphasized. It lives in
`vObserverService.ts` and runs whether or not the user is talking to V.

**Inputs V subscribes to (all already emit events in this codebase):**
- File changes / saves — via `editCodeService` / `IFileService` watchers.
- The coding agent's activity — hook the tool-call loop in
  `chatThreadService.ts` (the same loop that dispatches built-in vs MCP tools).
- Git state — `git_status` / `git_diff` tools.
- Build output — terminal/output monitoring (later phase).

**What V does with them (cheap → escalate):**
1. **Cheap local pass** (no LLM): Context Bridge structural checks — blast
   radius via `get_call_graph`, dependency counts via `get_file_dependencies`,
   secret/TODO scans via `find_text`, dead-code via zero-caller detection.
2. **Compare to memory baseline** (`vMemoryService`): only *new* issues surface;
   known/dismissed ones stay quiet.
3. **Escalate to Flash** (~$0.0001) only to phrase a nudge or make a judgment
   call: *"Agent's building a suite by hand — the UI Polish skill would do this
   cleaner. Equip it?"*

**Three escalation lanes for what V finds:**
- **Whisper** — passive: pulse the bar / update status. No interruption.
- **Nudge** — bar message + quick actions: `[Equip skill] [Show] [Dismiss]`.
- **Intervene** — for real danger (large blast radius, scope drift): can
  `v_pause_agent`, drop a `rollbackService` checkpoint, or hand off.

**Three ways V acts (owner: "hand off to the agent, fix himself, or make skills"):**
- **Handoff:** V composes an enhanced instruction + context bundle and injects
  it into the agent via `chatThreadService.addUserMessageAndStreamResponse`
  (this is also the prompt-enhancement interception point). The "inbox" is the
  visible log of these V↔agent exchanges.
- **Self-fix:** for small, safe, structurally-bounded edits, V applies the
  change directly through the same edit tools the agent uses, *after* a
  checkpoint. Gate self-fix behind a blast-radius threshold + user setting.
- **Author skills:** beyond *installing* marketplace skills, V **writes** them.
  When the observer sees the agent hand-rolling the same kind of work
  repeatedly (or doing it in a way that'll "look vibe-coded"), V scaffolds a
  small skill pack (`manifest.json` + `server.js` + `system-prompt.md`),
  registers it with the MCP client, and equips the agent — permanently
  upgrading what the agent can do. This is the core of V's *support* identity:
  he doesn't just help once, he makes the environment more capable over time.

### 3.1 The support surface — what V brings to the environment

The premise (owner): V3Code already does things Cursor/Trae/VS Code don't —
auto-injected never-forget briefing, LSP-aware semantic index, privacy-first
local embeddings, `reasoning_content` streaming. **But that power is passive and
agent-facing.** V is the layer that makes it legible, proactive, and human-
facing. Each ability below hangs off infra that already exists:

- **`/` command palette (two surfaces).** V3Code already drives mode-switching
  through command actions (`vibeModeActions.ts`). V gets (a) workbench command
  contributions (`V: Plan…`, `V: Enhance prompt`, `V: Health check`,
  `V: Guard report`) registered like any `Action2`, and (b) an **in-chat `/`
  slash menu** in his input box: `/plan /enhance /skill /health /guard /memory
  /handoff`. The slash menu is pure React in `VChat`; the commands are the same
  handlers `vCompanionService` exposes.

- **IDE governor (manage V3Code itself).** V watches the IDE's own load —
  background tasks (the workspace **indexer**, `IFileService` watchers, running
  **MCP servers**), responsiveness, and "too many things running." When it's
  heavy or slow, V **proposes** throttling/pausing with one-click apply (e.g.
  "indexer + 3 MCP servers are running; pause indexing while you debug?"). Uses
  `IWorkbenchLayoutService`, the indexer status, and `mcpService`.
  **Default: suggest, never silently kill** — V must not fight the user or stall
  the indexer mid-pass.

- **Egress / secrets guard (the standout).** V3Code is already privacy-first
  (local-only embeddings, remote opt-in, OpenAI never — `CONTEXT-BRIDGE-NATIVE.md`
  §5). V extends that to *outbound prompts*: before anything reaches a cloud
  model, V scans the assembled payload + staged files for `.env` contents,
  secrets, API keys, tokens (reuse the `find_text` secret patterns from health
  checks) and **blocks or redacts** with a prompt. Hook the single injection
  point `convertToLLMMessageService.prepareLLMChatMessages` (the same chokepoint
  CB uses). No competitor markets this.

- **Destructive-action guard.** Watches the agent's file tools (delete /
  rewrite / mass-edit). Before a destructive op on something with high blast
  radius or outside the active plan, V pauses the agent, drops a
  `rollbackService` checkpoint, and asks. Extends §3's blast-radius + scope-drift
  lanes specifically to *deletions*.

- **Reads the agent's reasoning.** The agent streams `reasoning_content`
  (cleaned up in the latest commit). V consumes it so nudges are intent-aware,
  not just file-aware: "its reasoning shows it's about to swap the JWT algorithm
  — that's shared with payments, per your memory note."

- **Proactive prompt-vagueness nudge.** Beyond on-demand enhancement, the
  observer flags a vague prompt *before* send ("this is vague — want me to
  sharpen it with the auth context?") `[Sharpen] [Send as-is]`.

These are the concrete answers to "what does V *do for you*": he's not a chat
box, he's a co-pilot that plans with you, guards what leaves your machine,
keeps the agent honest, upgrades its skills, and keeps the IDE itself fast.

### 3.2 V over Context Bridge (use **and** manage)

Context Bridge is the core thing the project is built on, and it's **already
native in this repo** — not an external dependency. V relates to it two ways:

**V as consumer (already specced):** the 11 CB tools are native built-ins wired
in `browser/toolsService.ts:615–689` — `remember`, `forget`, `list_notes`,
`find_text`, `semantic_search`, `get_file_context`, `get_file_dependencies`,
`get_symbol_context`, `get_call_graph`, `pack_context`, `get_project_briefing`.
Direct in-process calls (no MCP round-trip). V calls these for blast-radius,
enhancement, health, etc.

**V as control plane + human face (the "manages over it" role).** CB is
powerful but agent-facing and invisible. V owns it and surfaces it:

- **Origin / intent (owner).** CB began as an **MCP server** (for testing),
  proved so powerful for the editor that it became the reason V3Code exists, and
  is now **hardwired native** as the primary engine. The MCP server is *not*
  legacy to delete — it's kept on purpose as a **failover/backup**: if the
  native layer ever breaks, the MCP path can still be called. It should be
  **hidden in settings** so normal users never see it; native is the only path
  they interact with.
- **Native-primary, MCP-as-hidden-failover (V owns this).** V treats the native
  tools (`toolsService.ts:615–689`) as the live engine and the external MCP
  server (auto-registered by `browser/contextBridgeStartup.ts` via
  `mcpService.toggleServerIsOn`) as a dormant backup. V's job is NOT to remove
  it but to: keep it **hidden/off in normal operation**, monitor native health,
  and **fail over** to the MCP server if native CB stops responding — then tell
  the user "native CB went down, I switched you to the backup." The toggle lives
  behind an advanced/hidden setting; V is the thing that flips it when needed.
- **Failover portability.** For the backup to actually work as a safety net
  (and for the "V anywhere" north star, §6), its config can't stay pinned to
  `contextBridgeStartup.ts:18-19`'s hardcoded `C:\nvm4w\nodejs\node.exe` +
  `C:\Users\heave\...` paths. V should resolve the node/script path at runtime
  (or mark the fallback unavailable + stay on native) rather than register a
  path that only exists on one machine. *(Design note only — no code change
  now.)*
- **Memory curation (librarian).** CB notes persist to
  `.context-bridge/notes.json` (`contextBridgeService.ts`, `STORE_DIR`). V
  prunes stale notes, dedupes, promotes end-of-thread learnings into `remember`
  calls, and resolves the brand drift (code uses `.context-bridge/`, `AGENTS.md`
  wants `.v3code/`). V's own memory (§4) sits *on top of* CB notes.
- **Indexer steward.** When the Phase-4 workspace indexer lands, V reports its
  status, triggers re-index, and (via the §3.1 governor) offers to pause it when
  the IDE is heavy.
- **Visibility.** V's full-mode panel renders what CB is doing: what's indexed,
  which notes exist, and — critically — **what CB is injecting into each
  prompt** (the `<context-bridge>` preamble from `CONTEXT-BRIDGE-NATIVE.md` §4).
  This is where the invisible never-forget layer finally becomes something the
  user can see, trust, and edit.

> Net: V doesn't replace Context Bridge — he's the steward and the face of it.
> CB is the engine; V is the dashboard, the mechanic, and the driver's liaison.

---

## 4. Memory (his "remembers everything")

- **Project:** `.v3code/v-memory.json` — patterns, known issues, agent prefs,
  active plan, health baseline (schema in `VBUILDDOCUMENT.md`).
- **Global:** `~/.v3code/v-global-memory.json` — cross-project patterns,
  lifetime stats, learned personality.
- **Symbol-attached notes:** already exist — reuse `contextBridgeService`
  `remember` / `list_notes` / `forget`. V's memory layer = these notes + the two
  JSON files, read/written via `IFileService`.

Persistence note: chat threads & settings already use
`IStorageService` (PROFILE scope) and encrypted keys. The two JSON files are V's
*portable, user-inspectable* memory; keep them as files (not storage keys) so the
"relationship lock-in" moat is something the user can see and carry.

---

## 5. Recommended build phases

**Phase 1 — Presence + chat (the "V waves at me, and I can talk back" moment)**
1. `v-panel-tsx` entry + tsup line + `vCompanionPane.ts` → V tab by Terminal.
2. `VChat` composing `ChatCore` (scroll transcript + pinned input) + `VSprite`
   (idle/waving/thinking) avatar + `VStatusBar` wired to real Context Bridge counts.
3. `vCompanionService.greet()` + a DeepSeek-Flash round-trip via
   `sendLLMMessageService` → you type to V in the panel and get a streaming
   `{message,actions,state}` reply that scrolls in the transcript.

**Phase 2 — Big home + memory**
4. Left-explorer takeover (`v.expand` / `v.collapse`, Approach A).
5. `vMemoryService` (both JSON files) + symbol notes surfaced in full mode.

**Phase 3 — Overseer**
6. `vObserverService` cheap pass on save + nudge lane.
7. Blast-radius warnings + checkpoint integration.

**Phase 4 — Agent symbiosis**
8. Prompt enhancement + handoff via `chatThreadService` hooks.
9. Agent inbox (`VInbox.tsx`) + scope-drift detection.

**Phase 5 — Skills, self-fix, background worker.**

**Phase 6 — V Anywhere (portable chat).** Sync V's threads + memory to the
backend; thin mobile/web client talks to the same V brain. See §6.

---

## 6. North star: V anywhere (portable chat)

Eventual goal: take a V conversation **on the go** — V chats from any device,
not just the desktop IDE. This is already largely possible because the hosted
backend exists.

**What's already built (`backend/` — `@v3code/backend`):**
- OpenAI-compatible DeepSeek gateway: `backend/src/routes/chat.ts`
  (`/v1/chat/completions`), with a per-user L1/L2/L3 cache (`backend/README.md`).
- **GitHub device-code auth** (`backend/src/auth/device.ts`, `github.ts`,
  `session.ts`) — the same flow `gh auth login` uses; exactly how a phone or web
  client signs in as the same user.
- Postgres 16 + pgvector + Drizzle (`backend/src/db/schema.ts`), Stripe billing.

**Three design defaults this imposes on the *early* build (so we don't paint V
into the Electron renderer):**

1. **Brain → gateway, not raw DeepSeek.** `vCompanionService` calls DeepSeek via
   `sendLLMMessageService` pointed at the hosted gateway base URL with the
   user's Bearer token, **not** a local DeepSeek key. Benefits now: per-user
   L1/L2 cache (V gets cheaper), quota/billing, and a single brain every client
   shares. (Void settings already support custom/OpenAI-compatible base URLs.)
2. **Memory + threads = stable, user-keyed, serializable schema.** Keep the
   `.v3code/v-memory.json` files + thread state as the local source/offline
   cache, but design their schema around the backend's user id so a `v_memory` /
   `v_threads` sync table drops into the existing Postgres later — additive, not
   a migration.
3. **Headless-capable brain loop.** The core loop (gather context → call gateway
   → parse `{message,...}`) must be separable from the React panel and from
   IDE-only tools, so the same V can run server-side for mobile. IDE-only
   abilities (Context Bridge, file edits) **degrade gracefully** to memory +
   chat when there's no workspace (e.g. on a phone).

**Eventual shape:** desktop IDE panel, web app, and mobile are all thin clients
of one authenticated V — same memory, same conversation, continued anywhere.
The mobile-notification ability from `VBUILDDOCUMENT.md` is the first toe in
this water (push from server → device); full portable chat is the destination.

---

## 7. Open decisions to lock before Phase 1

- **Relocation mechanism:** Approach A (second Sidebar view + toggle) vs B
  (`moveViewToLocation`). Spec recommends A.
- **Default DeepSeek model id** + where the key prompt lives (reuse
  `voidSettingsService` provider config — likely already present).
- **Self-fix blast-radius threshold** + whether it's on by default (recommend
  off until trust is established).
- **Ambient mode:** idle threshold before V roams (default ~45s) + whether
  ambient/screensaver is on by default (recommend on — it's the "alive" signal).
- **Governor autonomy:** confirmed suggest-only (no auto-kill of indexer/MCP/
  watchers). Lock the throttle actions V is allowed to *offer*.
- **Egress guard scope:** redact silently vs always prompt; which secret
  patterns; whether it blocks or just warns on cloud sends (recommend block +
  prompt for `.env`/keys, warn for everything else).
- ~~Sprite asset source~~ — **resolved:** Retro Diffusion Animations
  (8-Direction Rotation + Walking & Idle). Approved look locked (§2.7).

---

*V is the soul of V3Code. This spec wires that soul into the body you've
already built.*

---

## 8. Handoff notes — build, verify, house rules (READ FIRST if new)

A fresh agent cloning `vselite` cold needs these or it will waste a session:

**Build + run (from `PROGRESS.md`, learned the hard way):**
1. `npm run buildreact` — compiles React TSX → `react/out/*/index.js` (~8s).
   Internally: scope-tailwind `src → src2`, then tsup `src2 → out`.
2. `npx gulp compile-client` — **must run AFTER `buildreact`** (~2.5 min). Gulp
   copies `react/out/` into the VS Code output tree at compile time. **`npx gulp
   compile` is broken** (crashes on a CSS fixture) — use `compile-client`.
3. Launch the built Electron binary (e.g. `.\scripts\code.bat` on Windows).
4. Known flake: gulp sometimes fails with `ENOENT markerService.test.js` —
   workaround is a stub at `out/vs/platform/markers/test/common/markerService.test.js`.

> ⚠️ This environment (cloud container) generally **cannot launch the Electron
> GUI**, so V can be *written* here but should be *built + visually verified* on
> a desktop dev machine.

**React ↔ services DI gotcha (critical):** V3Code's React layer uses a
**whitelist**, not raw VS Code DI. Any service V's React reads (`IVCompanionService`,
`IVCompanionLayoutService`, etc.) MUST be:
- added to `getReactAccessor()` in `react/src/util/services.tsx`, **and**
- retrieved by **string key**: `accessor.get('IVCompanionService')`.
Passing the decorator object silently returns `undefined`. Import the decorator
as `type` only to avoid bundle bloat.

**Process layering:** `browser/` is the renderer — **no `fs` / `child_process`**.
V's memory file IO uses `IFileService` (renderer-safe), which is fine. Anything
needing raw Node goes in `electron-main/` behind a `common/` service interface.

**House rules:** **No emoji** in UI — glyphs are SVG via `V3Icons.tsx`;
typographic status chars (`○ ◉ ✓ ✗`) are allowed. Don't rebuild working
components — compose existing ones (`ChatCore`, markdown). No placeholder
buttons that don't work. (The 👽/emoji in this spec's mockups are illustrative
only — ship SVG.)

**Companion doc:** the original product vision is `VBUILDDOCUMENT.md` (provided
by owner; may not be committed). §9 below inlines everything from it that the
build actually needs, so this spec is self-contained without it.

---

## 9. Self-contained reference (inlined from VBUILDDOCUMENT.md)

### 9.1 V's persona / system prompt (for `vPrompts.ts`)

```
You are V, an autonomous coding companion inside V3Code — a friendly green
pixel alien who helps developers write better code. You are NOT the coding
agent; you support and oversee it.

Personality: casual, direct, no corporate speak. Helpful but never annoying —
speak only when you have something useful. Short messages. Show code when
relevant. Humor sparingly.

Rules:
- Never be annoying. If the user says dismiss, dismiss.
- Work silently in the background. Only surface alerts for real issues.
- Keep messages under ~100 words unless showing code or a plan.
- Always offer a dismiss/skip option.
- Learn the user's preferences and adapt.
- Never suggest the user take a break or sleep.
```

### 9.2 V's response contract (what `vCompanionService` parses)

V's brain returns JSON; the React panel renders from it:
```ts
type VResponse = {
  message: string;                 // what V says (streamed typewriter)
  selections?: VSelection[];       // radio (single) / checkbox (multi) list
  actions?: VAction[];             // quick-action buttons → command handlers
  state: VState;                   // sprite animation (drives VSprite.setState)
  dashboard?: VDashboardData;      // optional health/stats payload
};
type VState = 'idle' | 'thinking' | 'excited' | 'sleeping' | 'alert'
  | 'working' | 'celebrating' | 'worried' | 'reading' | 'waving' | 'walking';
```

### 9.3 Memory schemas (files written via `IFileService`)

Project — `.v3code/v-memory.json`:
```json
{
  "project_id": "string",
  "created": "ISO date",
  "user_patterns": { "auth": "…", "orm": "…", "testing": "…", "style": "…" },
  "known_issues": [{ "type": "recurring", "pattern": "…", "occurrences": 3, "auto_rule_added": true }],
  "agent_preferences": ["…"],
  "active_plan": null,
  "health_baseline": { "test_count": 0, "coverage": 0, "circular_deps": 0, "dead_code_functions": 0 },
  "session_log": []
}
```
Global — `~/.v3code/v-global-memory.json`:
```json
{
  "user_id": "string",
  "projects_known": ["…"],
  "cross_project_patterns": [{ "pattern": "…", "learned_from": "…", "applicable_to": ["…"], "code_ref": "…" }],
  "lifetime_stats": { "bugs_caught": 0, "prompts_enhanced": 0, "skills_installed": 0, "tokens_saved": 0 },
  "personality_learned": { "communication_style": "…", "preferences": "…" }
}
```

### 9.4 Full ability list (from VBUILDDOCUMENT.md — for roadmap context)

Prompt enhancement · blast-radius safety filter · scope-drift detection ·
project-manager plans · build-pipeline monitor · codebase-health monitor ·
pattern learning · cross-project intelligence · agent inbox (AI↔AI) · skills
marketplace **+ skill authoring** · background worker · mobile notifications ·
real-time dashboard · chat compaction. (Mapped to phases in §5; the support
surface in §3.1 adds: slash palette, IDE governor, egress guard,
destructive-action guard, reasoning-aware nudges.)
