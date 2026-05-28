# DeepSeek Marching Orders — V3Code v0.1

You are working on **V3Code** (domain: `v3code.dev`), our closed-source fork of [Void Editor](https://voideditor.com) (Apache 2.0 VS Code fork). The dev folder lives at `C:\Users\heave\Desktop\mcp\V3Code\` — the folder name is incidental scaffolding from earlier brand iterations; **the product is V3Code**. Do not rename the folder.

**Canonical docs in this folder (read these first):**
- [V3CODE-BRANDING.md](V3CODE-BRANDING.md) — brand identity, color palette, **all `product.json` values for Task 1**. Use this verbatim, not any older table.
- [V3Code-PLAN.md](V3Code-PLAN.md) — codebase architecture and build plan. Filename outdated, content valid; mentally substitute "V3Code" for any "V3Code".
- [AUDIT-V3Code.md](AUDIT-V3Code.md) — codebase tour and orientation. Same filename caveat.
- [TRAE-RECON.md](TRAE-RECON.md) — what to learn from Trae IDE for UI patterns.

**Read V3CODE-BRANDING.md and V3Code-PLAN.md in full before doing anything else.**

This document gives you the v0.1 task queue. Work top to bottom. Do not skip ahead. Do not invent extra work. After each completed task, stop and let Daniel review (and Claude in Copilot Chat will spot-check before he greenlights the next one).

---

## Hard rules (from `.voidrules` — non-negotiable)

1. **Only modify files inside `src/vs/workbench/contrib/void/`** unless you ask Daniel first.
2. **No `any` casts. No lazy type casts.** Find the correct type. Use it.
3. **Do not add or remove semicolons.** Match existing convention.
4. **Hashmap naming: `bOfA`.** A map from `toolId` → `toolName` is `toolNameOfToolId`. Not `toolIdToName`.
5. **Do not run build/validation commands.** Tell Daniel what to run.
6. **Read before edit.** Every file. No exceptions.
7. **No placeholder/stub files.** Real working content only.
8. **No narrating comments.** Comments only for non-obvious intent.
9. **No debug `console.log` left in.**
10. **No unrequested refactors.** Don't touch code you weren't asked to touch.

---

## Inherited project rules (from Daniel)

- Plan before any task touching 3+ files. Finish what you start.
- Never install npm packages without explaining why in the PR / commit message.
- Daniel's master philosophy: ship working primitives, don't over-engineer.

---

## Architectural orientation (read [V3Code-PLAN.md](V3Code-PLAN.md) for the full map)

- All Void code lives in `src/vs/workbench/contrib/void/` with three subfolders: `common/`, `browser/`, `electron-main/`
- Chat sidebar UI: `browser/sidebarPane.ts` + `browser/react/`
- Agent loop / tool dispatch: `browser/chatThreadService.ts` + `browser/toolsService.ts`
- LLM provider abstraction: `common/sendLLMMessageService.ts` + `electron-main/llmMessage/sendLLMMessage.impl.ts`
- Providers shipped already (including DeepSeek): `common/voidSettingsTypes.ts`
- MCP client (already wired end-to-end): `common/mcpService.ts` + `electron-main/mcpChannel.ts`
- System prompts: `common/prompt/prompts.ts`
- Branding source of truth: `product.json` at repo root

---

## Task queue

### Task 1 — Rebrand sweep (small, low risk, do this first to warm up)

Goal: Replace every Void-branded string in `product.json` with **V3Code** branding without breaking the build.

**Files to touch:**
- `product.json` (root) — rebrand fields
- `void_icons/` (root) — **leave for now**, Daniel will swap art separately

**Source of truth:** the `product.json` Rebrand Fields section of [V3CODE-BRANDING.md](V3CODE-BRANDING.md). Use it verbatim. Summary of the most important fields:

| Key | New value |
|---|---|
| `nameShort` | `V3Code` |
| `nameLong` | `V3Code` |
| `applicationName` | `v3code` |
| `dataFolderName` | `.v3code` |
| `win32MutexName` | `v3code` |
| `serverApplicationName` | `v3code-server` |
| `serverDataFolderName` | `.v3code-server` |
| `tunnelApplicationName` | `v3code-tunnel` |
| `win32DirName` | `V3Code` |
| `win32NameVersion` | `V3Code` |
| `win32RegValueName` | `V3Code` |
| `win32AppUserModelId` | `V3Code.Editor` |
| `win32ShellNameShort` | `V3&Code` |
| `win32TunnelServiceMutex` | `v3code-tunnelservice` |
| `win32TunnelMutex` | `v3code-tunnel` |
| `darwinBundleIdentifier` | `dev.v3code.code` |
| `linuxIconName` | `v3code` |
| `urlProtocol` | `v3code` |
| Every `win32*AppId` UUID | **Generate fresh UUIDs** via `crypto.randomUUID()` (uppercase, wrap in `{{...}}` to match Void's existing Inno Setup brace convention — verify by reading the existing values first) |
| `voidVersion` / `voidRelease` | **Leave alone** for now |

**Extensions gallery** (`extensionsGallery.serviceUrl` and `itemUrl`):
- `serviceUrl`: `https://open-vsx.org/vscode/gallery`
- `itemUrl`: `https://open-vsx.org/vscode/item`

This is a **license requirement** (MS Marketplace ToS forbids non-MS distributions), not a preference.

**`linkProtectionTrustedDomains`:** replace `voideditor.com` / `voideditor.dev` / `github.com/voideditor/void` entries with `https://v3code.dev` and the future GitHub repo URL. Keep `https://ollama.com` (still relevant for local LLM support).

**`reportIssueUrl` and `licenseUrl`:** point at placeholders we'll update later — `https://github.com/<v3code-org>/v3code/issues/new` and `https://github.com/<v3code-org>/v3code/blob/main/LICENSE.txt`. Daniel will register the org separately.

**Do not touch:** any field not in the V3CODE-BRANDING.md table or above. If you see Void branding in any file outside `product.json`, list the file paths in your final report but DO NOT change them yet — that's a separate sweep.

**Acceptance:** `product.json` is valid JSON, every key above replaced with the V3Code value, fresh UUIDs generated (not placeholders like `00000000-...`), Open VSX URLs in place. Daniel will run the build to verify.

---

### Task 2 — Wire Context Bridge as built-in tools in `toolsService.ts`

Goal: Register all 9 Context Bridge primitives as native built-in tools in V3Code's chat tool dispatcher. These will appear in the agent loop alongside Void's existing tools (read_file, edit, terminal, etc.). No MCP wire — compiled directly into the V3Code binary. **This is the closed-source moat — these tools never ship as a public MCP package.**

**Context Bridge location (reference only):** `C:\Users\heave\Desktop\mcp\context-bridge\mcp-server\` — the LSP bridge logic you'll import from. The MCP server wrapper (`cli.ts`, `index.ts`) is NOT needed — we only need the core library (`lsp-bridge.ts`, `types.ts`, `memory.ts`, `language-config.ts`, and the tool implementations in `tools/`).

**What to do:**
1. Read `browser/toolsService.ts` and `common/toolsServiceTypes.ts` end to end. Understand how Void registers built-in tools (the pattern for read_file, edit, terminal, etc.).
2. Read `browser/chatThreadService.ts` to understand how tools are dispatched during agent loops.
3. Design the integration:
   - Each Context Bridge tool becomes a function following Void's tool registration pattern
   - Tool functions call into the Context Bridge LSP bridge directly (import from `context-bridge/mcp-server/src/`)
   - Tool metadata (name, description, parameter schema) follows Void's `BuiltinToolName` / `BuiltinToolCallParams` types
4. Register all 9 tools: `get_symbol_context`, `get_file_context`, `get_call_graph`, `get_file_dependencies`, `find_text`, `pack_context`, `remember`, `forget`, `list_notes`.
5. **Write a plan BEFORE coding.** Identify:
   - The exact tool registration pattern (copy the pattern from an existing built-in tool)
   - How parameter schemas map (Context Bridge uses Zod, Void uses TypeScript interfaces — translate)
   - How async results return (Void's tool result type vs Context Bridge's return shape)
   - Any LSP bridge initialization needed (does it start once at editor launch? per-workspace?)

**Do NOT modify Context Bridge source.** Import and call it; don't refactor it.

**Acceptance:** Daniel opens V3Code chat, asks "what calls the function X?", and the agent uses `get_symbol_context` as a first-class tool. Tools show up in the tool picker alongside Void's built-ins. No MCP config needed.

---

### Task 3 — Port our Cursor-lineage prompts into Void's `prompts.ts` (DO THIS CAREFULLY)

Goal: Merge our battle-tested Cursor-derived prompt system into Void's existing prompt scaffolding. **Keep what works in both. Throw away nothing.**

**Source prompts:** Daniel will hand you the file(s) containing our Cursor-lineage prompts. Do NOT guess where they are. **Ask him before starting this task.**

**Target:** `common/prompt/prompts.ts`

**Approach:**
1. Read the entire target file first. Understand Void's structure: how prompts are composed, what variables are interpolated, how `ChatMode` (normal/gather/agent) and `FeatureName` (Autocomplete/Chat/CtrlK/Apply) gate which prompts are used.
2. Read the source prompts Daniel provides.
3. **Write a plan** in your response BEFORE editing. Identify:
   - Which Void prompts get replaced wholesale (probably none — be conservative)
   - Which prompts get sections merged in (probably most)
   - Which Cursor-lineage techniques (e.g., specific phrasings, instruction patterns, formatting conventions) get woven in
4. Keep Void's mechanical scaffolding (`ORIGINAL`/`DIVIDER`/`FINAL` search/replace block format, `MAX_DIRSTR_*` budgets, `tripleTick` wrapper). These are wired throughout the codebase — touching them breaks things.
5. Keep our prompt VOICE and STRUCTURE (Cursor-derived).
6. Make the merge cleanly, one prompt at a time, with the change tracked.

**Acceptance:** Daniel reviews the merged prompts. Claude spot-checks the diff for type safety, style consistency, and that no Void-specific interpolation was broken.

---



---

### Task 4 — Workspace embeddings index (`sqlite-vec`)

**DEFERRED to v0.2.** Do not start. This is the answer to Copilot's `@workspace` and is our biggest single feature gap. Full design will come in its own brief.

---

## Reporting back

After each task:
1. Summarize what you changed (file list + ~3 lines per file).
2. State explicitly what you did NOT do.
3. List any uncertainties or judgment calls you made.
4. Stop. Wait for review before starting the next task.

If you hit something unexpected (e.g., a file isn't structured like the plan describes), **stop and report**. Do not invent a workaround.

---

## Cost / workflow note (Daniel's plan)

- **DeepSeek (you):** primary code generator. Bulk of file edits. Cheap, fast, capable.
- **Claude in Copilot Chat:** spot-checks your diffs, catches architectural mistakes, handles recon (reading unfamiliar codebases, mapping unknown subsystems).
- **Claude Code:** backup / overflow for parallel work.
- **Daniel:** sole engineer, final call on architecture and ship decisions.

Your job is to be excellent at the well-scoped task. Architecture pushback goes through Daniel, not you.
