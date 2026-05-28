# V3Code — Build Plan & Codebase Map

Fork of [Void Editor](https://voideditor.com) (Apache 2.0). Void is a VS Code fork that ships a built-in AI chat / agent / Cmd+K / autocomplete / Apply stack. Upstream is paused — clean license, no rebase politics, our playing field.

Domain: **v3code.dev** (registered).

Our wedge: ship the editor with **Context Bridge** wired in as the structural context engine, plus a local embeddings index to close the one real gap vs GitHub Copilot.

---

## Codebase orientation

All Void-specific code lives under `src/vs/workbench/contrib/void/`. Standard VS Code three-process split: `common/` (shared types/services), `browser/` (renderer UI + services), `electron-main/` (main-process services like LLM calls and MCP).

### The files that matter

| Concern | File(s) | What it does |
|---|---|---|
| **Chat sidebar UI** | `browser/sidebarPane.ts` + `browser/react/` | Where the chat panel renders |
| **Agent / tool loop** | `browser/chatThreadService.ts` | Runs the chat thread, calls tools, manages messages |
| **Tool dispatcher** | `browser/toolsService.ts` + `common/toolsServiceTypes.ts` | Registers + executes built-in tools (read_file, edit, terminal, etc.) |
| **Apply system** | `browser/editCodeService.ts` + `common/editCodeServiceTypes.ts` | Fast (search/replace blocks) + Slow (full rewrite) Apply variants |
| **Autocomplete (FIM)** | `browser/autocompleteService.ts` + `browser/contextGatheringService.ts` | Inline completions. ContextGathering is for FIM only — NOT chat |
| **Cmd+K inline edits** | `browser/quickEditActions.ts` | Selection-scoped edits |
| **Terminal tool** | `browser/terminalToolService.ts` | Agent terminal exec |
| **Git AI** | `browser/voidSCMService.ts` + `electron-main/voidSCMMainService.ts` | AI commit messages, etc. |
| **LLM provider abstraction** | `common/sendLLMMessageService.ts` + `electron-main/llmMessage/sendLLMMessage.impl.ts` | Single entry point for all providers |
| **Provider definitions** | `common/voidSettingsTypes.ts` | Anthropic, OpenAI, DeepSeek, OpenRouter, Gemini, Groq, xAI, Mistral, Azure, Ollama, vLLM, LM Studio, liteLLM, Vertex, openAI-compatible |
| **Model registry** | `common/modelCapabilities.ts` | Context windows, capabilities. Must update for new models |
| **System prompts** | `common/prompt/prompts.ts` | Search/replace block format, dirstr budgets, agent prompts |
| **MCP client (already shipped)** | `common/mcpService.ts` + `electron-main/mcpChannel.ts` | Connect to external MCP servers from the chat |
| **Settings** | `common/voidSettingsService.ts` + `browser/voidSettingsPane.ts` | Provider keys, model picks, chat modes |
| **Onboarding** | `browser/voidOnboardingService.ts` | First-run flow |
| **Service registration template** | `browser/_dummyContrib.ts` | Pattern for registering a new service |
| **Branding (single source of truth)** | `product.json` (root) | nameShort, applicationName, dataFolderName, urlProtocol, win32 IDs |
| **Icons** | `void_icons/` (root) | App icons, splash assets |
| **Agent rules (inherited)** | `.voidrules` (root) | Naming convention `bOfA`, no `any` casts, semicolon convention, scope to `contrib/void/` |

### Concepts to know

- **ChatMode** = `normal` | `gather` | `agent` — controls how aggressively the chat uses tools
- **FeatureName** = `Autocomplete` | `Chat` | `CtrlK` | `Apply` — each can be wired to a different model
- **Apply Fast vs Slow** — Fast applies search/replace blocks from the model; Slow regenerates the whole file
- **DiffZone / DiffArea** — how proposed edits are surfaced before accept/reject

---

## What we keep vs replace vs add vs differ

### Keep (Void ships it, works fine)
- Chat UI shell, sidebar, settings pane
- Agent loop + tool dispatcher
- Apply (fast + slow) + DiffZones
- Cmd+K, autocomplete, terminal tool, git AI
- All 13+ LLM providers including **DeepSeek (v4 Pro will work out of the box)** and BYOK
- MCP client plumbing (for user's own external MCP servers — not ours)
- Void's `prompts.ts` scaffolding (search/replace block format, dirstr budgets, agent loop structure)

### Replace / rebrand
- `product.json` — every brand string (~20 fields): `nameShort`, `nameLong`, `applicationName`, `dataFolderName`, `win32MutexName`, `darwinBundleIdentifier`, `linuxIconName`, `urlProtocol`, win32 AppIds (need new UUIDs), `voidVersion` / `voidRelease`
- `void_icons/` — swap art
- Marketplace gallery URL — currently points to MS Marketplace, must swap to **Open VSX** (license terms)
- About dialog / splash strings (grep `Void`)
- `.voidrules` → rename or keep; rename ourselves in any agent-facing copy

### Add (our moat — never published, editor-internal only)
- **Context Bridge as built-in tools** — all 9 primitives compiled directly into the binary via `toolsService.ts`. No MCP wire, not discoverable, closed-source. This is V3Code's structural intelligence engine.
- **Local embeddings index** (`sqlite-vec`) — closes the one real gap vs Copilot `@workspace`. Void doesn't have it. Cursor charges $20/mo partly for this. We ship it for free. Big moat.
- **Memory / notes system** — `remember`/`forget`/`list_notes`, persistent across sessions
- **Port our Cursor-lineage prompts into `prompts.ts`** — merge with Void's scaffolding. Our prompts are battle-tested and powerful; Void's structure (search/replace block format, dirstr budgets) is solid. Goal: keep both wins, fuse into one prompt system. Don't throw either away.
- Optional later: trajectory recording (port from `trae-agent` pattern — JSON log of every agent step, useful for debug and could be a paid feature)

### Defer (v2)
- Hosted paid-model marketplace (Trae-style billing on top of BYOK). Requires Stripe + token metering + LLM proxy backend. Skip until product-market fit.
- Cloud sync of memory/settings
- Team features

---

## What we lose vs GitHub Copilot Chat (and how to close it)

| Copilot has | Void has | Plan |
|---|---|---|
| `@workspace` semantic index (vector embeddings of whole repo) | ❌ Not built in | **Add `sqlite-vec` index, embed with BYOK key. v0.2 priority.** This is the one real gap. |
| Cloud-side chunk reranking | ❌ | Local reranking with structural signals from Context Bridge graph |
| Recency / edit-history signals | ❌ | Track file access in Context Bridge memory layer |
| Curated model catalog (locked) | ✅ 13+ providers, BYOK | **We win here** |
| **MCP support (half-baked in Copilot)** | ✅ Native client (user's own servers) | **We win here** |
| DeepSeek | ❌ | ✅ **We win here** |
| Custom system prompts | Limited | ✅ Full control |
| Cmd+K, Apply, terminal tool | ✅ All shipped | Parity |

**Bottom line:** one real gap (embeddings), already solvable, plus we beat Copilot on provider choice + MCP + DeepSeek + prompt control.

---

## Context Bridge integration — editor-internal only

**The Context Bridge MCP extension never ships publicly.** It was a prototype. Now it's V3Code's structural intelligence engine — compiled directly into the editor binary via `toolsService.ts`. No MCP wire, not discoverable via `tools/list`, not readable as source. It's what makes V3Code's AI actually understand your code.

All 9 tools (`get_symbol_context`, `get_file_context`, `get_call_graph`, `get_file_dependencies`, `find_text`, `pack_context`, `remember`, `forget`, `list_notes`) ship as built-in tools. The `pack_context` composer, graph cache, memory layer, and file watcher are editor-exclusive — never exposed through any public API.

**Integration path:** register directly in `browser/toolsService.ts` as native tools. No MCP serialization overhead. Tool surface stays inside the closed-source binary. ~1-2 days of work.

---

## Build & run (Windows cheat sheet)

**Prerequisites (one-time):**
1. **Visual Studio 2022 Community** with workloads: `Desktop development with C++` + `Node.js build tools`
2. Individual components: `MSVC v143 Spectre-mitigated libs`, `C++ ATL Spectre`, `C++ MFC Spectre`
3. **Node 20.18.2** (from `.nvmrc`). Install via `nvm install` then `nvm use` from the repo root — don't change global Node
4. Path to the repo **must not contain spaces** (we're good: `C:\Users\heave\Desktop\vselite`)

**Build steps:**
```powershell
cd C:\Users\heave\Desktop\vselite
nvm use                                # picks up .nvmrc
npm install                            # ~10-15 min, native modules
# Then either:
#   (A) Open this folder in VS Code, press Ctrl+Shift+B, wait for 2/3 spinners → checkmarks (~5 min)
#   (B) From terminal: npm run watch  (wait for "Finished compilation with 0 errors")
.\scripts\code.bat --user-data-dir .\.tmp\user-data --extensions-dir .\.tmp\extensions
```

The `--user-data-dir` / `--extensions-dir` flags isolate dev state so you can nuke `.tmp/` to reset.

**Reload after code changes:** Ctrl+R inside the dev window (don't restart the whole build).

**Common gotchas:**
- React errors → `$env:NODE_OPTIONS="--max-old-space-size=8192"; npm run buildreact`
- "Failed to fetch dynamically imported module" → an import is missing `.js` extension
- Missing styles on first load → wait a few seconds, then Ctrl+R

**`.voidrules` agent rule:** don't run validation commands — describe what the user should run. Honoring it.

---

## Build order

1. **Get it building locally.** Follow `HOW_TO_CONTRIBUTE.md`. Don't change anything else until `./scripts/code.bat` launches a clean editor window.
2. **Use it for an hour.** Configure your DeepSeek key. Try the chat. See where it falls short of Copilot. Note the UX punch-list.
3. **Rebrand sweep.** `product.json` + icons + Open VSX swap. Half-day.
4. **Wire Context Bridge as built-in tools.** Register all 9 primitives in `toolsService.ts`. 1-2 days.
5. **Merge our Cursor-lineage prompts into `prompts.ts`.** Keep Void's scaffolding, inject our behavioral DNA. 1 day.
6. **Add `sqlite-vec` workspace index.** Closes the Copilot embedding gap. ~1 week.
7. **Dogfood for 2 weeks.** Fix the friction. Tune prompts only where measurably weak.
8. **First public build.** Open VSX listing, Windows installer, signed binary.
9. **(v2) Hosted model marketplace** — only if there's demand and we have ad budget burning.

---

## Inherited rules from `.voidrules`

- Code we own lives in `src/vs/workbench/contrib/void/` — keep it that way unless absolutely necessary
- No casting to `any`. No unnecessary type casts.
- Don't add/remove semicolons — match existing convention
- Hashmap naming: `bOfA` (e.g. `nameOfId`, not `idToName`)
- Don't run validation commands — describe what the user should run

---

## Open questions to answer during dogfooding

- Is Void's chat UX good enough as-is, or does the sidebar need a redesign?
- Do we need streaming partial tool results (Trae's "Lakeview" pattern)?
- Which provider is best for agent loops? (DeepSeek v4 Pro is the bet — verify empirically)
- Does the existing Apply system handle Context Bridge's structural suggestions cleanly, or do we need a new merge UI?
- Where do Void's prompts underperform Cursor's? (don't refactor preemptively)
