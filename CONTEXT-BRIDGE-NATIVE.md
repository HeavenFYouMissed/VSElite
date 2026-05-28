# Context Bridge — Native V3Code Integration

**Status:** Draft v1 · 2026-05-27
**Owner:** Daniel (KandD Labs) · drafted by Claude Opus 4.7
**Predecessor docs:** [CONTEXT-BRIDGE-INTEGRATION.md](CONTEXT-BRIDGE-INTEGRATION.md) (extension-based prototype, superseded by this doc for the V3Code-native path) · [V3CODE-PLAN.md](V3CODE-PLAN.md)
**MCP server reference:** [context-bridge/AGENTS.md](../context-bridge/AGENTS.md) · [context-bridge/mcp-server/src](../context-bridge/mcp-server/src)

---

## 0. Why this doc exists

Context Bridge today is an **MCP server**: a stdio process consumed by Copilot Chat. V3Code (our Void fork) has its own chat (`chatThreadService` → `convertToLLMMessageService` → `sendLLMMessage`) that bypasses Copilot and therefore bypasses CB. The "never forget" + "structural code intelligence" guarantees that CB gives Copilot users do **not** apply to V3Code users today.

This doc specifies the work to make CB **native** inside V3Code — meaning:

1. Every V3Code chat thread starts with project briefing already in the system prompt (no tool round-trip).
2. Persistent symbol notes (`remember()`) auto-surface the moment the user stages a related file in chat.
3. The V3Code agent can call `remember` / `list_notes` / `pack_context` / `get_symbol_context` as first-class tools alongside file-edit/run tools, with the existing approval UX.
4. End-of-thread digests propose Session Memory bullets + `remember()` candidates.
5. A **local workspace indexer** (Copilot-class, but LSP-aware) powers semantic file/symbol retrieval and feeds the auto-inject layer.

No new external services. No MCP IPC inside V3Code. Everything in-process.

---

## 1. Codebase reality check (what we have to work with)

### 1.1 V3Code chat plumbing
- `[vselite/src/vs/workbench/contrib/void/browser/chatThreadService.ts](src/vs/workbench/contrib/void/browser/chatThreadService.ts)` — owns threads, calls `prepareLLMChatMessages` at line ~780 then `sendLLMMessage` at line ~805.
- `[vselite/src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts](src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts)` — turns thread state into the LLM payload. **This is the single injection point** — touch it once and every V3Code chat is CB-aware.
- `[vselite/src/vs/workbench/contrib/void/common/sendLLMMessageService.ts](src/vs/workbench/contrib/void/common/sendLLMMessageService.ts)` — wire protocol to the model.
- Staging-selection flow (the @-mention / file-attach mechanism) is in `[sidebarActions.ts](src/vs/workbench/contrib/void/browser/sidebarActions.ts)` lines 71+, 97+, 123+, 133+.

### 1.2 V3Code process layering (renderer vs main)
- `vselite/src/vs/workbench/contrib/void/browser/` — **renderer process**. No `fs`, no `child_process`. Uses VS Code services (`IFileService`, etc.).
- `vselite/src/vs/workbench/contrib/void/common/` — shared types + service decorators usable from either side.
- `vselite/src/vs/workbench/contrib/void/electron-main/` — **main process**. Full Node. Exposes services to renderer via IPC channels (VS Code's `ProxyChannel` pattern).
- Verified: there are **no** `fs`/`child_process`/`node:*` imports in `browser/` today.

**Implication:** CB's briefing builder (calls `git log`, walks dirs, reads `AGENTS.md`) and memory store (reads/writes `.context-bridge/notes.json`) cannot run in `browser/`. They live in `electron-main/`, fronted by a `common/` service interface, called from `browser/`.

### 1.3 CB MCP server (what we'd be reusing)
- `[context-bridge/mcp-server/src/briefing.ts](../context-bridge/mcp-server/src/briefing.ts)` — pure Node, exports `collectBriefingBundle()`, `buildBriefing()`. No MCP deps.
- `[context-bridge/mcp-server/src/memory.ts](../context-bridge/mcp-server/src/memory.ts)` — pure Node, exports `MemoryStore`. No MCP deps.
- `[context-bridge/mcp-server/src/lsp-bridge.ts](../context-bridge/mcp-server/src/lsp-bridge.ts)` — talks to a *separate* `typescript-language-server` over stdio. **Won't reuse in V3Code** — V3Code IS the LSP host. We'll wrap V3Code's `ILanguageFeaturesService` instead (cheaper and live).
- `mcp-server/src/tools/*` — MCP-protocol wrappers. **Not reused.**
- `mcp-server/src/index.ts`, `cli.ts`, `resources.ts` — MCP server entry. **Not reused.**

**Reusable surface:** ~2 files (briefing.ts + memory.ts). The LSP layer is **replaced** by a V3Code-native one that's strictly better — live workspace LSP, no separate process, no `tsserver` cold start.

---

## 2. Architectural decision — extract or port?

**Decision: extract briefing.ts + memory.ts into a shared lib; port the LSP bridge to V3Code-native.**

### Option A — Extract shared lib `@context-bridge/core` *(chosen)*
- Pros: single source of truth for briefing format + note schema; MCP server and V3Code stay in lockstep; CB version bumps propagate to both.
- Cons: monorepo plumbing (workspaces / file: deps); the shared lib must stay free of MCP/Node assumptions that V3Code can't honour (already true).
- Cost: half a day to set up the package boundary and update imports in the MCP server.

### Option B — Port logic into V3Code, copy-paste briefing format
- Pros: zero monorepo plumbing.
- Cons: two implementations of the same briefing/notes logic drift the first time someone tweaks one side. Death.

**Verdict:** A. Set up `context-bridge/core/` as a workspace package, move `briefing.ts` + `memory.ts` + `types.ts` into it, have both `context-bridge/mcp-server/` and `vselite/` import it as `@context-bridge/core`.

### LSP layer — V3Code-native
Inside V3Code, use `ILanguageFeaturesService` + the editor model store directly. Wrap them behind a `IContextBridgeLspService` so the renderer-side code calls the same shape `lsp-bridge.ts` exposes today (`getDefinition`, `findReferences`, `getSymbolKind`, etc.). This is a ~300-line file in `browser/` (LSP queries are renderer-safe — they go through V3Code's already-running LSPs).

---

## 3. Phased plan

### Phase 0 — Extract shared core *(starts immediately)*
**Goal:** `@context-bridge/core` exists, MCP server still works, V3Code can import it.

Tasks:
1. Create `context-bridge/core/` with its own `package.json` (`"name": "@context-bridge/core"`, no deps beyond Node stdlib + `vscode-languageserver-types`).
2. Move `briefing.ts`, `memory.ts`, `types.ts` into `core/src/`. Add `index.ts` barrel.
3. Update `context-bridge/mcp-server/` to consume via workspace dep (`"@context-bridge/core": "*"` + npm workspaces or `file:../core`).
4. Add to `vselite/`'s build picking-up path (the Void build uses gulp + tsc; needs a thin entry in `vselite/build/` to copy/link the core lib).
5. CI: MCP server unit tests still green.

**Out of scope phase 0:** any V3Code consumer wiring — just make the lib exist and the MCP server keep working.

**Acceptance:** `cd context-bridge/mcp-server && npm test` passes; `cd context-bridge/core && tsc --noEmit` clean; `vselite/` build doesn't break.

### Phase 1 — V3Code-native LSP bridge + auto-inject briefing
**Goal:** every new V3Code thread starts with project briefing in the system message.

Tasks:
1. `vselite/src/vs/workbench/contrib/void/electron-main/contextBridgeService.ts` — new main-process service. Wraps `@context-bridge/core`'s briefing builder + `MemoryStore`. Exposes:
   - `getBriefing(workspaceRoot): Promise<{ text: string; tokenEstimate: number }>`
   - `listAllNotes(): Promise<SymbolNote[]>`
   - `getNotesForFile(file): Promise<SymbolNote[]>`
   - `remember(file, symbol, note): Promise<{ id: string }>`
   - `forget(id): Promise<boolean>`
2. `vselite/src/vs/workbench/contrib/void/common/contextBridge.ts` — service decorator `IContextBridgeService` + types (re-export from `@context-bridge/core`).
3. Wire IPC channel in `electron-main/voidMainContribution.ts` (or equivalent — check Void's existing pattern).
4. `vselite/src/vs/workbench/contrib/void/browser/contextBridgeBriefingCache.ts` — renderer-side cache. One briefing per workspace, invalidated on AGENTS.md change (use `IFileService.watch` on AGENTS.md path) or thread start.
5. Modify `convertToLLMMessageService.prepareLLMChatMessages` — prepend briefing block to the system message if the thread is on its **first turn**. Mark the block with `<context-bridge>...</context-bridge>` sentinels so a future end-of-thread digest can strip it before summarizing.
6. Token budget guard: hard cap briefing at **2,500 tokens**. If it exceeds, truncate file-tree section first, then git-log, never AGENTS.md content.

**Acceptance:** opening a fresh thread in V3Code chat, the model's first response demonstrates awareness of `## Recent Changes` (test: ask "what's been worked on recently?" — model should cite an AGENTS.md bullet without us pasting anything). Token usage in dev tools shows the preamble ≤ 2,500 tokens.

### Phase 2 — Auto-surface symbol notes on staging-selection
**Goal:** when user attaches a file/selection to chat, any `remember()` notes for symbols in that file appear in the next turn's system message.

Tasks:
1. In `chatThreadService.addNewStagingSelection`, after the selection is recorded, fire-and-forget `contextBridgeService.getNotesForFile(uri)` and stash results on the thread.
2. In `convertToLLMMessageService.prepareLLMChatMessages`, append a `<context-bridge-notes>` block to the system message containing the stashed notes for currently-staged files. Per-turn (not first-turn-only).
3. Render the notes inline in the staged-selection UI badge (`Sidebar.tsx` staging area) so the user *sees* what's being injected. Click to expand the note text. Click X to suppress for this turn.

**Acceptance:** stage `AgentPanelService.ts`, the note pinned in the previous session ("Mode state has TWO drivers…") shows on the badge AND in the model's next response context.

### Phase 3 — Native `remember` / `list_notes` / `get_symbol_context` tools
**Goal:** the agent itself can pin findings and look up symbols mid-conversation without going outside V3Code.

Tasks:
1. Register CB operations in Void's tool registry (find Void's tool registration — likely in `chatThreadService` or a sibling `tools/` folder). Tools:
   - `remember(file, symbol, note)` → `contextBridgeService.remember(...)` → returns `{ id }`.
   - `forget(id)` → ditto.
   - `list_notes(file?)` → ditto.
   - `get_symbol_context(file, symbol)` → use the V3Code-native LSP bridge from Phase 1.
   - `pack_context(file, symbol, task)` → port `mcp-server/src/tools/pack-context.ts` logic to call the native LSP bridge.
2. Tools go through Void's existing approval UX (auto-approve, ask, deny per-tool config).
3. Default approval: `list_notes` / `get_symbol_context` / `pack_context` auto-approve (read-only); `remember` / `forget` ask (writes to .context-bridge/notes.json).

**Acceptance:** in a V3Code chat, ask "summarize how `AgentPanelService.toggle` flows" — agent calls `pack_context`, gets back the callers/callees/refs bundle, answers from that data without us pasting code.

### Phase 4 — Workspace indexer *(the Copilot-equivalent)*

**Why we need this:** auto-inject + symbol-attached notes are great for *named* things (you have to know the symbol). For broad questions ("where do we handle scrollback?", "what's the auth flow?") we need semantic retrieval over the whole workspace. Copilot has one; without it our agent is blind to anything not explicitly @-staged.

**Architecture:**
- **Chunker** — chunks code by LSP symbol boundary (better than Copilot's line-window approach). Falls back to 40-line window for unsupported languages.
- **Embedder** — local-first. Default: `nomic-embed-text` via Ollama (if available) → fallback: `Xenova/bge-small-en-v1.5` via `transformers.js` bundled. No remote calls without explicit user opt-in.
- **Vector store** — SQLite + `sqlite-vec` extension. Persisted at `.context-bridge/index.db` at workspace root.
- **Watcher** — `IFileService.watch` on workspace, incremental re-embed on save. Debounce 2s. Respect `.gitignore` + `.context-bridge/ignore` patterns.
- **Retrieval** — hybrid: vector top-K + structural neighbors (callers/callees of vector hits via LSP) + grep fallback. Return ranked symbols, not raw text.
- **Cold start** — first index of a fresh workspace runs in the background, progress reported in the agent panel status strip. User can chat during indexing; retrieval is best-effort until ready.

**Tasks:**
1. `context-bridge/core/src/indexer/` — chunker, embedder interface, sqlite-vec store. Pure Node, no V3Code deps.
2. Two embedder implementations: `OllamaEmbedder` (HTTP to `localhost:11434`) and `LocalTransformersEmbedder` (bundled `transformers.js`).
3. `electron-main/contextBridgeService.ts` adds `queryWorkspace(query: string, k: number): Promise<RetrievalHit[]>`.
4. Watcher service in `electron-main/` triggers re-embed on file save.
5. Phase 1's `prepareLLMChatMessages` injection now also calls `queryWorkspace(userMessage, k=5)` and appends top hits as `<context-bridge-relevant>` block.
6. UI: status indicator in agent pane shows "Index: 12,341 chunks · last update 2s ago".
7. Privacy: an opt-in flag in V3Code settings (`v3code.contextBridge.embedder: "ollama" | "local-bundled" | "off"`).  Default `local-bundled` so it works offline out of the box.

**Acceptance:** ask "where is keybinding registration done?" in a fresh chat — agent gets a `<context-bridge-relevant>` block pointing at the relevant `*.contribution.ts` files without us staging anything.

### Phase 5 — End-of-thread digest
**Goal:** when a thread is closed/archived/exceeds token budget, propose `remember()` candidates + AGENTS.md Session Memory bullet for one-click confirmation.

Tasks:
1. Scan thread messages for gotcha/TIL/constraint/warning patterns via small local classifier (regex bank to start; LLM call later if needed).
2. UI panel in agent pane: "End of thread — save these?" with checkboxes.
3. On confirm: write to `MemoryStore.remember()` + append bullet to active project's `AGENTS.md` `## Session Memory`.

This is the only phase that needs new UI surface area; Phases 0–4 are pure wiring + one config setting.

---

## 4. Shape of the injected system-message preamble

```
<context-bridge version="1">
  <briefing>
    # Project: vselite
    ## File tree (depth 3, 47/127 entries)
    […compressed tree…]

    ## Recent git (last 10)
    [hash] message — 2h ago
    […]

    ## AGENTS.md — Recent Changes
    - 2026-05-27 — [latest bullet]
    - [9 more]

    ## AGENTS.md — Session Memory
    - [latest 5 bullets]

    ## Persistent notes
    - AgentPanelService (browser/agentPanelService.ts:24)
      Mode state has TWO drivers: explicit toggle()/setMode()…
    [N more]
  </briefing>
  <relevant query="user's first message">
    [Phase 4 vector hits, top 5]
  </relevant>
  <notes-for-staged>
    [Phase 2 notes for @-staged files]
  </notes-for-staged>
</context-bridge>

[normal system prompt continues here]
```

Sentinel tags are model-readable and easy to strip for digest. Token budget enforced before injection:
- `<briefing>` cap: 2,500 tokens (Phase 1)
- `<relevant>` cap: 1,500 tokens (Phase 4)
- `<notes-for-staged>` cap: 500 tokens (Phase 2)
- **Total CB preamble cap: 4,500 tokens.** If a model has < 32k context the cap drops to 2,500 (briefing only, no semantic).

---

## 5. What NOT to build

- **Do NOT re-fork the LSP.** V3Code is the editor. Query its services. Never spawn `tsserver` again.
- **Do NOT round-trip through the MCP server from inside V3Code.** Same process, direct calls.
- **Do NOT auto-summarize the whole transcript** (Cursor's pattern, dies under bloat). Our digest is targeted: extract candidates, ask the user, save symbol-attached notes.
- **Do NOT embed `node_modules`, `dist/`, `out/`, lockfiles, or anything in `.gitignore`.** Indexer respects gitignore + a `.context-bridge/ignore` allowlist additive.
- **Do NOT auto-call `remember()` from the agent without approval.** Writes are user-confirmed (Phase 3 default config).
- **Do NOT send embeddings to a remote service by default.** Bundled local embedder is the default. Remote (Ollama) is opt-in, OpenAI/etc never.

---

## 6. Risks + open questions

| Risk | Mitigation |
|---|---|
| `transformers.js` bundle bloats V3Code installer | Ship as optional download on first index, gate behind `Index this workspace?` prompt. |
| LSP queries via V3Code's `ILanguageFeaturesService` may not surface all the same data as `lsp-bridge.ts` (which talks raw stdio) | Audit feature parity in Phase 1; fall back to a packaged LSP only if a feature is missing. |
| Briefing token budget regresses for large projects | Phase 1 includes a hard truncation order. Add telemetry in dev builds to track actual token sizes. |
| Indexer cold-start UX for a fresh clone is bad if first chat happens immediately | Status strip shows progress; retrieval returns partial best-effort during indexing. |
| `sqlite-vec` native binary across platforms (win32/macOS/linux × x64/arm64) | Use `better-sqlite3` + manual vector math fallback if `sqlite-vec` unavailable. |

**Open questions for Daniel:**
1. Embedder default — `local-bundled` (zero-config, ~80MB) or prompt user to install Ollama on first run?
2. Notes storage — workspace-local `.context-bridge/notes.json` (current) or per-user `~/.context-bridge/notes-by-workspace.json` (survives `rm -rf workspace`)? Lean current.
3. Indexer ignore list — gitignore-only, or add a default deny for `*.lock`, `*.min.js`, `dist/`, `out/`, `build/`, `coverage/`, `*.snap`?
4. Sprint 2 of the agent panel — pause until Phase 1 lands, or interleave?

---

## 7. Sequencing

```
Phase 0 (core extraction)  — half-day                 ← START
  └─ Phase 1 (auto-inject briefing)  — 1 day          ← unlocks 80% of the value
       └─ Phase 2 (staged-file notes)  — half-day
       └─ Phase 3 (native tools)  — 1 day
            └─ Phase 4 (workspace indexer)  — 2–3 days  ← the Copilot-equivalent
                 └─ Phase 5 (end-of-thread digest)  — 1 day
```

Phase 1 is the shipping unit. Everything after it is additive and shippable independently.

---

## 8. Naming + branding

- Public surface inside V3Code calls this **"Context Bridge"** (capitalized) — already the brand. Settings keys use `v3code.contextBridge.*`.
- The bundled core lib stays `@context-bridge/core` so the CB OSS story stays consistent.
- Status strip label in the agent pane: `CB · indexed 12,341 · notes 47`.

---

## 9. Out-of-band dependencies

- `sqlite-vec` (Phase 4) — Apache-2.0, ok to bundle.
- `@xenova/transformers` (Phase 4 local embedder) — Apache-2.0, ok to bundle.
- `better-sqlite3` (Phase 4) — MIT, already familiar in Electron land.
- Nothing else; Phases 0–3 use only what V3Code already ships.

---

## 10. Done definition

We can call this initiative done when, in a fresh V3Code session against any workspace with an `AGENTS.md`:

1. First chat message sees project state without us pasting it.
2. Staging a file shows attached symbol notes inline before the message is sent.
3. The agent can pin findings via a native tool call.
4. Asking "where is X" returns LSP-accurate + semantically-relevant files with no @-mention.
5. Closing a thread proposes Session Memory bullets the user clicks through.
6. None of this leaves the user's machine without explicit opt-in.

Everything else is polish.
