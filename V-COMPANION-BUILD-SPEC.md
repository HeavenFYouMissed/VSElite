# V — Companion Build Spec (mapped to VSElite)

> Design-only spec. No IDE code changed. This maps the "V" concept from
> `VBUILDDOCUMENT.md` onto the **actual** VSElite/Void codebase so it can be
> built (or handed to an agent) later.
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

- Pixel-alien sprite sheet (Retro Diffusion or similar) → `resources/` or
  `react/src/v-panel-tsx/assets/`. States: idle, thinking, excited, sleeping,
  alert, working, celebrating, worried, reading, waving.
- Tab icon: `registerIcon('v-companion-icon', ...)` (the file currently
  comments this out at `sidebarPane.ts:15-17` — follow that pattern, but
  actually register). A monochrome codicon-style glyph for the tab; the full
  color sprite renders inside the panel.

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

**Two ways V acts (owner: "hand off to the agent OR fix himself"):**
- **Handoff:** V composes an enhanced instruction + context bundle and injects
  it into the agent via `chatThreadService.addUserMessageAndStreamResponse`
  (this is also the prompt-enhancement interception point). The "inbox" is the
  visible log of these V↔agent exchanges.
- **Self-fix:** for small, safe, structurally-bounded edits, V applies the
  change directly through the same edit tools the agent uses, *after* a
  checkpoint. Gate self-fix behind a blast-radius threshold + user setting.

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

**Phase 5 — Skills, self-fix, background worker, mobile.**

---

## 6. Open decisions to lock before Phase 1

- **Relocation mechanism:** Approach A (second Sidebar view + toggle) vs B
  (`moveViewToLocation`). Spec recommends A.
- **Default DeepSeek model id** + where the key prompt lives (reuse
  `voidSettingsService` provider config — likely already present).
- **Self-fix blast-radius threshold** + whether it's on by default (recommend
  off until trust is established).
- **Sprite asset source** (Retro Diffusion sheet vs individual PNGs).

---

*V is the soul of V3Code. This spec wires that soul into the body you've
already built.*
