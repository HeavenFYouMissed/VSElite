# V — Source of Truth

> Single source of truth for **V**, the AI companion for V3Code. What V is, the
> locked decisions, the housing architecture, the build checklist for Cursor,
> and current status. Keep this current as work proceeds.
>
> **Full design spec:** `V-COMPANION-BUILD-SPEC.md` on branch
> `claude/content-bridge-ui-design-SAj2X` (Draft PR #1 on `HeavenFYouMissed/VSElite`).
> This file is the on-`main` digest + the verified housing plan.
>
> **Coordination:** see `V4CLAUDE.md` for the live Claude⇄Cursor touch-log.
> **Last updated:** 2026-05-29.

---

## 1. What V is

A green pixel-alien AI **companion** for V3Code — the "JARVIS of the editor." A
standalone, always-on overseer with his own DeepSeek-Flash brain + memory whose
job is to **aid** the existing coding agent (not replace it): watch its work,
nudge toward skills/quality, guard egress + destructive ops, manage the IDE, and
be the human-facing dashboard for Context Bridge.

- **Home:** lives in the **bottom panel as a tab next to Ports** (alongside
  Problems / Output / Debug Console / Terminal / Ports) as a Claude-Code-style
  chat REPL (scroll transcript + pinned input, streaming, slash menu). Can
  relocate into the left file-explorer area to become a tall full chat.
- **Greets on open** with something true about the codebase (pulled live from
  Context Bridge).

---

## 2. Locked decisions

1. **Native, not a forked terminal agent.** Reuse V3Code's agent stack
   (`chatThreadService`, `toolsService`, `sendLLMMessageService`,
   `rollbackService`). Terminal *feel*, not a Claude Code / OpenCode fork.
2. **UI = React, not vanilla.** The UI is a streaming transcript + a ~10-state
   animated sprite + clickable choices + a dashboard — stateful, so React.
3. **Hosting = VS Code Webview API hosting an iframe to a standalone Vite app.**
   NOT a raw `<iframe>` in the workbench DOM (blocked by the workbench CSP
   `frame-src`). NOT a direct React-into-workbench mount (that's the gulp pain).
   → **Instant HMR in dev, no gulp, no `void-` prefix.** (See §3.)
4. **Context Bridge is native + healthy.** 11 tools verified working live
   (2026-05-29). V calls them in-process. The standalone MCP server is a
   hidden failover only.
5. **V supports, doesn't replace, the coding agent.** Handoff / self-fix / author
   skills. Overseer escalation lanes: whisper → nudge → intervene.
6. **"V anywhere" north star.** The dev/prod webview bridge (§3) is the same
   client/server seam that lets V run on web/mobile later via `@v3code/backend`.

---

## 3. Housing architecture (verified against this repo)

**The split that kills the build pain:**

```
THIN native shell  (gulp-built ONCE, rarely changes)
  vCompanionPane.ts  → registers V's bottom-panel tab, creates a VS Code webview,
                        injects HTML, bridges postMessage ↔ in-process services
        │ webview hosts an iframe whose src is:
        ▼
STANDALONE Vite + React app  (edit forever, instant HMR, ZERO gulp)
  vselite/void-panel/   → V's actual UI
```

**Dev:** `cd void-panel && npm run dev` → Vite HMR at `http://localhost:5173`.
The webview's injected HTML points the iframe at localhost. Edit a `.tsx` → panel
updates in ms. The native shell never rebuilds. The webview API means CSP/origin
"just work" — no relaxing workbench CSP, no plain-iframe block.

**Prod:** `npm run build` → `void-panel/dist/`. The host transforms asset URLs via
`asWebviewUri()` (→ `vscode-resource://…`); iframe `src` points at the bundled
`dist/index.html`. `localResourceRoots` includes the app-root `void-panel/dist`
folder. No gulp, no scope-tailwind.

> **Correction vs raw workflow output:** the host is a **workbench
> contribution**, NOT an extension — resource roots resolve against the **app
> root** (via `IEnvironmentService`/install path), not `extensionUri`. And V is a
> **new** pane (`vCompanionPane.ts`), it does **not** modify `sidebarPane.ts` /
> the existing chat.

### Directory layout

```
vselite/
├── src/vs/workbench/contrib/void/browser/
│   ├── vCompanionPane.ts        (NEW, thin: ViewPane + webview + RPC bridge)
│   ├── vCompanionContent.html   (NEW: webview HTML; env-dependent iframe src)
│   ├── void.contribution.ts     (ADD one import to register the pane)
│   └── [sidebarPane.ts + existing chat/tools: UNCHANGED]
├── void-panel/                  (NEW standalone Vite + React app)
│   ├── package.json  vite.config.ts  tailwind.config.js  tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx  App.tsx  index.css
│   │   ├── components/  VChat.tsx  VSprite.tsx  VChoices.tsx  VDashboard.tsx  VStatusBar.tsx
│   │   ├── hooks/       useVoidBridge.ts  useStreamingMessage.ts
│   │   └── lib/         messagePort.ts  types.ts
│   └── dist/                    (build output; gitignored)
└── package.json                 (ADD void-panel-dev / void-panel-build scripts)
```

### Bridge RPC surface (host exposes to the iframe over postMessage)

Real signatures found in the repo:
- `toolsService.callTool(toolName, params)` → the 11 Context Bridge tools.
- `chatThreadService.addUserMessageAndStreamResponse(userMessage, threadId, images?)`
  → streams via `onText` / `onFinalMessage`. (`images?` = image-input path.)
- `chatThreadService.approveLatestToolRequest(threadId)` / `rejectLatestToolRequest(threadId)`.
- `chatThreadService.jumpToCheckpointBeforeMessageIdx(threadId, messageIdx, jumpToUserModified?)`.
- `llmMessageService.sendLLMMessage(prompt, onText, onFinalMessage, onError, onAbort)` → `requestId` (V's own Flash brain).
- `llmMessageService.abort(requestId)`.

Define the protocol once in `void-panel/src/lib/types.ts`; validate `event.origin`
in `messagePort.ts` (accept `http://localhost:5173` in dev and the computed
`vscode-resource` origin in prod).

---

## 4. Build checklist for Cursor (Phase 1 — the housing + "V waves")

Goal of Phase 1: a **V tab next to Terminal** showing the Vite React app, with a
greeting and live Context Bridge status. No agent hooks yet.

1. `mkdir vselite/void-panel`; scaffold a Vite + React + TS app there
   (`package.json` with vite/react/tailwind/typescript, `vite.config.ts`,
   `tailwind.config.js`, `tsconfig.json`, `index.html`).
2. Create `void-panel/src/` structure (see layout above). Start minimal:
   `App.tsx` renders `VSprite` (idle/waving) + a greeting line + `VStatusBar`.
3. `void-panel/src/lib/messagePort.ts` + `useVoidBridge.ts`: postMessage RPC
   wrapper with origin validation + a deferred MessagePort handshake (wait for
   the host to send the port on an `init` message).
4. Add root `package.json` scripts: `"void-panel-dev": "cd void-panel && npm run dev"`,
   `"void-panel-build": "cd void-panel && npm run build"`.
5. NEW `vCompanionPane.ts`: a `ViewPane` registered at
   **`ViewContainerLocation.Panel`**, ordered to sit **next to the Ports tab**
   (give its container an `order` just after the Ports view container). Mirror
   how the **Ports / Terminal / Output** containers register in THIS codebase
   *as it stands post-refactor* — match the current pattern, not old line
   numbers. Use a NEW container id, e.g. `workbench.view.vCompanion`. In
   `renderBody`, create a **VS Code webview** (via the webview service) instead
   of mounting React.
6. NEW `vCompanionContent.html`: minimal HTML with one `<iframe id="v-frame">`
   whose `src` is `http://localhost:5173` in dev, else the `asWebviewUri()` of
   `void-panel/dist/index.html`. Inject a `<script>` that sets up the MessagePort
   bridge and forwards RPC.
7. Dev/prod src switch: a config flag or env check picks localhost vs
   `vscode-resource://`. Set `localResourceRoots` to the **app-root**
   `void-panel/dist` (NOT an extension path).
8. Register the pane: add one import of `vCompanionPane.ts` in
   `void.contribution.ts`.
9. Wire the RPC handlers on the host side to the existing in-process services
   (`IToolsService`, `IChatThreadService`, `ILLMMessageService`) via the
   accessor — start with just `get_project_briefing` + counts for the greeting.
10. **Verify dev:** terminal 1 `npm run void-panel-dev`; build + launch V3Code;
    the V tab shows the iframe; editing `void-panel/src/**` hot-reloads in the
    panel with **no gulp**.
11. **Verify prod:** `npm run void-panel-build`; confirm `dist/` loads in the
    webview with no CSP/404 errors.

> Build/run reminder (host shell only): `npm run buildreact` then
> `npx gulp compile-client` (NOT `gulp compile`), then launch. The `void-panel`
> app is pure Vite — never touches gulp.

---

## 5. Key risks (from verification)

- **CSP `frame-src`** would block a raw iframe — using the **webview API** avoids
  this. Do not append a plain iframe to the workbench DOM.
- **Origin validation:** dev (`localhost:5173`) vs prod (`vscode-resource`) — the
  `messagePort.ts` validator must accept both.
- **`localResourceRoots` path** must be the real on-disk `void-panel/dist` (log
  `asWebviewUri()` output to confirm) or all prod asset loads 404.
- **Streaming re-renders:** buffer `onText` in `useStreamingMessage` (debounce
  ~100ms) to avoid thrashing the transcript.
- **iframe reload loses UI state:** persist thread id/checkpoint via RPC or
  sessionStorage; chat history is server-side so re-fetch on init.

---

## 6. Status

| Area | State |
|---|---|
| V design spec | ✅ Complete — on branch `claude/content-bridge-ui-design-SAj2X` |
| Context Bridge | ✅ Native, 11 tools verified working live |
| Housing architecture | ✅ Verified against repo (this doc §3) |
| Phase 1 build | ⏳ Ready for Cursor (checklist §4) |
| Phases 2–6 | 📋 Specced (memory, overseer, agent symbiosis, skills, V-anywhere) |

## 7. Open decisions

- Relocation mechanism for the "big home" (left-explorer takeover): A (second
  Sidebar view + toggle, recommended) vs B (`moveViewToLocation`).
- Default DeepSeek-Flash model id + whether V's brain routes through the hosted
  gateway (`@v3code/backend`) now or later.
- Self-fix blast-radius threshold + on/off default (recommend off initially).
- Sprite assets: generate in Retro Diffusion (8-Direction Rotation + Walking &
  Idle); approved green-chibi-with-red-V look is locked.

---

## 7b. Access model, V's brain & tab placement (decisions 2026-05-29)

These were locked while building the chat UI; they extend §2/§7.

- **Tab placement:** V is a **bottom-panel tab labelled `[v]`** (short, low footprint),
  registered in the composite title bar **alongside Problems / Output / Debug Console /
  Terminal / Ports**. The `[v]` tab is **selected/shown first when the editor opens**.
  (This refines §1's "next to Ports" — same panel, `[v]` is the default active tab.)
- **The alien lives in the panel content** (the message-box container of the V tab),
  not the right-side chat. The right-side chat keeps its own alien sky header (already shipped).
- **V's brain = `deepseek-v4-flash`** by default (cheap, fast — fine for the companion's
  whisper/nudge/oversee role). Runs through `llmMessageService.sendLLMMessage` (its own
  request stream, separate from the coding agent).
- **Access tiers (pricing):**
  - **Paid plans** (billed via `@v3code/backend`, keyed by **user id**): V's brain is
    served by us (hosted DeepSeek-Flash). This is the default for paying users.
  - **Free plan:** V still works using the hosted Flash brain within free-tier limits,
    OR the user supplies their own key (BYOK) to power V.
  - **Model override:** a user can point V's brain at **their own model** (any configured
    provider/model) instead of the hosted Flash — set in **Settings** and/or **onboarding**
    as a dedicated **"V key"** field (separate from the coding-agent model selection).
- **Onboarding:** add a **V key** step (hosted-plan sign-in OR BYOK key OR pick-your-own-model),
  so V has a brain from first launch. Mirror the existing provider-key onboarding pattern.

> Implementation note: the panel UI (`void-panel/`) is brain-agnostic — it calls
> `llmMessageService.sendLLMMessage` over RPC. WHICH model/brain answers (hosted Flash vs
> BYOK vs override) is resolved host-side from the user's plan + V-key settings. This keeps
> the pricing/identity logic in the workbench/backend, not in V's face.

---

## 7c. Build progress + backlog (live)

**Done:** housing ([v] panel + webview host), terminal UI, V walking, choices on his
floor, `.v/` workspace (skills/memory/files + seed skill), V's brain (deepseek-flash via
`vChat` RPC, model never surfaced), scene system (home + building, fade transitions),
**V's eyes** (active-file + open-editors context injected each turn), **agent-watching**
(`onDidChangeStreamState` → recent activity + auto building scene; returns home on idle),
scene-back (esc / "back to V") with conversation preserved across scenes.

**Also done — V's agency:** V now runs an **agentic tool loop** (gather/read-only tools:
web_search, find_text, semantic_search, read_file, ls, get_dir_tree, context-bridge,
get_project_briefing — no edits/terminal). He reasons → calls a tool → feeds the result back
→ loops (cap 6), streaming tool steps to the transcript (`· searching the web`). And he can
**run the main coding agent**: `/run <task>` (RPC `vRunAgent` → `addUserMessageAndStreamResponse`
on the current thread), which V then watches via agent-watching. This is the orchestrator
direction — "run your project through V" — and it all sits behind the RPC seam (web-ready).
Autonomous delegation (V calling run_agent as a tool inside his loop) is the next step; it
needs a custom tool injected into the model's toolset (gather/agent mode only advertise
builtins today).

**Also done:** big synthesized `V_SYSTEM_PROMPT` (companion + skill-concierge + prompt-coach,
drawn from Codex personality/escalation + the buddy-agent mission + tone/safety rules; model
never revealed). Red **slash-command palette** in the prompt (`/build /refactor /skill /watch
/clear /help` + your `.v/` skills, keyboard-navigable; /refactor + /skill route to V's brain).

**Backlog (requested, not yet built):**
- **Image input via auto-router** — a vision-capable model *describes* the image, the
  description is fed to V (V's flash brain need not be multimodal). Add paste / "select files".
- **See & refactor the agent composer** — V reads what you're typing into the *coding-agent*
  chat before send and rewrites it into a deep prompt written back into that composer (not
  auto-sent). Needs a shared draft seam between SidebarChat and V. (/refactor is the manual
  version of this today.)
- **V's skill system (full)** — the buddy-agent build brief: normalized skill catalog with
  progressive disclosure (catalog → SKILL.md → resources); remote sources (skillsmp API,
  marketplace.json, mega-repos); search; **author** new skills; **handoff** to the main agent
  via `.agents/skills/<name>/SKILL.md` + wrapped `<use_skill .../>` pointer (prefer MCP, then
  filesystem-drop, then clipboard). Study openskills / deepagents SkillsMiddleware before
  building. Today: `/skill` + `.v/skills/` are the seed; `.v/skills` should converge on the
  cross-agent `.agents/skills/` standard. Skill-creator loop (draft → eval → iterate) for
  authoring quality.
- **More scenes** — watching/reviewing/thinking levels; richer building visuals.

## 8. Note: major VS Code merge in progress

A major refactor pulling newer VS Code into the fork is underway. This is *why*
the housing is designed the way it is — and how to stay safe through it:

- **V's UI (`void-panel/`) is fully decoupled** — its own Vite app, no `src/vs`
  imports, talks to the workbench only over the postMessage RPC. The merge does
  **not** touch it. It can be built/iterated **anytime, independent of the
  refactor.**
- **V's coupling to the workbench is intentionally tiny:** two new files
  (`vCompanionPane.ts`, `vCompanionContent.html`) + one import in
  `void.contribution.ts` + two `package.json` scripts. Only these can be
  disturbed by the merge.
- **Build the host AFTER the merge settles**, and locate integration points
  **by pattern, not line number** — search for how Ports/Terminal register their
  panel view containers and how webviews are created in the *post-merge* tree,
  then mirror that. Old `file:line` references in this doc are illustrative only.
- The **RPC contract** (§3) is the stable boundary. Keep it stable across the
  merge and both sides (UI + host) stay decoupled.
