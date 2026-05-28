# DeepSeek Handoff — Agent Panel (Sprint 1)

**Owner:** DeepSeek
**Reviewer:** Claude (Copilot Chat)
**Prereqs:** Phase A rebrand complete ✅ · Phase B (Context Bridge LSP wiring) can run in parallel — Sprint 1 does NOT depend on real tool data yet.

Read these in order before touching code:
1. [V3CODE-BRANDING.md](V3CODE-BRANDING.md) — palette, scrollbar tokens, fonts
2. [AGENT-PANEL-SPEC.md](AGENT-PANEL-SPEC.md) — the design (now **superseded by this doc** where they conflict)
3. [DEEPSEEK-HANDOFF.md](DEEPSEEK-HANDOFF.md) — hard rules (still apply)

---

## Design decisions LOCKED (do not re-litigate)

1. **Two modes, not three.** Kill "Off". The pill toggles between:
   - **Chat mode** (default) — chat lives in the auxiliary bar where Void already puts it. Code editor is the main area. This is the current Void layout, just rebranded.
   - **Agent mode** — chat opens as an **editor input in the main editor group, split side-by-side** with the active code editor. Chat ~60% left, code ~40% right, draggable divider (VS Code's built-in group sash handles this for free).
2. **One pill, two states.** Click toggles Chat ↔ Agent. No three-way cycle.
3. **Scrollbar uses branded theme tokens** (already in V3CODE-BRANDING.md):
   - `scrollbarSlider.background: #25273050`
   - `scrollbarSlider.hoverBackground: #25273080`
   - `scrollbarSlider.activeBackground: #8B5CF650`
4. **Context Bridge activity feed, multi-chat tabs, browser/phone preview** → Sprint 2+. Not in this sprint.
5. **Do not invent a custom layout system.** Use VS Code's existing editor-input + split-group plumbing. The chat in Agent mode is a `VoidChatEditorInput` opened into the active editor group with `SIDE_GROUP`.
6. **Agent chrome is dark-only and branded.** Do NOT make the chat panel follow the VS Code theme. The code editor half follows whatever theme the user picked (that's VS Code default behavior, leave it alone). The chat half always uses the V3Code palette from V3CODE-BRANDING.md. Hard-code the dark palette into the `@@void-scope` styles or use CSS variables that ignore VS Code theme tokens for the chat surface.
7. **Panels are independent for free.** Because Agent mode uses two VS Code editor groups (code left, chat right), tab/focus independence is already provided by VS Code's group mechanics. You do NOT need to write any focus-management code. User can tab through code files in the left group, chat stays put in the right group. Don't fight this.

---

## Mobile compatibility constraints (Sprint 1 must not block these)

A future V3Code Remote mobile app will mirror three things from the desktop over WebSocket: chat thread state, browser preview URL, and file-change list (green dot = new, purple dot = modified). **Sprint 1 work must not paint us into a corner.** Specifically:

- **Chat state stays in `chatThreadService.ts`.** Don't put thread/message state in React local state. Don't add `useState` for anything that lives on the server side of the agent loop. (Confirmed already true in the existing code — just don't regress it.)
- **No browser preview work this sprint.** When it IS built (Sprint 3), the component must accept a `url: string` prop and not hardcode `localhost`. Same URL will be tunneled to the phone.
- **No file-change-dot rendering this sprint.** When it IS built, the green/purple dots must be driven by service events (edit-tracking service Void already has — search for `editCodeService` and the diff state machinery). Phone listener will subscribe to the same emitter. Don't bake change-detection logic into a React component.

If any of your Sprint 1 work seems to require violating one of these, STOP and ask.

---

## Sprint 1 scope (this handoff)

Ship a working pill toggle that flips the chat between auxiliary-bar (Chat) and main-area split (Agent). Plus apply branded scrollbar tokens to the theme. That's it.

**Out of scope this sprint:** multi-chat tabs, Context Bridge activity rendering, browser/phone preview, status panel, memory note auto-surfacing. All of those are Sprint 2+.

---

## Architecture (read this carefully)

The pill is a workbench action with a UI surface. The mode is a singleton service. The render path forks on mode:

```
┌────────────────────────────────────────────────────────────┐
│ AgentPanelService (new singleton)                          │
│   state: 'chat' | 'agent'                                  │
│   onDidChangeMode: Event<Mode>                             │
│   toggle(): void                                           │
└──────────┬────────────────────────────────┬────────────────┘
           │                                │
           ▼                                ▼
  Chat mode → existing                Agent mode →
  sidebarPane.ts (aux bar             open VoidChatEditorInput
  view). No change.                   in active group, SIDE_GROUP.
                                      Close it on toggle back.
```

The React `Sidebar.tsx` is reused for BOTH modes — same component renders whether the host is an aux-bar view OR an editor pane. Don't duplicate.

---

## File-by-file plan

### NEW FILE: `src/vs/workbench/contrib/void/browser/agentPanelService.ts`

A singleton service holding mode state.

**Interface contract:**
```ts
export type AgentPanelMode = 'chat' | 'agent';

export interface IAgentPanelService {
  readonly _serviceBrand: undefined;
  readonly mode: AgentPanelMode;
  readonly onDidChangeMode: Event<AgentPanelMode>;
  toggle(): void;
  setMode(mode: AgentPanelMode): void;
}

export const IAgentPanelService = createDecorator<IAgentPanelService>('agentPanelService');
```

**Implementation requirements:**
- Extend `Disposable`.
- Emit `onDidChangeMode` via `Emitter<AgentPanelMode>`.
- `toggle()` flips state and:
  - When moving to `'agent'`: call `IEditorService.openEditor(VoidChatEditorInput.INSTANCE, { pinned: true }, SIDE_GROUP)`.
  - When moving to `'chat'`: close any open editor of type `VoidChatEditorInput.TYPE_ID` across all groups, then call `viewsService.openViewContainer(VOID_VIEW_CONTAINER_ID)`.
- Register with `registerSingleton(IAgentPanelService, AgentPanelService, InstantiationType.Delayed)`.
- Naming follows house style (`modeOfX` etc. — none needed here, no maps).

### NEW FILE: `src/vs/workbench/contrib/void/browser/voidChatEditorInput.ts`

A custom `EditorInput` so the chat can live in the main editor area.

**Pattern reference:** Look at `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedInput.ts` in the codebase (or the upstream VS Code clone at `D:\vscode\src\vs\workbench\contrib\welcomeGettingStarted\browser\gettingStartedInput.ts`). That's the cleanest analog: a singleton editor input that hosts a custom UI.

**Requirements:**
- `class VoidChatEditorInput extends EditorInput`
- `static readonly TYPE_ID = 'workbench.editor.voidChat'`
- `static readonly INSTANCE = new VoidChatEditorInput()` — singleton, only one chat editor at a time in Sprint 1.
- `override get typeId() { return VoidChatEditorInput.TYPE_ID; }`
- `override getName() { return localize('voidChat', 'V3Code Agent'); }`
- `override getIcon()` returns a Codicon (use `Codicon.symbolMethod` to match the aux-bar container icon for now).
- `override matches(other)` returns true if `other instanceof VoidChatEditorInput`.

Pair it with an `EditorPane` (`VoidChatEditorPane extends EditorPane`) that:
- Has `static readonly ID = 'workbench.editor.voidChatPane'`.
- In `createEditor(parent)`, mounts the same React Sidebar via `mountSidebar(parent, accessor)` — exact same call `sidebarPane.ts` makes. Reuse, don't duplicate.
- Implements `layout(dimension)` by setting child width/height.

Register both:
```ts
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(VoidChatEditorPane, VoidChatEditorPane.ID, 'V3Code Agent'),
  [new SyncDescriptor(VoidChatEditorInput)]
);
```

### NEW FILE: `src/vs/workbench/contrib/void/browser/agentPanelActions.ts`

Register the toggle command + keybinding + title bar button.

**Command:**
```ts
export const V3CODE_TOGGLE_AGENT_MODE_ID = 'v3code.toggleAgentMode';
```

Register as `Action2` with:
- `id: V3CODE_TOGGLE_AGENT_MODE_ID`
- `title: { value: 'V3Code: Toggle Agent Mode', original: ... }`
- `category: 'V3Code'`
- `keybinding: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA, weight: KeybindingWeight.WorkbenchContrib }`
- `f1: true` (command palette)
- `menu: [{ id: MenuId.LayoutControlMenu, group: '0_workbench_layout', order: 0 }]` — this puts it in the title-bar layout-control area where the existing layout buttons live. That's our "indented Trae-style" pill location for v1. Don't try to invent a new title-bar slot.

`run()` calls `IAgentPanelService.toggle()`.

### EDIT: `src/vs/workbench/contrib/void/browser/void.contribution.ts`

Add three import lines alongside the existing ones. Match the existing comment style.

```ts
// register Agent panel mode + editor input
import './agentPanelService.js'
import './voidChatEditorInput.js'
import './agentPanelActions.js'
```

Place these right after the `import './sidebarPane.js'` line. **Do not reorder existing imports.** Do not touch anything else in this file.

### EDIT: `src/vs/workbench/contrib/void/browser/sidebarPane.ts`

When mode flips to `'agent'`, the aux-bar view should hide its container (so the chat doesn't double-render). When it flips back to `'chat'`, restore.

In `SidebarStartContribution` (or a new contribution next to it), subscribe to `IAgentPanelService.onDidChangeMode`. On `'agent'`: call `viewsService.closeViewContainer(VOID_VIEW_CONTAINER_ID)`. On `'chat'`: call `viewsService.openViewContainer(VOID_VIEW_CONTAINER_ID)`.

Inject `IAgentPanelService` and `IViewsService` via the constructor.

**Do not modify `SidebarViewPane`'s render path.** Same React tree is used in both modes.

### EDIT: `src/vs/workbench/contrib/void/browser/media/void.css` (or wherever theme tokens are wired)

Locate the existing color contributions (search for `scrollbarSlider` in `src/vs/workbench/contrib/void/`). If they don't exist yet, add them in the existing V3Code theme contribution file. If you can't find one, **stop and ask** — don't invent a new theme file.

Apply these three tokens (overwrite if present):
```
scrollbarSlider.background: #25273050
scrollbarSlider.hoverBackground: #25273080
scrollbarSlider.activeBackground: #8B5CF650
```

### EDIT: `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/Sidebar.tsx`

**Optional in this sprint, but nice to have:** add a small pill button in the top-right of the sidebar that calls `v3code.toggleAgentMode` (via `commandService.executeCommand`). This gives a second affordance for the toggle from inside the panel itself. Style:

```tsx
<button
  className="ml-auto px-2 py-0.5 text-[11px] rounded-sm
             bg-[#0B0D14] border border-[#8B5CF6]
             hover:bg-[#8B5CF620] text-[#E4E4ED]
             flex items-center gap-1"
  onClick={() => commandService.executeCommand('v3code.toggleAgentMode')}
>
  <span className="text-[#8B5CF6]">◆</span> AGENT
</button>
```

Use `useAccessor()` to grab `ICommandService` — see `VoidCommandBar.tsx` for the pattern.

If this is too much for one sprint, **skip it**. The command palette + keybinding is enough to validate the flow.

---

## Acceptance criteria

Daniel will spot-check these:

1. ✅ `Ctrl+Shift+A` (or command palette → "V3Code: Toggle Agent Mode") flips between Chat and Agent layouts.
2. ✅ In Chat mode: chat is in the aux bar, code editor occupies main area. (Current Void behavior, unchanged.)
3. ✅ In Agent mode: chat is an editor pane in the main editor group, split side-by-side with whatever code editor was open. Divider draggable. Closing the chat editor manually returns to Chat mode (subscribe to `onDidCloseEditor` to sync state).
4. ✅ Toggling repeatedly does not leak editors — only one `VoidChatEditorInput` instance at a time.
5. ✅ Scrollbars in chat + editor use the branded tokens (visually verifiable: hover a scrollbar, it goes purple-tinted when grabbed).
6. ✅ No `any` casts. No new console.logs. No semicolon style changes. No edits outside `src/vs/workbench/contrib/void/`.

---

## Things to NOT do this sprint

- ❌ Don't build multi-chat tabs.
- ❌ Don't build the Context Bridge activity feed UI. Phase B is still landing tool result shapes.
- ❌ Don't build browser/phone preview.
- ❌ Don't build the right-side status panel.
- ❌ Don't build memory note auto-surfacing.
- ❌ Don't touch `chatThreadService.ts` for this sprint — the other agent is mid-task there for Phase B.
- ❌ Don't rename `Void` → `V3Code` in code identifiers globally. The Void code-level naming stays; only user-facing strings ("V3Code Agent") get rebranded as you touch them.

---

## When you're done

1. List every file you created or modified.
2. List any places where you had to make a judgment call (e.g., couldn't find the theme file, picked a different keybinding because of a conflict).
3. **Stop.** Don't start Sprint 2. Daniel + Claude review first.

Sprint 2 will add: multi-chat tab bar, Context Bridge activity stream rendering (depends on Phase B output shape being final), and the right-side status panel. Sprint 3: browser + phone preview. None of that until Sprint 1 is green.

🤙
