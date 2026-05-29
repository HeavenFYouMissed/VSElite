# VS Code Upstream Catch-Up + Forks Landscape (May 2026)

> Research compiled 2026-05-29 for VSElite / V3Code.
> **Your base:** `code-oss-dev` **1.99.3** (VS Code, April 2025) → Void → V3Code/VSElite.
> **Upstream now:** **VS Code 1.122** (May 28, 2026).
> **Gap:** ~23 minor versions / ~14 months. Since **v1.111 the cadence went weekly**, so the gap widens fast.

**Verification caveat:** `code.visualstudio.com` blocks automated fetchers (HTTP 403). Feature lists below were extracted from official release-notes pages via search + the `microsoft/vscode-docs` source. Headline features and version→month mapping are reliable; before *porting* a specific feature, open the cited URL in a real browser to confirm exact setting IDs / API signatures / breaking-change notes.

---

## TL;DR

1. **You will not lose your chat by upgrading** — your chat lives entirely in `src/vs/workbench/contrib/void/` (152 files, isolated). The catch-up is about the *platform underneath* it.
2. **The big things you're missing are platform-level, not chat:** the **integrated browser** (device emulation, HTML/Mermaid preview, in-editor web debugging), the **Electron 35→37 / Node 20→22** runtime, **TypeScript 6.0** language service, **git worktrees**, **terminal IntelliSense**, **EditContext input**, webview perf rework, new default themes, and **several security fixes**.
3. **The integrated browser you asked about** was introduced in **v1.109 (Jan 2026)** and matured through **v1.122** — device emulation landed last week. You have only the *old* `simple-browser` extension. This is your single biggest "real upgrade" gap.
4. **Forks worth studying (open-source-borrowable first):** Eclipse Theia (AI framework architecture), Kiro (spec-driven dev + hooks), Continue (Apache-2.0, reusable agent plumbing), Cline (reference agent loop), Zed/ACP (agent protocol), OpenVSCode/code-server (upstream-sync *maintenance* patterns). Void itself is **paused** (Jan 2026).
5. **Catch-up is a diff-transplant, not a git rebase** — you have no shared history with upstream. Adopt a **patch-overlay** maintenance model so you never get this far behind again.

---

# PART A — What you'd lose by staying on 1.99.3

Grouped by theme, with the version each item landed in. Chat/Copilot-specific features are intentionally excluded (you have your own).

### Platform runtime (you are on the *old* runtime)
- **Electron 35 → 37**, **Node.js extension host 20 → 22** (Chromium 134→138). `1.101` / `1.103`
  - ⚠️ **Breaking:** the `navigator` global now exists in the desktop/remote extension host (`1.101`). Extensions that sniff `navigator` to detect "web" can break. Mitigation flag: `extensions.supportNodeGlobalNavigator`.
- **ESM extensions** supported in the Node extension host (`"type":"module"`). `1.100`
- Build pipeline now runs TS directly on Node 22.18+ (`ts-go` typecheck). `1.107`

### Security (you're missing hardening + fixes)
- **Mandatory extension signature verification on Linux** (was Win/macOS only). `1.100`
- **VSCE secret scanning** when packaging extensions. `1.101`
- **Linux JSON policy support** (enterprise managed config). `1.106`
- **`chat.agent.networkFilter` via group policy** — admin allow/deny domain lists for automation/browser/fetch. `1.116`
- **MCP server sandboxing** (`"sandboxEnabled": true`, macOS/Linux). `1.112`
- Agent tool auto-approval guardrails: `chat.tools.eligibleForAutoApproval`, sensitive-file edit confirmation, terminal auto-approve opt-in. `1.104` / `1.107`
- **Core security patches** you don't have (e.g. `1.100.3`, `1.110.1`).
- Auth platform: **PKCE for GitHub** (`1.105`), MSAL **native brokers** macOS/Linux (`1.105`/`1.107`), device-code flow (`1.106`), `AuthenticationSession.idToken` (`1.106`).

### Integrated browser (your stated priority — see Part B for the deep dive)
- Introduced `1.109`; browser tools/automation `1.110`; entry points `1.116`; attach-as-context `1.119`; **HTML + Mermaid preview** `1.121`; **device emulation + screenshots** `1.122`.
- **In-editor web debugging:** new **`editor-browser` debug type** (launch + attach, breakpoints, stepping) `1.112`; "Emulate a focused page" debug option `1.122`; pinch-to-zoom (macOS) `1.115`.

### Editor / Monaco
- **EditContext-based input enabled by default** — major IME/input robustness. `1.101`
- **Variable line heights** via decorations. `1.100`
- **Expandable TS/JS hovers** (stable). `1.103`
- **Selectable/copyable deleted text in diff editor.** `1.106`
- **On-demand hovers** (`editor.hover.enabled: onKeyboardModifier`). `1.107`
- **Go to Line** char-offset `::` navigation + 0/1-based toggle. `1.106`
- **Scroll on middle click**, multi-file diff next/prev, copy-diagnostic-hover, accent-insensitive Command Palette. `1.102`/`1.106`
- **macOS swipe-to-navigate** editors. `1.107`
- Diff view: side-by-side/modal layout controls, **Markdown-rendered diffs**. `1.118`/`1.120`

### Webview performance & architecture (affects your whole UI + your React chat)
- Webviews optimized for speed/memory; file contents **streamed in chunks** to the service worker. `1.118`
- Webviews use **CSS anchor positioning** in the workbench — faster relayout, fixes out-of-position bugs. `1.119`
- *Relevance:* your chat is a React webview; these are free perf wins and may conflict with any webview-positioning patches you carry.

### Terminal
- **Terminal IntelliSense** out of preview → stable (PowerShell/bash/zsh/fish), then defaulted to **manual trigger (Ctrl+Space)** after feedback. `1.106`/`1.107`/`1.108`
- **Sticky scroll on by default**; shell-environment discovery (PowerShell); LSP-backed completions in REPL. `1.104`/`1.101`
- New-terminal-in-new-window entry points; status-bar redesign. `1.104`/`1.108`
- `onTerminal` / `onTerminalShellIntegration` activation events. `1.103`
- Output **compression** for large terminal output. `1.120`/`1.121`

### Git / SCM
- **Git worktree support** (detect/create/delete/open) + Repositories-view redesign. `1.103`/`1.104`
- Source Control Graph: **incoming/outgoing nodes, Compare with…, repositories explorer, stashes**. `1.106`/`1.107`
- Commit-message folding; quick-diff staged-change decorations. `1.106`/`1.100`
- `getRepositoryWorkspace` Git extension API. `1.106`

### Debugging
- **`editor-browser` debug type** for the integrated browser. `1.112`
- Disassembly-view context menu; JS debugger Network view default-on (Node ≥22.14). `1.100`

### Extension API surface gained (additive unless noted)
- **Text Encodings API** finalized. `1.100`
- **`LanguageModelChatProviders`** finalized — contribute models. `1.104`
- **`SecretStorage.keys()`** (proposed→). `1.103`
- **Secondary Side Bar view-container contribution point** finalized. `1.106`
- `customEditorDiffs` + **`documentDiff` / `workspace.getTextDiff()`** (built-in diff algo exposed to extensions; proposed). `1.120`
- QuickPick `prompt`, NLS IntelliSense for `package.json`, LM-tool argument-scoped approval. `1.108`/`1.111`/`1.114`
- **Edit Mode deprecated** (removed in 1.125) — chat-adjacent. `1.110`

### Language services
- **TypeScript 6.0** for JS/TS language support. `1.114` (bundled TS also moved 5.9 → 6.0.x along the way)
- **TypeScript 7.0 native preview** (Go-rewrite, big perf) available as an extension. `1.107`

### Themes / UX / Accessibility
- **New default themes "VS Code Light/Dark"** replace "Modern"; OS theme syncing defaults to them. `1.113` — *a fork keeping old defaults looks dated and diverges on color tokens.*
- Refreshed codicon set. `1.106`
- Rebindable Quick Input shortcuts (`quickInput.*`). `1.105`
- Floating windows: compact + always-on-top. `1.100`
- Secondary Side Bar default-visibility, maximized secondary sidebar, window border color (Win/Linux). `1.100`/`1.102`/`1.104`
- Accessibility push: screen-reader pwsh integration, accessible-view persistence, accessible chat carousel + "thinking" toggle. `1.105`/`1.110`
- **Rich issue reporting** with screenshots + video. `1.122`

### Lifecycle / automation primitives (borrowable even without chat)
- **Agent Hooks framework** — shell commands at lifecycle points, **same hook format as Claude Code / Copilot CLI**. `1.109`+
- Plugin/MCP enable-disable per-workspace or global without uninstall. `1.112`

---

## Per-version index (month map)

| Ver | Month | Non-chat headline(s) |
|----|----|----|
| 1.100 | Apr 2025 | Linux ext signing; floating windows; Text Encodings API; ESM ext |
| 1.101 | May 2025 | **Electron 35 / Node 22** (navigator breaking); **EditContext default** |
| 1.102 | Jun 2025 | Middle-click scroll; loopback GitHub auth; MCP GA |
| 1.103 | Jul 2025 | **Git worktrees**; TS 5.9; Electron 37; expandable hovers |
| 1.104 | Aug 2025 | Terminal sticky-scroll default; `LanguageModelChatProviders`; worktree compare |
| 1.105 | Sep 2025 | PKCE GitHub auth; MSAL broker (macOS); rebindable Quick Input |
| 1.106 | Oct 2025 | Selectable diff-delete; Go-to-Line `::`; Linux policy; terminal IntelliSense stable |
| 1.107 | Nov 2025 | On-demand hovers; TS 7.0 preview; swipe-nav; auth broker Linux |
| 1.108 | Dec 2025 | Terminal IntelliSense → manual trigger; status-bar redesign |
| 1.109 | Jan 2026 | **Integrated browser introduced**; Agent Hooks framework |
| 1.110 | Feb 2026 | Browser automation tools; a11y push; `1.110.1` security |
| 1.111 | ~Feb 2026 | **Weekly release cadence begins**; NLS IntelliSense |
| 1.112 | Mar 2026 | **`editor-browser` debug type**; MCP sandboxing; plugin enable/disable |
| 1.113 | Mar 2026 | **New default themes**; OS theme sync |
| 1.114 | Mar 2026 | **TypeScript 6.0** for JS/TS; semantic workspace search |
| 1.115 | Apr 2026 | Integrated-browser pinch-zoom; `send_to_terminal` for bg terminals |
| 1.116 | Apr 2026 | Browser entry points; `chat.agent.networkFilter` policy; Copilot becomes built-in |
| 1.117 | Apr 2026 | TS 6.0.3 recovery; terminal-profile launch |
| 1.118 | May 2026 | **Webview perf/memory rework**; diff layout controls |
| 1.119 | May 2026 | Webview **CSS anchor positioning**; browser tab as context |
| 1.120 | May 2026 | `customEditorDiffs` + **`documentDiff` API**; Markdown-in-diff |
| 1.121 | May 2026 | **Built-in HTML preview + Mermaid** (built-in ext); remote agents |
| 1.122 | May 2026 | **Browser device emulation**; rich issue reports (screenshot/video) |

---

# PART B — Integrated Browser (deep dive, your priority)

You currently ship only `extensions/simple-browser` (the legacy iframe-in-a-webview). The **new integrated browser** is a workbench-level feature that does not exist in 1.99.3.

| Capability | Version |
|---|---|
| Integrated browser introduced (preview/inspect localhost, DevTools, auth) | 1.109 (Jan 2026) |
| Automation tools: read page content, console errors/warnings | 1.110 |
| **`editor-browser` debug type** — launch/attach, breakpoints, stepping inside the editor | 1.112 |
| Pinch-to-zoom (macOS, up to 3×) | 1.115 |
| Entry points to open/jump to browser tabs | 1.116 |
| Attach a browser tab as context (picker, drag-drop, read/interact state) | 1.119 |
| **Built-in HTML file preview** (no extension) + **Mermaid preview** | 1.121 |
| **Device emulation** (screen sizes, mobile/touch, custom UA) via "Show Emulation Toolbar" | 1.122 |
| Screenshot/element/console capture; "Emulate a focused page" debug option | 1.122 |

**Direct port candidates (high value, low coupling):**
- The **"Mermaid Markdown Features"** built-in extension merged upstream at 1.121 — pull it in wholesale.
- Built-in **HTML preview** + the **integrated browser** workbench contribution.
- The **`editor-browser` debug type** for in-editor web debugging.

These are the "browser + real bug upgrades" you specifically mentioned.

---

# PART C — Other VS Code forks worth studying (May 2026)

**Status confirmations:**
- **Void: PAUSED** (~Jan 12, 2026) — team went to explore new ideas in stealth; the fork is unmaintained. Apache-2.0.
- **Windsurf:** OpenAI's ~$3B deal collapsed (Jul 2025) → Google reverse-acqui-hired the CEO → **Cognition (Devin) bought the rest (~$250M, Dec 2025)**. Now actively developed under Cognition.
- **Cursor (Anysphere):** ~$2B ARR, ~$29.3B valuation. Closed/proprietary fork of Code OSS.
- **Antigravity (Google):** launched Nov 18 2025; **2.0 at Google I/O May 19 2026**. Closed, free.
- **Kiro (Amazon):** public preview Jul 14 2025. Closed, free preview. Spec-driven dev on Claude/Bedrock.

### Ranked shortlist — most worth borrowing from (open-source first)

1. **Eclipse Theia** *(open, EPL; not a fork but VS Code-compatible)* — Best open reference for a **clean, vendor-neutral AI/agent/MCP framework** (Theia AI) + a real LTS/governance model. Study the architecture.
2. **Amazon Kiro** *(closed, but the idea is free)* — **Spec-driven development** (requirements → design → task list, kept in-repo and synced to code) and **event-triggered Hooks**. Model-agnostic, very implementable in an open fork.
3. **Continue** *(open, Apache-2.0; extension, not a fork)* — **Directly reusable as a component** — agent/rules/config abstractions + multi-provider layer. PearAI literally embedded it. Saves you building AI plumbing from scratch.
4. **Cline** *(open; extension)* — The **reference open-source agent loop**: plan/act with per-step human approval + clean tool-use model. Emulate the UX.
5. **Zed / Agent Client Protocol** *(open, GPL; Rust editor — not borrowable code)* — **Adopt ACP** so external agents (Claude Code, Codex CLI, Gemini CLI) plug into your fork via a cross-editor standard instead of bespoke integration.
6. **OpenVSCode Server / code-server** *(open)* — For **fork maintenance**: OpenVSCode auto-tracks upstream; code-server uses a **patch-file overlay**. These are exactly the patterns that prevent being stuck on 1.99.3 again. (See Part D.)
7. **Positron** *(source-available)* — Borrow the pattern of an **AI agent wired into a live runtime/session** (not just static files).
8. **Cursor / Windsurf** *(closed — study, can't copy)* — North-star UX: **parallel multi-agents on git worktrees** (Cursor); **codebase-context-first flow + in-editor background agents** (Windsurf Cascade/Codemaps/Devin).
9. **Roo Code** *(open; shutting down May 15 2026)* — Lift the **mode-based agent design** (Code/Architect/Ask/Debug) before it's gone.
10. **VSCodium** *(open, MIT)* — Reference for **de-branded builds + Open VSX**, which every fork needs (Microsoft blocks its marketplace + closed extensions like C/C++ and Pylance on forks).

**Cautions:** **Trae** (ByteDance) — repeatedly flagged for heavy telemetry that persists when disabled; a cautionary example, not a model. **PearAI** — stalled, mostly repackages Continue/Cline, carries 2024 attribution-controversy baggage.

---

# PART D — Practical catch-up strategy

**You have no shared git history with `microsoft/vscode`** (shallow ~325-commit history starting at Void commits, no upstream remote). So you cannot `git rebase` onto 1.122. The realistic options:

### Option 1 — Diff-transplant onto a fresh checkout (recommended one-time catch-up)
1. Check out upstream `microsoft/vscode` at the tag you target (e.g. `1.122` — or a slightly older even-numbered Stable if you want a settling period).
2. Re-apply your isolated fork on top. Your footprint is small and clean:
   - `src/vs/workbench/contrib/void/` (152 files) — copy in wholesale.
   - The handful of upstream touch-points (e.g. `workbench.common.main.ts` registration) — re-apply by hand.
   - `product.json` branding, `void_icons/`, build/branding scripts.
3. Re-run `buildreact`, fix the deltas (Electron/Node 22 + EditContext + webview-positioning changes are the likely friction points for your React chat webview).

### Option 2 — Patch-overlay model (recommended *ongoing* discipline)
Adopt **code-server's patch-file approach** or **OpenVSCode's auto-sync**: keep your changes as a small set of patches/clearly-isolated modules applied over a pinned upstream, so each upstream bump is `git pull upstream && reapply patches`. This is the durable fix for "don't get stuck on an old version again," now that upstream ships **weekly**.

### Sequencing suggestion
- **Do not** chase weekly Stable. Pick an **even-numbered Stable** as your rebase target every few months.
- **Phase 1 (runtime):** land Electron 37 / Node 22 + EditContext + webview perf — these unblock everything else.
- **Phase 2 (your priority features):** integrated browser + HTML/Mermaid preview + `editor-browser` debug.
- **Phase 3 (quality of life):** git worktrees, terminal IntelliSense, TS 6.0, new default themes, security/policy hardening.

### Divergence watch when merging
- From **1.116**, upstream ships **Copilot as a built-in extension** — you'll want to strip/replace it since you have your own chat.
- The `navigator` global breaking change (1.101) may affect any web-detection logic.
- New default themes (1.113) change color tokens — reconcile with your branding.

---

## Sources

Release notes (per version): `https://code.visualstudio.com/updates/v1_100` … `/v1_122`; integrated browser docs `https://code.visualstudio.com/docs/debugtest/integrated-browser`.

Forks: Void status (GitHub voideditor/void #926, cursor-alternatives.com); Windsurf saga (TechCrunch, Fortune, DeepLearning.ai The Batch, NxCode); Antigravity (Google Developers Blog, Wikipedia); Kiro (InfoQ); Cursor (TheNextWeb, cursor.com/blog/2-0); Theia (theia-ide.org, Eclipse Newsroom Mar 2026); Continue/Cline/Roo (respective GitHubs); Zed/ACP (zed.dev, DevClass); OpenVSCode/code-server (gitpod-io/openvscode-server, coder/code-server); Positron (posit.co); VSCodium (vscodium.org). Full URL list captured in the research transcript.
