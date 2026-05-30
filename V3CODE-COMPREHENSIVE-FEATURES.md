# V3Code — Comprehensive Features Reference

> **The editor whose AI actually understands your code.**
> Last updated: May 30, 2026
> Source: `vselite/` codebase, git history, AGENTS.md, and all spec docs.

---

## Table of Contents

1. [Identity & Positioning](#1-identity--positioning)
2. [Core Editor (Void Base)](#2-core-editor-void-base)
3. [AI Chat & Agent System](#3-ai-chat--agent-system)
4. [Context Bridge — Structural Intelligence Engine](#4-context-bridge--structural-intelligence-engine)
5. [Semantic Index (Local Embeddings)](#5-semantic-index-local-embeddings)
6. [VIBE Mode — Agent-Forward Layout](#6-vibe-mode--agent-forward-layout)
7. [Agent Panel — Multi-Chat Workspace](#7-agent-panel--multi-chat-workspace)
8. [V Companion — AI Alien Sidekick](#8-v-companion--ai-alien-sidekick)
9. [LLM Providers & Model Registry](#9-llm-providers--model-registry)
10. [Apply System (Fast + Slow)](#10-apply-system-fast--slow)
11. [Built-in Tools Registry (27 Tools)](#11-built-in-tools-registry-27-tools)
12. [Memories & Notes System](#12-memories--notes-system)
13. [Auto-Context Pipeline](#13-auto-context-pipeline)
14. [Todo/Plan Tracking](#14-todoplan-tracking)
15. [Background Agent / Subagent System](#15-background-agent--subagent-system)
16. [Slash Commands](#16-slash-commands)
17. [Chat UX Features](#17-chat-ux-features)
18. [Edit & Diff System](#18-edit--diff-system)
19. [Terminal Tools](#19-terminal-tools)
20. [Git Integration](#20-git-integration)
21. [Web Search & Browser](#21-web-search--browser)
22. [Autocomplete (FIM)](#22-autocomplete-fim)
23. [Cmd+K Inline Edits](#23-cmdk-inline-edits)
24. [MCP Client (External Servers)](#24-mcp-client-external-servers)
25. [Competitive Comparison](#25-competitive-comparison)
26. [What's Planned](#26-whats-planned)

---

## 1. Identity & Positioning

- **Name:** V3Code
- **Domain:** `v3code.dev` (owned)
- **Architecture:** Closed-source premium fork of [Void Editor](https://voideditor.com) (Apache 2.0 VS Code fork)
- **Built by:** Daniel (KandD Labs)
- **Tagline:** "The editor whose AI actually understands your code."
- **The wedge:** Context Bridge as native built-in structural intelligence + local embeddings index — the AI doesn't guess, it reads the LSP graph.

---

## 2. Core Editor (Void Base)

All standard VS Code features plus Void's AI layer:

| Feature | Status |
|---|---|
| Full VS Code editor (Monaco) | ✅ Inherited |
| File explorer, search, source control | ✅ Inherited |
| Extensions (Open VSX marketplace) | ✅ Swapped from MS Marketplace |
| Settings editor | ✅ |
| Command palette | ✅ Rebranded "V3Code:" prefix |
| Terminal | ✅ Integrated |
| Debugger | ✅ Inherited |
| Remote development (SSH/WSL/Containers) | ✅ Inherited |
| Workspace trust | ✅ Inherited |

### Branding (product.json)
- `applicationName: v3code`
- `dataFolderName: .v3code`
- `urlProtocol: v3code`
- `darwinBundleIdentifier: dev.v3code.code`
- All ~20 brand strings replaced from Void → V3Code
- Market switched to Open VSX

---

## 3. AI Chat & Agent System

### Chat Modes
| Mode | Description |
|---|---|
| **Normal** | Standard chat, no tool usage |
| **Gather** | Read-only context gathering (search, read files) |
| **Agent** | Full tool loop — read, edit, execute, git |

### Chat Architecture
- **`chatThreadService.ts`** — Agent loop: manages threads, messages, tool calls, streaming
- **`convertToLLMMessageService.ts`** — Single injection point for system prompts — every chat gets Context Bridge auto-injected
- **Multi-thread chat** — Independent concurrent chat sessions with tabs
- **Streaming responses** — Real-time token streaming from all providers
- **Tool call cards** — Visual display of tool invocations with results inline
- **Reasoning/thinking** — Translucent reasoning cards for thinking models (DeepSeek R1, Claude)
- **Checkpoints** — Divider markers between agent steps
- **Message editing** — Edit previous messages to re-prompt
- **@-mention system** — Mention files, symbols, folders in chat
- **Image input** — Paperclip button + Ctrl+V paste for image uploads
- **Chat activity banner** — Shows active agent status
- **Agent mode pill** — Colored indicator showing agent mode state

---

## 4. Context Bridge — Structural Intelligence Engine

**The crown jewel.** Native built-in (NOT MCP, NOT external process). Always on, always works.

### Architecture
```
V3Code Binary
├── LspBridgeAdapter (renderer, uses VS Code's in-process LSP)
│   └── NO subprocess, NO stdio — wraps ILanguageFeaturesService directly
├── ContextBridgeService (main process, Node)
│   └── briefing builder + MemoryStore
└── contextBridgeTools.ts (pure functions, called from toolsService)
```

### 11 Built-in CB Tools

#### Structural Intelligence (LSP-backed)

| Tool | What It Does |
|---|---|
| **`get_symbol_context`** | Everything about one symbol — definition, callers, callees, references, type hierarchy, diagnostics, attached notes. Auto-injects persistent notes for the resolved symbol. |
| **`get_file_context`** | All symbols, imports, exports, and diagnostics for one file. Structural overview. |
| **`get_call_graph`** | Recursive N-level caller/callee tree (depth 1–4). Cycle-safe. Direction: `incoming` or `outgoing`. |
| **`get_file_dependencies`** | Two-way dependency map — what this file imports (with resolved paths), who imports it, external packages. |
| **`pack_context`** | Task-typed token-budgeted bundle. Modes: `understand`, `refactor`, `debug`, `extend`. Selects right slice of callers/callees/refs based on task. |
| **`get_project_briefing`** | Project snapshot — file tree (depth 3, 200 entries), recent git commits, AGENTS.md memory, all symbol notes. Cached with 30s TTL, invalidated on journal file changes. |

#### Memory (Persistent Symbol Notes)

| Tool | What It Does |
|---|---|
| **`remember`** | Attach a persistent note to a symbol — survives across sessions, auto-injects when symbol is queried |
| **`forget`** | Delete a saved note by ID |
| **`list_notes`** | List all persistent notes (filterable by file) |

#### Search

| Tool | What It Does |
|---|---|
| **`find_text`** | Literal/regex workspace text search with context lines. For comments, strings, config — things LSP doesn't track. |
| **`semantic_search`** | Hybrid vector + FTS5 lexical codebase search. Finds code by *meaning*, not exact text. RRF-merged results. |

### Key Design Properties
- **All 11 tools are native built-ins** — registered in `toolsService.ts`, never exposed over MCP
- **LSP bridge is in-process** — wraps VS Code's `ILanguageFeaturesService`, no separate tsserver
- **Notes persist** at `<workspace>/.v3code/notes.json`
- **Briefing cache** — 30s TTL, watcher-invalidated on AGENTS.md/git changes
- **Outline cache** — per `(uri, model.getVersionId())`, 64-entry LRU
- **Telemetry** — `[cb-tool] tool=NAME duration_ms=N ok=true|false` per invocation (no PII)

---

## 5. Semantic Index (Local Embeddings)

**Local-first, zero-upload codebase indexing.** The Copilot `@workspace` equivalent — but stays on your machine.

### Architecture
```
IndexerService (browser, workbench contribution)
    ↓ postMessage
indexer.worker.ts (Node worker thread)
    ↓ writes
.v3code/index.db (sqlite + sqlite-vec + FTS5)
    ↓ reads
RetrieverService (browser)
    ↓ consumed by
ContextPackerService → Agent LLM
```

### Components

| Component | File | Description |
|---|---|---|
| **Chunker** | `chunker.ts` + `chunkerLanguages.ts` | Tree-sitter semantic chunking — one chunk = one function/class/method/interface/type/enum. NOT line windows. 10 languages supported (TS, JS, TSX, JSX, Python, Go, Rust, Java, C#, C++, Ruby). Fallback: file-level chunk. |
| **Embedder** | `embedder.ts` | Default: `Xenova/jina-embeddings-v2-base-code` via transformers.js (768d, ~150MB). Auto-fallback: `all-MiniLM-L6-v2` (384d) if RAM < 4GB. |
| **Vector Store** | `database.ts` | sqlite-vec for vectors + FTS5 for lexical + chunks table. One file: `.v3code/index.db` |
| **Query Expander** | `queryExpander.ts` | HyDE (Hypothetical Document Embeddings) — rewrites user prompt into code terms + hypothetical code snippet. Bundled Qwen2.5-Coder-0.5B-Instruct GGUF for local expansion. Cached per `SHA(prompt)` for 24h. |
| **Retriever** | `retriever.ts` | 4-channel retrieval: original vec + expanded terms vec + HyDE vec + FTS5. RRF-merged (k=60). |
| **RRF** | `rrf.ts` | Reciprocal Rank Fusion utility. |
| **Incremental Indexing** | `hashing.ts` + watcher | SHA-256 per chunk. Only re-embeds changed chunks. File-watcher pipeline with 2s debounce. |
| **Gitignore Honors** | `gitignore.ts` | Respects `.gitignore`, `files.exclude`, and `v3code.semanticIndex.exclude`. Skips `node_modules`, `dist`, `.git`, etc. |

### Status Surface
- Status bar item: `$(database) V3Code Index: 1,247 files indexed · ✓`
- Click → quickpick: rebuild, status, exclude pattern, switch model
- Command palette: "V3Code: Rebuild Codebase Index", "V3Code: Show Index Status"
- Sidebar footer: `semanticIndexSidebarFooter.ts`
- Auto-start: `semanticIndexAutoStart.ts`

### Key Design Decisions
- **Local-first, BYOK-friendly, no hosted requirement**
- **Default model:** `jina-embeddings-v2-base-code` (code-optimized)
- **Default expander:** `Qwen2.5-Coder-0.5B-Instruct` GGUF local
- **Multi-root safe:** chunks stored as `relative(workspaceRoot, abs)` — `../folder2/src/foo.ts` for sibling roots
- **Incremental by content hash** — only changed chunks re-embedded
- **No upload service in v1** — all local, all private

---

## 6. VIBE Mode — Agent-Forward Layout

**One-click toggle that transforms the editor into an AI-first workspace.**

| Mode | Sidebar | Aux Bar (Chat) | Editor | Panel |
|---|---|---|---|---|
| **DEV** | Restored to user state | Restored to user state | Normal | Restored |
| **VIBE** | Hidden | Expanded full-width | Hidden (snapshotted) | Hidden |

### Features
- **Slide-pill toggle** (`VibeToggleButton.tsx`): 132×26, "DEV | VIBE", cubic-bezier animation, sunk-in accent gradient with glow on active side
- **State persisted** per-workspace in storage (`v3code.vibeMode`)
- **Layout snapshot/restore** — `enterVibe()` snapshots all part visibility, `exitVibe()` restores exactly
- **Activity bar + status bar stay visible** — files one click away
- **Context key:** `v3code.vibeMode` for conditional UI bindings
- **React-driven** — `Sidebar.tsx` conditionally renders `<VibeAgentPanel />` vs standard chat

### VibeAgentPanel
- 9 tool tabs in VIBE mode: Browser, Files, Terminal, Symbols, Phone Preview, etc.
- Full chat composer in the main area
- Todo/plan widget (`VibeTodoPlan.tsx`)
- Shared pill/button atoms (`VibeComponents.tsx`)
- Line-icon SVG set (`V3Icons.tsx`) — no emoji

---

## 7. Agent Panel — Multi-Chat Workspace

**Agent-first layout with multi-chat tabs, background agents, and task tracking.**

### Three Modes
| Mode | Description |
|---|---|
| **Normal (chat)** | Standard chat in sidebar |
| **Agent (side panel)** | Chat opens as editor tab in side group. Agent has full context bridge access. |
| **Full Agent** (planned) | Chat takes main editor area. Tools panel on side. Multi-chat engine. |

### Current State
- **Toggle button** in title bar: `◆ AGENT ON` (Trae-inspired indented pill)
- **Mode state machine** in `agentPanelService.ts` — `chat` ↔ `agent`
- **Owned editor tracking** — only closes the editor THIS service opened, never user's manual chat editors
- **Auto-restore** on workspace open if last mode was `agent`
- **Context key:** `v3code.agentMode` for conditional UI
- **New thread on enter** — clean slate in agent mode
- **Guard against races** — `_restoring` flag prevents toggle() racing the deferred restore microtask

### Planned (Agent Panel Spec)
- Multi-chat tabs: `[Chat 1 ●] [Chat 2] [Chat 3 ○] [+ New]`
- Background chat execution — multiple independent agent sessions
- Side panel tools: Files (mini tree), Browser, Terminal, Symbols, Phone Preview
- Browser + Phone Preview buttons in chat toolbar

---

## 8. V Companion — AI Alien Sidekick

**"V" — the green pixel invader. A living, breathing AI companion that watches your code, talks to you, and can run the main coding agent. NOT a chatbot — a character.**

### Architecture
- **`void-panel/`** — Complete standalone Vite + React app (React 19, Tailwind CSS). NEVER goes through gulp/tsup — this is a separate build pipeline.
- **`vCompanionPane.ts`** — THIN webview host (the "[v]" bottom-panel tab). ~200 lines, intentionally minimal — ALL of V's UI lives in the standalone Vite app.
- **RPC bridge:** `postMessage` ↔ in-process services (`IToolsService`, `ILLMMessageService`, `IChatThreadService`, `IConvertToLLMMessageService`)
- **Dev mode:** HMR at `localhost:5173`, prod: `asWebviewUri(dist)`
- **Memory:** `vCompanionMemory.ts` — remembers project context, journal entries, profile

### V's Sprite Engine (`VSprite.tsx`)
- **Pixel-art character** rendered as an SVG grid — crisp at any size (`shapeRendering="crispEdges"`, `imageRendering="pixelated"`)
- **Two-frame walk cycle** (FRAME_A / FRAME_B) at 110ms per frame — legs animate
- **Idle bob** — subtle sine-wave vertical bob when standing still
- **Direction flipping** — `scaleX(dir)` flips the sprite when he turns at edges
- **Color palette:** Green body (`#4ea03b`), dark eyes/mouth (`#0c1016`), red V emblem (`#d6392c`)
- **The red "V" can be toggled** via `showV` prop — hidden during certain scenes
- **Modes:** `idle`, `walk`, `static`

### V's Stage — He Roams the Terminal Floor (`VStage.tsx`)
- **Mario-style edge-to-edge walking** — V walks left→right, flips at edges, walks back
- **Speed adapts to activity** — walks faster (`0.02`) when busy/agent is working, slower (`0.011`) when idle
- **Random idle pauses** — 0.8% chance per tick to stop for ~1.3s, bobbing in place
- **Choice mode** — when choices appear, V parks at the left and idles while options populate the floor
- **ASCII ground:** `·  ˙  ·  ·  ˙   ·  ·  ˙  ·  ·   ˙  ·  ·  ˙  ·  ·  ˙  ·  ·  ·  ˙  ·  ·  ˙  ·` — repeating terminal-dot pattern
- **Numbered choice buttons** — press 1/2/3 or click

### V's Side Panel — Live Dashboard (`VSidePanel.tsx`)
- **Connection indicator** — shows whether V is connected to the editor services
- **Context bar** — visual token usage gauge: `[████████░░] 80%`. Colors: green → yellow at 65% → red/critical at 85%
- **Git summary** — current branch, clean/dirty status, file count. Clickable to open V's git view.
- **Memory summary** — project ID, profile line count, journal entry count
- **Recent activity feed** — live stream of agent actions with timestamps ("2s ago · editing a file")
- **Skill list** — mounted skills shown with names + descriptions
- **Sandbox files** — approve/reject pending file operations
- **Agent state** — file count, context usage stats

### V's Screensaver (`VScreensaver.tsx`)
- **Terminal twinkle field** — 26×6 grid of random ASCII characters (`·˙.*+ `)
- **Occasional V glyph reveal** — every ~7 seconds, holds a big ASCII "V" with "the companion" + "v3code" text for ~1.4s
- **Cheap interval** — single 280ms timer, no canvas, pure DOM
- Aesthetic: feels like an old CRT monitor in sleep mode

### V's Slash Command Palette (`VSlashMenu.tsx`)
- **Red-accented command palette** — V's signature color for actions
- **Two sections:** commands (actions V can perform) + skills (mounted agent skills)
- **Keyboard navigable** — arrow keys + enter, active item highlighted
- **Argument display** — commands with args show `[arg]` placeholder
- Built-in commands:
  - `/home` — back to V's main menu
  - `/voice` — toggle V's voice on/off
  - `/skills` — browse + mount skills onto the agent
  - `/skill-create [task]` — author a new skill for the agent
  - `/start [idea]` — structured project intake (or `/project`)
  - *(extensible — more commands registered from agent context)*

### V Can TALK — Voice System
- **Speech synthesis** using browser's `SpeechSynthesis` API
- **Voice selection priority:** Google UK English Male → Daniel → Microsoft Mark → David → Alex → any English male → any English
- **Text cleaning:** strips markdown/ASCII-art characters (`·•▸╱#*ˋ[]`), normalizes newlines to ". "
- **Tuned voice:** pitch 0.95 (slightly deeper), rate 1.05 (slightly faster), volume 0.85
- **Persisted toggle** in localStorage (`v.voice`)
- **Auto-cancels previous speech** before speaking new text — no overlap
- **V narrates agent actions:** "editing a file", "running a command", "tracing call graph" — humanizes every tool call

### V Watches the Agent Work — Live Activity Stream
- **Tool-to-human mapping** — every agent tool call gets a human-readable label:
  - `edit_file` → "editing a file", `pack_context` → "packing context"
  - `get_call_graph` → "tracing call graph", `semantic_search` → "semantic search"
- **BUILD_TOOLS trigger V's building scene** — when the agent edits/runs/git-commits, V shifts to the building view with progress steps
- **Non-build tools** just show as activity items — V stays on the home scene
- **Timestamp display** — relative time ("2s ago", "1m ago")

### Building View (`BuildingView.tsx`)
- When the agent is actively building (creating files, running commands, committing), V switches to a **progress-tracked build scene**
- **Steps with status:** pending → in-progress → completed → failed
- **Percentage counter** animates as steps complete
- **Title bar** shows what's being built

### V's Skill Library (`VSkillsView.tsx`)
- **Browses skills** from `.agents/skills/` directory
- **Category grouping** — skills organized by folder/category with counts
- **Search** — filter by name, description, or category
- **Mount to agent** — one-click "mount → agent" button attaches a skill to the running coding agent
- **Create new skill** — "+ make a new skill" button to author custom skills
- **Loading states** — "· scanning .agents/skills …" while discovering
- **Breadcrumb navigation** — category → back to categories

### V's Git View (`VGitView.tsx`)
- Dedicated git status view accessible from the side panel
- Shows branch, dirty/clean status, changed files

### V's Questions (`VQuestions.tsx`)
- V can ask the user structured questions during project intake
- Multiple choice + free text

### Scene System
- **`home`** — default scene: V walks the floor, shows recent activity, choices when relevant
- **`building`** — agent is actively editing/running/committing — progress steps with percentage
- **`skills`** — browsing and mounting agent skills
- **`git`** — git repository view
- **Scene transitions** — `scene-back` button returns to home

### V Has His Own Workspace
- **`.v/` directory** — V's own workspace folder for notes, config, memory
- **Project briefing integration** — uses `useProjectBriefing()` hook to get live project context from the editor
- **In-process agent access** — V can call `IChatThreadService` to run the main coding agent, `IToolsService` to execute tools
- **Memory persistence** — profile, journal, sandbox files tracked across sessions

### Why V Is Special (The Competitive Moat)
1. **He's a CHARACTER, not a chatbot** — pixel art, animation, voice, personality. Nobody else has this.
2. **He watches the agent in real-time** — every tool call, every edit, every git commit — V narrates it
3. **He can RUN the agent** — V has his own slash-command system that can launch agent tasks
4. **He has his own workspace** — `.v/` directory, memory, skills library
5. **He TALKS** — speech synthesis with curated voice, narrating what's happening
6. **He's got a screensaver** — terminal twinkle field that occasionally reveals his glyph
7. **He roams** — walks back and forth on the terminal floor while you work
8. **He's merge-proof** — standalone Vite app, never touches gulp/tsup, survives VS Code merges untouched
9. **He mounts skills** — can browse a skill library and attach skills to the coding agent mid-session
10. **He does structured project intake** — `/start [idea]` walks through questions before kicking off the agent

---

## 9. LLM Providers & Model Registry

### 15 Supported Providers

| Provider | Type | Auth |
|---|---|---|
| **Anthropic** | Cloud API | API Key |
| **OpenAI** | Cloud API | API Key |
| **DeepSeek** | Cloud API | API Key |
| **Google Gemini** | Cloud API | API Key |
| **Groq** | Cloud API | API Key |
| **xAI (Grok)** | Cloud API | API Key |
| **Mistral** | Cloud API | API Key |
| **OpenRouter** | Aggregator | API Key |
| **Azure (Foundry)** | Cloud API | API Key + Project |
| **Google Vertex** | Cloud API | Project + Region |
| **AWS Bedrock** | Cloud API | API Key + Region |
| **Ollama** | Local | Endpoint (default `localhost:11434`) |
| **vLLM** | Local | Endpoint (default `localhost:8000`) |
| **LM Studio** | Local | Endpoint (default `localhost:1234`) |
| **liteLLM** | Local Proxy | Endpoint |
| **OpenAI Compatible** | Custom | Endpoint + API Key + Headers JSON |

### Model Registry (`modelCapabilities.ts`)
- **Context windows** tracked per model
- **Capabilities** per model (vision, reasoning, etc.)
- **Default models** curated per provider
- **Per-feature model selection** — each `FeatureName` can use a different model:
  - `Autocomplete` (FIM)
  - `Chat`
  - `CtrlK` (inline edits)
  - `Apply`

### Key Wins Over Copilot/Cursor
- ✅ **DeepSeek support** (Copilot: ❌)
- ✅ **15 providers, full BYOK** (Copilot: locked catalog; Cursor: locked + paid)
- ✅ **Local models** (Ollama, vLLM, LM Studio) — zero cost, zero data egress
- ✅ **Per-feature model selection** — autocomplete on cheap model, chat on powerful model
- ✅ **Reasoning/thinking support** — DeepSeek R1, Claude thinking — rendered in translucent cards
- ✅ **Auto-approve toggle by model** — per-model tool approval settings

---

## 10. Apply System (Fast + Slow)

Two edit application strategies:

### Fast Apply
- **Search/replace blocks** — model outputs SEARCH/REPLACE blocks
- **Structured format:** `<<<<<<< ORIGINAL` / `=======` / `>>>>>>> UPDATED`
- **Multi-block** — multiple disjoint changes in one response
- **Exact matching** — ORIGINAL must exactly match file content (whitespace-sensitive)

### Slow Apply
- **Full file rewrite** — `rewrite_file` tool
- For large refactors or complex changes

### Diff Visualization
- **`DiffZone` / `DiffArea`** — proposed edits surfaced for accept/reject
- **Unified inline red/green diff** (Cursor-style) — shipped May 2026
- **File change summary bar** — expandable list of changed files above input
- **`editCodeService.ts`** — orchestrates both fast and slow apply

---

## 11. Built-in Tools Registry (27 Tools)

All native built-ins via `toolsService.ts`. Full consistency enforced by CI lint (26/26 checked).

### File Operations (7)
| Tool | Category | Approval |
|---|---|---|
| `read_file` | Read | Auto-approve |
| `ls_dir` | Read | Auto-approve |
| `get_dir_tree` | Read | Auto-approve |
| `create_file_or_folder` | Write | Edits approval |
| `delete_file_or_folder` | Write | Edits approval |
| `rewrite_file` | Write | Edits approval |
| `edit_file` | Write | Edits approval |

### Search (5)
| Tool | Category | Approval |
|---|---|---|
| `search_pathnames_only` | Read | Auto-approve |
| `search_for_files` | Read | Auto-approve |
| `search_in_file` | Read | Auto-approve |
| `find_text` | Read | Auto-approve |
| `semantic_search` | Read | Auto-approve |

### Context Bridge (11)
| Tool | Category | Approval |
|---|---|---|
| `get_symbol_context` | Read | Auto-approve |
| `get_file_context` | Read | Auto-approve |
| `get_call_graph` | Read | Auto-approve |
| `get_file_dependencies` | Read | Auto-approve |
| `pack_context` | Read | Auto-approve |
| `get_project_briefing` | Read | Auto-approve |
| `remember` | Write | MCP tools approval |
| `forget` | Write | MCP tools approval |
| `list_notes` | Read | Auto-approve |

### Terminal (4)
| Tool | Category | Approval |
|---|---|---|
| `run_command` | Execute | Terminal approval |
| `open_persistent_terminal` | Execute | Terminal approval |
| `run_persistent_command` | Execute | Terminal approval |
| `kill_persistent_terminal` | Execute | Terminal approval |

### Git (5)
| Tool | Category | Approval |
|---|---|---|
| `git_status` | Read | Auto-approve |
| `git_diff` | Read | Auto-approve |
| `git_log` | Read | Auto-approve |
| `git_branch` | Read | Auto-approve |
| `git_commit` | Write | Terminal approval |

### Web & Browser (2)
| Tool | Category | Approval |
|---|---|---|
| `web_search` | Read | Auto-approve |
| `browser_screenshot` | Read | Auto-approve |

### Diagnostics (1)
| Tool | Category | Approval |
|---|---|---|
| `read_lint_errors` | Read | Auto-approve |

### Background Agent (1)
| Tool | Category | Approval |
|---|---|---|
| `launch_subagent` | Execute | Auto-approve |

### Todo/Plan (1)
| Tool | Category | Approval |
|---|---|---|
| `update_plan` | Write | Auto-approve |

### Consistency Guarantees
- `BuiltinToolResultType` is the **single source of truth**
- CI lint: every key in that type MUST appear in `builtinTools` + `callTool` + `stringOfResult`
- Stale-key warning path for deprecations (non-fatal)

---

## 12. Memories & Notes System

### Persistent Symbol Notes
- **`remember(file, symbol, note)`** — attach note to a symbol
- **`forget(noteId)`** — remove note
- **`list_notes(file?)`** — list all notes
- **Storage:** `<workspace>/.v3code/notes.json`
- **Auto-injection:** when `get_symbol_context` is called, any notes for that symbol are auto-included
- **Cross-session persistence** — notes survive editor restart
- **End-of-thread digest** (planned Phase 5) — propose `remember()` candidates on thread close

### AGENTS.md Journal
- Auto-injected into every chat via `convertToLLMMessageService.ts`
- Also loads `.github/copilot-instructions.md`, `CLAUDE.md`, `.voidrules`
- Cap: 16k chars per file
- "Session Memory" section tracks per-turn learnings
- "Recent Changes" section for changelog

### Workspace Instructions Auto-Injection
- On construct + workspace folder change, warm up model with instruction files
- Replaces old `_getVoidRulesFileContents` which only worked if user had file open

---

## 13. Auto-Context Pipeline

**Smart context gathering before every agent turn.**

### `autoContextService.ts`
- **Input:** user message + currently open files
- **Semantic retrieval** → top 15 chunks from workspace index
- **Deduplication** → max 5 unique files
- **Stopword filtering** — removes noise terms before semantic search
- **Token budget** — estimates token usage, truncates files at 500 lines
- **Returns:** `{ files: AutoContextFile[], tokenEstimate: number }`

### Injection Points
- **First-turn briefing:** project info prepended to system message
- **Per-turn notes:** any notes for @-staged files auto-injected
- **Semantic hits:** Phase 4 retriever feeds `<context-bridge-relevant>` block

---

## 14. Todo/Plan Tracking

**Per-thread structured task tracking with Cursor-style inline todo cards (`ui-todo-*` CSS system).**
The agent calls `update_plan` and the todo list renders as a rich inline card directly in the chat message stream — not in a sidebar, not in a popup. Exactly where you're reading the conversation.

### `update_plan` Tool
- **`todos`** — array of `{ id, content, status }` where status = `pending | in_progress | completed | cancelled`
- **`merge`** — true = update existing (UPSERT by id), false = replace all
- **Per-thread state** — `_todosByThread` Map in ToolsService survives the full thread lifecycle
- Files: `toolsServiceTypes.ts` (type defs), `prompts.ts` (tool registration + LLM description), `toolsService.ts` (implementation), `SidebarChat.tsx` (render)

### Inline Todo Card Rendering (Cursor `ui-todo-*` System — SHIPPED)

When the agent calls `update_plan`, the result renders as an inline card inside `SidebarChat.tsx` with these exact specs:

**Container** (`.ui-todo-list-container`):
- `border-radius: 8px`
- `border: 1px solid var(--vscode-commandCenter-inactiveBorder)` (quaternary border)
- Full width within the message bubble
- Appears inline in the message stream — not floated or popped out

**Header** (`.ui-todo-list-header`):
- `height: 28px`, `padding: 0 12px`, `font-size: 13px`
- Shows task counts: "3 of 7 tasks" (completed / total)
- Subtle bottom border separating header from body

**Body** (`.ui-todo-list-container__body`):
- `padding: 8px 16px`
- Vertical stack of todo items

**Todo Item** (`.ui-todo-item`):
- `display: flex`, `align-items: flex-start`, `gap: 8px`
- `padding: 4px 0`
- **Staggered fade-in animation** — each item gets `v3code-todo-fade-in` with `animation-delay` staggered by index (0ms, 60ms, 120ms, 180ms…)
- Items with `children` (sub-tasks) indent by `depth × 16px`

**Status Indicator** (`.ui-todo-item__indicator`):
- Container: `width: 14px`, `height: 20px`, flex-centered
- **Pending** (`○`): empty circle at `opacity: 0.4`, color `var(--v3code-fg-tertiary)` — matches Cursor's `composer-plan-todo-indicator-pending`
- **In Progress** (`◉`): filled circle with play-icon dot, color `var(--v3code-blue)` — matches Cursor's `composer-toolbar-todo-in-progress-circle`
- **Completed** (`✓`): green checkmark circle, color `var(--v3code-green)`
- **Cancelled** (`✗`): X circle with line-through text, color `var(--v3code-fg-disabled)`, `opacity: 0.6`

**Interactive** — clicking the status indicator cycles through the 4 states: `pending → in_progress → completed → cancelled → pending`

### Editable Todo Items
- **Click to focus** — clicking a todo item's text makes it editable (textarea)
- **Enter key** cycles status (same as clicking the indicator)
- **Auto-focus** on the newly focused item's textarea
- **Content editing** — type to update the todo text in real-time

### VIBE Mode Widget (`VibeTodoPlan.tsx`)
- Standalone todo widget for the VIBE mode side panel
- Same status icons + color system
- **Nested todos** — `children` array with depth indentation
- **Pill badges** — each status gets a colored pill: blue for in_progress, green for completed, red for cancelled, purple for pending
- **Cycle status** via click or Enter

### Service
- `IToolsService.getTodosForThread(threadId)` — retrieves current plan state
- `_todosByThread: Map<string, TodoItem[]>` — per-thread todo storage
- Used by both `SidebarChat.tsx` (inline card render) and `VibeTodoPlan.tsx` (VIBE widget)

---

## 15. Background Agent / Subagent System

### `launch_subagent` Tool
- **Parameters:** `description`, `prompt`, `readOnly` (boolean)
- **Returns:** `{ subagentThreadId, result, status: 'completed' | 'error' }`
- **Subagent launcher** set via `setSubagentLauncher()` on ToolsService

### `backgroundAgentService.ts`
- **`forkToBackground(threadId)`** — fork a thread to background execution
- **`getRunningTasks()`** — list active background tasks
- **`getCompletedTasks()`** — list finished tasks
- **`cancelTask(taskId)`** — stop a running background task
- **Events:** `onDidTaskComplete`, `onDidTasksChange`
- **Status lifecycle:** `running → completed | failed | cancelled`

### AgentPass (Future)
- Multi-agent coordination surface — per-agent state at `.v3code/agentpass.json`
- **"Pass" button** — serialize chat context → open fresh thread → inject payload
- Shape: `{ [agentName]: { lastSeenISO, currentTask, openQuestions[], doNotTouch[], handoffNotes } }`

---

## 16. Slash Commands

**Red slash-command palette** (from V Companion pipeline).

### `slashCommandService.ts`
- **`getCommands()`** — list all registered slash commands
- **`matchPrefix(input)`** — fuzzy-match `/command` prefix
- **`executeCommand(commandId, context)`** — returns `{ modifiedMessage, systemPromptAddition, mode }`
- **Context enrichment:** active file URI, selected text, diagnostics

### Built-in Commands
- `/explain` — explain selected code
- `/fix` — fix diagnostics in active file
- `/refactor` — refactor selected code
- `/test` — generate tests for selected code
- `/doc` — generate documentation
- More extensible via `_registerBuiltinCommands()`

---

## 17. Chat UX Features

### Composer (SuperClaw-style upgrade — shipped May 2026)
- **Rounded-2xl container** with `focus-within:` violet glow (`#8B5CF6`) + soft halo
- **Textarea:** `min-h-[80px]`, auto-grows, scrolls past ~8 lines
- **Violet gradient submit button** (`#8B5CF6 → #6D28D9`) with outer glow + inner highlight
- **Functional @ mention button** — inserts `@` + triggers mention menu
- **Model dropdown** in toolbar row
- **Chat mode dropdown** in toolbar row
- **Auto-approve toggle** per model
- **Paperclip image picker** + Ctrl+V paste support

### Message Display
- **Tool call cards** — flattened, proper tool titles
- **Reasoning cards** — translucent for thinking models
- **Checkpoint dividers** between agent steps
- **Rounded code blocks** with soft styling
- **Unified inline red/green diff** for file changes (Cursor-style)
- **Context-fill bar** — matching lighter surface on user messages
- **File change summary bar** — expandable above input

### Tab Bar with Thinking Indicator (`ChatThreadTabs.tsx` — SHIPPED)

Multi-chat tab bar at the top of the chat panel. Every chat thread gets its own tab.

**Tab Bar Container:**
- `display: flex`, horizontal scroll (`overflow-x: auto`), `min-height: 32px`
- `border-bottom: 1px solid quaternary-border`
- `background: var(--vscode-sideBar-background)`
- Sorted by `lastModified` descending — most recent thread first

**Individual Tab:**
- **Height:** `32px` — clean, compact
- **Font size:** `12px`, `line-height: 32px` for vertical centering
- **Padding:** `0 6px 0 8px`, `gap: 5px` between icon + text + close button
- **Max width:** `160px`, text truncated with `…` at 28 chars
- **Title:** first user message truncated to 28 chars, or "New chat" if empty
- **Border-right:** subtle separator between tabs
- **Hover:** close button (✕) fades in via `opacity-0 group-hover:opacity-70`

**Active Tab:**
- **Bottom accent bar** — `2px` height, spans full tab width, colored `var(--vscode-focusBorder)` (the VS Code focus blue), `border-radius: 1px 1px 0 0`
- **Background:** `var(--vscode-tab-activeBackground)`
- **Text color:** `var(--vscode-tab-activeForeground)` — bright, fully opaque

**Inactive Tab:**
- **Background:** transparent
- **Text color:** `var(--vscode-tab-inactiveForeground)` — muted, lower contrast

**Thinking Indicator (Running Thread):**
- **Animated pulsing blue dot** — `6px × 6px` circle rendered as a `<ThinkingDot />` React component
- **Color:** `var(--vscode-progressBar-background, #0078d4)` — VS Code's accent blue
- **Animation:** `v3code-pulse` keyframe — `1.5s ease-in-out infinite`
  ```css
  @keyframes v3code-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.4; transform: scale(0.75); }
  }
  ```
- Appears to the LEFT of the tab title text when `streamState[threadId]?.isRunning` is true
- Tells you at a glance which agent threads are actively working

**New Chat Button:**
- `+` icon button at the end of the tab bar, `32px × 32px`
- `opacity: 0.6` → `hover:opacity-100`
- Calls `chatThreadsService.openNewThread()`

**Close Behavior:**
- Close button (✕) only visible on hover
- Closing the active tab auto-switches to the nearest remaining thread before deleting
- Close button hidden when only 1 thread exists

### Right-Side Agent Sessions Panel (`AgentSessionsPanel.tsx` — SHIPPED)

A **280px collapsible panel** on the right side of the chat, matching Cursor's `.unified-agents-sidebar-host` design. Shows ALL chat threads with search, date grouping, and running indicators.

**Layout Integration** (`Sidebar.tsx`):
- Toggle via `PanelRight` icon button (top-right of chat area)
- When open: chat area flexes to fill remaining space, panel takes fixed `280px`
- `border-left: 1px solid quaternary-border` separates panel from chat
- Toggle button shifts left with the panel — always stays at the boundary
- Active state: toggle icon turns focus-border blue

**Panel Header:**
- Collapse button (ChevronLeft icon, `opacity: 0.5`, `border-radius: 6px`)
- `padding: 12px`, `gap: 6px`

**New Agent Button** (`.agent-sidebar-new-agent-button`):
- Full width, `min-height: 28px`, `border-radius: 6px`
- `padding: 6px 12px`, `gap: 6px` between Plus icon + label + shortcut hint
- Label: "New Agent" (left-aligned, `font-size: 12px`)
- Shortcut hint: "Ctrl+N" (right-aligned, `font-size: 11px`, descriptionForeground color)
- `border: 1px solid quaternary-border`, transparent background

**Search Input** (`.agent-sidebar-search-input`):
- Full width, `height: 28px`, `border-radius: 6px`
- `font-size: 12px`, `line-height: 16px`
- `padding: 6px 8px 6px 26px` (left padding for search icon)
- Search icon (magnifying glass) positioned absolutely at `left: 8px`, vertically centered
- Placeholder: "Search Agents..."
- Filters threads by title (case-insensitive substring match)

**Date-Grouped Thread List:**
Threads grouped into 4 sections based on `lastModified`:
| Group | Criteria |
|---|---|
| **Today** | `lastModified >= today 00:00` |
| **Yesterday** | `lastModified >= yesterday 00:00` |
| **This Week** | `lastModified >= 7 days ago` |
| **Older** | everything else |

Empty groups are hidden. Groups rendered with a subtle section label.

**Thread Cells** (`.agent-sidebar-cell`):
- `border-radius: 6px`, `padding: 5px 6px`, `gap: 12px`
- **Title** (`.agent-sidebar-cell-text`): `font-size: 12px`, `line-height: 16px`, truncated to 40 chars
- **Subtitle** (`.agent-sidebar-cell-subtitle`): `font-size: 11px`, `line-height: 14px`, shows file count ("N files touched")
- Hover: subtle background change
- Click: switches to that thread

**Running Indicator** (`.agent-status-dot--running`):
- `5px` animated dot next to cell title
- Same `v3code-pulse` animation as tab thinking indicator
- Appears when `streamState[threadId]?.isRunning` is true

**Footer:**
- Agent count: "N agents" showing total thread count
- Subtle border-top separator

**File Stats Tracking:**
- `threadStats()` scans all tool messages in a thread for `edit_file`, `rewrite_file`, `create_file_or_folder` calls
- Counts unique file paths touched → displayed as "N files" in cell subtitle

### CSS Animations (`void.css` — SHIPPED)

**`v3code-pulse`** — Used by both the tab thinking indicator AND agent sessions panel running dot:
```css
@keyframes v3code-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.4; transform: scale(0.75); }
}
```
- `1.5s ease-in-out infinite`
- Applied to 6px (tab) and 5px (panel) dots
- Color: `var(--vscode-progressBar-background, #0078d4)`

**`v3code-todo-fade-in`** — Staggered entrance for todo items (matches Cursor's `ui-todo-fade-in`):
```css
@keyframes v3code-todo-fade-in {
  0%   { opacity: 0; transform: translateY(-4px); }
  100% { opacity: 1; transform: translateY(0); }
}
```
- Each todo item gets `animation-delay: calc(var(--index) * 60ms)`
- Duration: `0.2s ease-out`
- Creates a satisfying stagger effect as tasks populate

### Visual Design (chat redesign passes 1–3)
- **Single-border composer** — muted, not shouting
- **Seamless borderless design** — one box around composer, no inner lines
- **White send button** + spinning-ring stop button
- **Colored agent pill** in thread header
- **Title bar matches input surface**
- **V3 alien sky header** — collapsible pixel invader that walks while agent works (see Section 8: V Companion)
- **Chat thread tabs** — `ChatThreadTabs.tsx` with thinking indicators
- **Agent sessions panel** — `AgentSessionsPanel.tsx` right-side collapsible panel
- **CSS design tokens** — `v3code-design-tokens.css`
- **Typography consistency** — unified font stack
- **Thread suggestions** — after completion

---

## 18. Edit & Diff System

### Inline Diff Rendering
- **Unified red/green** inline diff (Cursor-style) — `8209919`
- **DiffZone** — proposed edit regions before accept/reject
- **DiffArea** — multi-file change tracking

### Code Application
- **`editCodeService.ts`** — orchestrates fast + slow apply
- **Search/replace blocks** — structured format with ORIGINAL/DIVIDER/UPDATED
- **Full file rewrite** — `rewrite_file` for large changes
- **Create/delete** — file and folder operations

---

## 19. Terminal Tools

| Tool | Description |
|---|---|
| `run_command` | Execute command, wait for result (8s inactive timeout) |
| `open_persistent_terminal` | Open long-running terminal (dev servers, watchers) |
| `run_persistent_command` | Send command to existing persistent terminal |
| `kill_persistent_terminal` | Stop and close a persistent terminal |

- **Output cap:** 100,000 chars
- **Background command time:** 5s max
- **Inactive timeout:** 8s
- **Terminal ID tracking** — per-terminal state

---

## 20. Git Integration

| Tool | Description |
|---|---|
| `git_status` | `git status --porcelain` |
| `git_diff` | Show unstaged or staged changes |
| `git_commit` | `git add -A && git commit -m "..."` |
| `git_log` | Recent commit history |
| `git_branch` | Current branch + all local/remote branches |

### Git AI (`voidSCMService.ts`)
- AI-powered commit message generation
- SCM source control integration
- Main-process service for git operations

---

## 21. Web Search & Browser

| Tool | Description |
|---|---|
| `web_search` | Web search with configurable max results |
| `browser_screenshot` | Take screenshot of a URL |

---

## 22. Autocomplete (FIM)

- **`autocompleteService.ts`** — inline code completions
- **`contextGatheringService.ts`** — gathers context for FIM prompts (NOT chat)
- **Fill-in-the-Middle (FIM)** — smart prefix/suffix aware completions
- **Per-model configuration** — can use different model than chat
- **Next edit prediction** — `nextEditPredictionService.ts`

---

## 23. Cmd+K Inline Edits

- **`quickEditActions.ts`** — selection-scoped edits via Cmd+K
- **Quick edit mode** — select code, describe change, get inline diff

---

## 24. MCP Client (External Servers)

- **`mcpService.ts`** + `mcpChannel.ts` — connect to user's external MCP servers
- **Full MCP protocol support** — tools/list, tools/call, resources
- **Unrelated to Context Bridge** — CB is built-in, NOT MCP
- **User-owned servers only** — V3Code doesn't ship MCP servers
- **Approval UX** — MCP tools go through same approval pipeline

---

## 25. Competitive Comparison

| Capability | Copilot | Cursor | Void (upstream) | V3Code |
|---|---|---|---|---|
| LSP-backed symbol context in agent | ❌ | ❌ | ❌ | ✅ Built-in |
| Persistent symbol notes | ❌ | ❌ | ❌ | ✅ |
| Call graph traversal | ❌ | ❌ | ❌ | ✅ |
| Hybrid vector + lexical search | ❌ (cloud-only) | ❌ (cloud-only) | ❌ | ✅ Local |
| MCP support | Half-baked | ❌ | ✅ | ✅ |
| DeepSeek support | ❌ | ❌ | ✅ | ✅ |
| BYOK providers | Locked catalog | Locked + paid | ✅ 13+ | ✅ 15 |
| Local embeddings (@workspace) | ✅ (cloud) | ✅ ($20/mo) | ❌ | ✅ Free, local |
| Agent mode (tool loop) | ✅ | ✅ | ✅ | ✅ |
| Apply (fast + slow) | ❌ | ✅ | ✅ | ✅ |
| Multi-chat threads with tabs | ❌ | ❌ | ❌ | ✅ |
| Tab thinking indicators (pulse) | ❌ | ❌ | ❌ | ✅ |
| Agent sessions panel (right side) | ❌ | ❌ | ❌ | ✅ |
| Inline todo cards (Cursor ui-todo-*) | ❌ | ✅ | ❌ | ✅ |
| Auto-context injection | ❌ | ❌ | ❌ | ✅ (CB + indexer) |
| Background subagents | ❌ | ❌ | ❌ | ✅ |
| Slash commands | ❌ | ❌ | ❌ | ✅ |
| VIBE mode (AI-first layout) | ❌ | ❌ | ❌ | ✅ |
| Alien companion (V) | ❌ | ❌ | ❌ | ✅ |
| AI companion with voice | ❌ | ❌ | ❌ | ✅ |
| AI companion runs the agent | ❌ | ❌ | ❌ | ✅ |
| AI companion skill library | ❌ | ❌ | ❌ | ✅ |
| Custom system prompts | Limited | ❌ | ✅ | ✅ Full control |
| Cmd+K, terminal tool | ✅ | ✅ | ✅ | ✅ |
| Autocomplete (FIM) | ✅ | ✅ | ✅ | ✅ |
| Git AI | ✅ | ❌ | ✅ | ✅ |

---

## 26. What's Planned

### Phase B.3 — Hardening (IN PROGRESS)
- ⬜ More telemetry
- ⬜ Performance profiling

### Phase C — Local Embeddings Polish
- ⬜ Full rebuild UX polish
- ⬜ Progress reporting improvements
- ⬜ Embedding model download UX

### Phase D — Polish & Ship
- ⬜ Trajectory recording (port from trae-agent pattern)
- ⬜ Signed Windows installer
- ⬜ Open VSX listing
- ⬜ v3code.dev marketing site

### Agent Panel Phase 2 — Full Agent Mode
- ⬜ Layout switch: chat takes main editor area
- ⬜ Side panel with browser/files/symbols
- ⬜ PNG phone bezel overlay + browser resize

### Agent Panel Phase 3 — Multi-Chat Engine
- ⬜ Independent agent sessions per tab
- ⬜ Background agent execution
- ⬜ Session persistence

### AgentPass — Multi-Agent Coordination
- ⬜ Per-agent state at `.v3code/agentpass.json`
- ⬜ "Pass" button for cross-agent handoff
- ⬜ Agent sidebar pane listing all agents + state

### Phase 5 — End-of-Thread Digest
- ⬜ Propose `remember()` candidates on thread close
- ⬜ One-click confirmation UI
- ⬜ Auto-append to AGENTS.md Session Memory

### v2 (Deferred)
- ⬜ Hosted paid-model marketplace (Stripe + token metering)
- ⬜ Cloud sync of memory/settings
- ⬜ Team features
- ⬜ Hosted embedding upgrade tier

---

## Appendix: Key File Map

```
src/vs/workbench/contrib/void/
├── browser/
│   ├── toolsService.ts              ★ 27 built-in tool implementations
│   ├── chatThreadService.ts         ★ Agent loop, thread management
│   ├── convertToLLMMessageService.ts ★ System prompt injection point
│   ├── agentPanelService.ts         ★ Agent mode state machine
│   ├── vibeModeService.ts           ★ VIBE/DEV layout toggle
│   ├── editCodeService.ts           ★ Apply (fast + slow)
│   ├── autocompleteService.ts       ★ FIM completions
│   ├── autoContextService.ts        ★ Smart context gathering
│   ├── backgroundAgentService.ts    ★ Background task forking
│   ├── slashCommandService.ts       ★ /command palette
│   ├── terminalToolService.ts       ★ Terminal execution
│   ├── voidSCMService.ts            ★ Git AI
│   ├── contextBridge/
│   │   ├── contextBridgeTools.ts    ★ 11 CB tool implementations
│   │   └── lspBridgeAdapter.ts      ★ In-process LSP bridge
│   └── react/src/
│       ├── sidebar-tsx/
│       │   ├── Sidebar.tsx              ★ Root: chat + agent sessions panel layout
│       │   ├── SidebarChat.tsx          ★ Chat messages, inline todo cards, composer
│       │   ├── ChatThreadTabs.tsx       ★ Tab bar with thinking indicator dots
│       │   ├── AgentSessionsPanel.tsx   ★ Right-side 280px collapsible thread panel
│       │   ├── VibeTodoPlan.tsx         ★ VIBE mode todo/plan widget
│       │   ├── VibeAgentPanel.tsx       ★ Full VIBE UI (9 tool tabs + chat)
│       │   ├── VibeToggleButton.tsx     ★ DEV/VIBE slide-pill toggle
│       │   ├── VibeComponents.tsx       ★ Shared pill/button atoms
│       │   ├── V3AlienHeader.tsx        ★ Pixel invader sky header
│       │   └── V3Icons.tsx             ★ Line-icon SVG set (no emoji)
│       └── ChatCore/                    ★ Composer, message thread, etc.
├── common/
│   ├── toolsServiceTypes.ts         ★ All 27 tool type definitions
│   ├── prompt/prompts.ts            ★ System prompts, tool metadata
│   ├── modelCapabilities.ts         ★ 15 providers, model registry
│   ├── semanticIndex/               ★ Chunker, embedder, retriever, DB
│   ├── contextBridge/
│   │   ├── contextBridgeService.ts  ★ Main-process briefing + memory
│   │   └── contextBridgeTypes.ts    ★ All CB types
│   ├── mcpService.ts                ★ External MCP client
│   └── voidSettingsTypes.ts         ★ Settings, provider configs
└── electron-main/
    └── llmMessage/                  ★ LLM wire protocol

void-panel/                           ★ V Companion — standalone Vite+React app
├── src/App.tsx                       ★ V's main app: scenes, voice, slash, agent bridge
├── src/components/
│   ├── VStage.tsx                    ★ V's walking stage with choices
│   ├── VSprite.tsx                   ★ V's pixel-art sprite (walk/idle/static)
│   ├── VSidePanel.tsx                ★ Dashboard: git, context bar, activity feed
│   ├── VScreensaver.tsx              ★ Terminal twinkle + V glyph reveal
│   ├── VSlashMenu.tsx                ★ Red slash-command palette
│   ├── VSkillsView.tsx               ★ Skill library browser + mount
│   ├── VGitView.tsx                  ★ Git status view
│   ├── VQuestions.tsx                ★ Structured intake questions
│   └── BuildingView.tsx              ★ Agent build progress scene
└── src/hooks/useVoidBridge.ts        ★ postMessage ↔ editor service bridge
```

---

*This document was compiled from the V3Code codebase, git history (40+ commits), AGENTS.md, CONTEXT-BRIDGE-NATIVE.md, SEMANTIC-INDEXING-SPEC.md, AGENT-PANEL-SPEC.md, V3CODE-PLAN.md, PROGRESS.md, and all source files in `src/vs/workbench/contrib/void/`.*
