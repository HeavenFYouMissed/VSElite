# VSElite Codebase Audit

Fork of [Void Editor](https://github.com/voideditor/void) on top of `code-oss-dev` (Microsoft's VS Code OSS) at version **1.99.3**. Reviewed 2026-05-24.

Goal of this document: give Daniel (and any contributor / agent) a one-page map of what's here, what matters, what we leave alone, what we touch.

---

## Top-level layout

```
vselite/
├── .voidrules                      # Agent rules — we inherit, will adapt
├── .vscode/                        # VS Code dev settings (not the product config)
├── .eslint-plugin-local/           # Custom lint rules (Void inherited from upstream VS Code)
├── .devcontainer/                  # Codespaces / dev container setup
├── product.json                    # ★ Branding source of truth — first rebrand target
├── package.json                    # Identifies as "code-oss-dev" v1.99.3
├── HOW_TO_CONTRIBUTE.md            # Build instructions
├── src/                            # All source
│   ├── main.ts                     # Electron main process entry
│   ├── cli.ts                      # CLI entry
│   ├── server-main.ts              # Server mode (code-server style)
│   ├── tsconfig*.json              # Multiple TS configs for different build targets
│   └── vs/                         # Upstream VS Code source + our additions
├── build/                          # Gulp build scripts, packaging, signing
├── scripts/                        # Helper scripts (code.bat, code-cli.bat, etc.)
├── extensions/                     # Built-in extensions (git, language packs, etc.)
├── resources/                      # Icons, splash, installer assets
├── void_icons/                     # ★ Void-branded icon set — rebrand target
├── remote/                         # Remote dev (SSH, dev containers) support
├── test/                           # Test harnesses
└── cli/                            # Rust-based CLI for VS Code
```

## The folder that matters most

**`src/vs/workbench/contrib/void/`** — every line of Void-specific code lives here. The `.voidrules` file is explicit about this: *"Most code we care about lives in `src/vs/workbench/contrib/void`. Never modify files outside `src/vs/workbench/contrib/void` without consulting with the user first."*

We honor that rule. Touch upstream VS Code code (anything in `src/vs/` that ISN'T inside `contrib/void/`) only when there's no alternative — and document why.

### Inside `contrib/void/` — the three-process split

VS Code is an Electron app with three processes: **main** (Node.js host), **renderer** (browser / Electron window), and the **shared** layer. Void mirrors this:

```
contrib/void/
├── common/                         # Shared types + services usable by main and renderer
├── browser/                        # Renderer-side: UI, services that need DOM/workbench
│   └── react/                      # React UI for chat sidebar, settings, onboarding
└── electron-main/                  # Main-process services (LLM calls, MCP server processes)
```

### Files that matter (the agent loop core)

| Concern | File(s) | Why it matters |
|---|---|---|
| **Chat sidebar UI** | `browser/sidebarPane.ts` + `browser/react/src/sidebar-tsx/` | Where the chat panel renders. `Sidebar.tsx`, `SidebarChat.tsx`, `SidebarThreadSelector.tsx` |
| **Agent / tool loop** | `browser/chatThreadService.ts` | The thread driver. Calls tools, manages messages, executes the loop |
| **Tool dispatcher** | `browser/toolsService.ts` + `common/toolsServiceTypes.ts` | Registers + executes built-in tools (read_file, edit, terminal). **★ This is where Task 4 lands** (Context Bridge primitives as native tools) |
| **Apply system** | `browser/editCodeService.ts` + `common/editCodeServiceTypes.ts` + `browser/editCodeServiceInterface.ts` | Fast (search/replace blocks) + Slow (full rewrite). DiffZones/DiffAreas surface proposed edits |
| **Autocomplete (FIM)** | `browser/autocompleteService.ts` + `browser/contextGatheringService.ts` | Inline completions. `contextGatheringService` is **for FIM only — NOT chat** (easy to confuse) |
| **Cmd+K inline edits** | `browser/quickEditActions.ts` + `browser/react/src/quick-edit-tsx/` | Selection-scoped edits |
| **Terminal tool** | `browser/terminalToolService.ts` | Agent terminal exec |
| **Git AI** | `browser/voidSCMService.ts` + `electron-main/voidSCMMainService.ts` + `common/voidSCMTypes.ts` | AI commit messages and SCM hooks |
| **LLM provider abstraction** | `common/sendLLMMessageService.ts` + `electron-main/llmMessage/sendLLMMessage.impl.ts` + `electron-main/sendLLMMessageChannel.ts` | Single entry point for all providers |
| **Provider definitions** | `common/voidSettingsTypes.ts` | Anthropic, OpenAI, DeepSeek, OpenRouter, Gemini, Groq, xAI, Mistral, Azure, Ollama, vLLM, LM Studio, liteLLM, Vertex, openAI-compatible (13+) |
| **Model registry** | `common/modelCapabilities.ts` | Context windows, capabilities per model. Update for new models |
| **System prompts** | `common/prompt/prompts.ts` | Search/replace block format, dirstr budgets, agent prompts. **★ Task 3 lands here** |
| **MCP client (shipped)** | `common/mcpService.ts` + `common/mcpServiceTypes.ts` + `electron-main/mcpChannel.ts` | Connect to external MCP servers from the chat. **★ Task 2 uses this** |
| **Settings storage** | `common/voidSettingsService.ts` + `browser/voidSettingsPane.ts` | Provider keys, model picks, chat modes. Stores user prefs |
| **Onboarding** | `browser/voidOnboardingService.ts` + `browser/react/src/void-onboarding/` | First-run flow. **Rebrand target — touches new-user perception** |
| **Service registration template** | `browser/_dummyContrib.ts` | Pattern for registering a new service. Copy this when adding our own |
| **Update / SCM main** | `electron-main/voidUpdateMainService.ts` + `common/voidUpdateService.ts` | Auto-update plumbing |
| **Metrics / telemetry** | `browser/metricsPollService.ts` + `common/metricsService.ts` + `electron-main/metricsMainService.ts` | Anonymous usage stats. **Worth auditing for what gets sent** |
| **Misc workbench wiring** | `browser/miscWokrbenchContrib.ts` (note typo in upstream) + `browser/void.contribution.ts` | Service registration on workbench startup |

### Supporting services worth knowing

- `browser/aiRegexService.ts` — regex-based pattern matching helper for AI flows
- `browser/_markerCheckService.ts` — diagnostic marker integration
- `browser/voidCommandBarService.ts` + `browser/react/src/void-editor-widgets-tsx/VoidCommandBar.tsx` — Cmd+K-style command bar
- `browser/voidSelectionHelperWidget.ts` + `browser/react/src/void-editor-widgets-tsx/VoidSelectionHelper.tsx` — selection-driven action UI
- `browser/tooltipService.ts` + `browser/react/src/void-tooltip/` — custom tooltip renderer
- `browser/extensionTransferService.ts` + `browser/extensionTransferTypes.ts` — extension migration helpers
- `browser/fileService.ts` — file operations
- `browser/helperServices/consistentItemService.ts` — UI stability helper for streaming
- `browser/helpers/findDiffs.ts` — diff calculation
- `common/directoryStrService.ts` + `common/directoryStrTypes.ts` — directory string formatting (the `MAX_DIRSTR_*` budget system referenced in prompts.ts)
- `common/refreshModelService.ts` — model list refresh
- `common/voidModelService.ts` — model abstraction
- `common/helpers/colors.ts` + `extractCodeFromResult.ts` + `languageHelpers.ts` + `systemInfo.ts` + `util.ts` — utilities
- `common/storageKeys.ts` — keys for stored settings

### React UI tree

Inside `browser/react/src/`:
- `sidebar-tsx/` — chat sidebar (Sidebar, SidebarChat, SidebarThreadSelector, ErrorBoundary, ErrorDisplay)
- `void-settings-tsx/` — settings pane (Settings, ModelDropdown, WarningBox)
- `void-onboarding/` — first-run flow (VoidOnboarding) **← rebrand priority**
- `quick-edit-tsx/` — Cmd+K UI (QuickEdit, QuickEditChat)
- `void-editor-widgets-tsx/` — VoidCommandBar, VoidSelectionHelper
- `void-tooltip/` — VoidTooltip
- `diff/` — diff rendering
- `markdown/` — chat markdown rendering (ChatMarkdownRender, ApplyBlockHoverButtons)
- `util/` — helpers (services.tsx, inputs.tsx, mountFnGenerator.tsx, useScrollbarStyles.tsx, helpers.tsx)
- `styles.css` — global React styles
- `tailwind.config.js` — Tailwind setup for the React subtree

Tailwind + React 19 + Floating UI + Lucide icons + react-tooltip + marked for markdown.

---

## Stack & build

- **Electron 34.3.2** host
- **Node 20.18.2** (locked via `.nvmrc`)
- **TypeScript ~5.8.0-dev** (early-2025 nightly)
- **React 19.1** + Tailwind 3.4 for the chat/settings UI
- **Gulp** build pipeline (multiple watch tasks: `watch-client`, `watch-extensions`, `watchreact`)
- **MCP SDK** `@modelcontextprotocol/sdk@^1.11.2` already a dependency — MCP client plumbing is shipped
- **Anthropic, OpenAI, Gemini, Mistral, Groq, Ollama** SDKs all already in `package.json`
- **SQLite** via `@vscode/sqlite3@5.1.8-vscode` already present — useful for our embeddings index (Task 5) without adding deps
- **PostHog** Node SDK present — Void uses it for telemetry, we should audit + likely strip for closed-source build
- **Tree-sitter WASM** present (`@vscode/tree-sitter-wasm`) — relevant if we ever build AST-based fallbacks for languages without LSP

### Build command quick-ref (from VSELITE-PLAN.md)

```powershell
cd C:\Users\heave\Desktop\mcp\vselite
nvm use                              # picks up .nvmrc
npm install                          # 10-15 min, native modules
# Then either Ctrl+Shift+B in VS Code, or:
npm run watch                        # waits until "Finished compilation with 0 errors"
.\scripts\code.bat --user-data-dir .\.tmp\user-data --extensions-dir .\.tmp\extensions
```

---

## What's already shipped (we keep)

- ✅ Chat UI shell, sidebar, settings pane, onboarding
- ✅ Agent loop + tool dispatcher (`toolsService.ts`)
- ✅ Apply (fast + slow) + DiffZones/DiffAreas
- ✅ Cmd+K, autocomplete, terminal tool, git AI commit messages
- ✅ 13+ LLM providers including DeepSeek + BYOK
- ✅ Native MCP client + main-process channel
- ✅ Onboarding flow
- ✅ `prompts.ts` scaffolding: search/replace block format, dirstr budgets, agent loop structure
- ✅ Theme infrastructure (Monaco's colorRegistry — VSElite gets all VS Code themes for free)

## What we need to add (the moat)

- ⬜ **Context Bridge primitives** as built-in tools (Task 4)
- ⬜ **Local embeddings index** via `sqlite-vec` (Task 5) — closes the `@workspace` gap vs Copilot
- ⬜ **Symbol-attached memory** (already shipped in our MCP package — port to native tool)
- ⬜ Optional: **trajectory recording** (Trae-style JSON step log — see [TRAE-RECON.md](TRAE-RECON.md))

## What we replace / rebrand

- 🔄 `product.json` (every brand string) — see [REBRAND.md](REBRAND.md)
- 🔄 `void_icons/` (swap art)
- 🔄 `extensionsGallery` URL (must move from MS Marketplace to Open VSX — license requirement)
- 🔄 `.voidrules` content (keep filename or rename, content reads ours)
- 🔄 React UI strings (the word "Void" appears in component names like `VoidOnboarding`, `VoidCommandBar`, `VoidTooltip`, `VoidSelectionHelper` — leave class names for now, change user-visible strings)
- 🔄 PostHog telemetry — likely strip or repoint to our own analytics

## What we defer (v2)

- Hosted paid-model marketplace (Trae-style billing on top of BYOK)
- Cloud sync of memory/settings
- Team features
- Multi-modal (image/voice) input

---

## Inherited rules from `.voidrules`

1. **All Void code stays in `src/vs/workbench/contrib/void/`.** Touching anything outside requires explicit user approval.
2. **No `any` casts.** Find the correct type.
3. **Don't add or remove semicolons.** Match existing convention.
4. **Hashmap naming: `bOfA`.** Map from `toolId` → `toolName` is `toolNameOfToolId`. Not `toolIdToName`.
5. **Don't run validation commands.** Describe what the user should run.

All of these get carried into VSElite. Renaming `.voidrules` to `.vseliterules` later is cosmetic.

---

## Things to verify before Day 2 starts

- [ ] `npm install` completes cleanly on Node 20.18.2 with VS2022 C++ workloads
- [ ] `npm run watch` reaches "Finished compilation with 0 errors"
- [ ] `.\scripts\code.bat --user-data-dir .\.tmp\user-data --extensions-dir .\.tmp\extensions` launches a working dev window
- [ ] Chat sidebar appears (Void's React panel)
- [ ] DeepSeek key can be configured via the settings pane
- [ ] A trivial chat call to DeepSeek returns a response

Once those six checkboxes flip, Day 2 begins (Task 1: rebrand).

---

## Open questions for dogfooding

These shape downstream decisions and shouldn't be solved by guessing now — solve them by using the editor for 1-2 hours.

1. Is Void's chat UX good enough as-is, or does the sidebar need a redesign?
2. Does the Apply system handle Context Bridge's structural suggestions (e.g., refactor based on call graph) cleanly, or do we need a new merge UI?
3. Which provider feels best for agent loops? (DeepSeek V4 Pro is our default bet — verify empirically)
4. Where do Void's prompts measurably underperform Cursor's? (Don't refactor preemptively — find evidence first)
5. Do we want trajectory recording (Trae-style step log) for debug + as a paid feature differentiator?
6. Should the chat support streaming summaries (Trae's "Lakeview" pattern) where mid-agent-loop summaries appear in a side panel?

---

*Companion docs at vselite root: [VSELITE-PLAN.md](VSELITE-PLAN.md) (build plan + Context Bridge integration paths), [DEEPSEEK-HANDOFF.md](DEEPSEEK-HANDOFF.md) (DeepSeek's task queue), [REBRAND.md](REBRAND.md) (branding decisions), [TRAE-RECON.md](TRAE-RECON.md) (what to learn from Trae).*
