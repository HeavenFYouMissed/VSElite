# V3Code Upgrade Plan — Base 1.99.3 → 1.122, Bloat Reduction, Dev Loop

> Owner: Daniel (KandD Labs). This is the canonical execution plan for moving V3Code
> off the stale vendored VS Code 1.99.3 base and onto current upstream, plus the
> workspace cleanup and dev-loop fixes that make that work tractable.
>
> Companion research lives on branch `claude/vscode-forks-review-tdtYM` (PR #2):
> `VSCODE-UPGRADE-PLAYBOOK.md`, `VSCODE-UPGRADE-BREAKAGE-REPORT.md`,
> `VSCODE-UPSTREAM-CATCHUP-AND-FORKS-2026.md`. Read those for the measured detail.

---

## TL;DR sequencing (each step makes the next easier)

1. **Dev loop fix — DONE.** `dev.ps1` now has a fast path (seconds, not minutes).
2. **Bloat reduction** — shrink the workspace before the re-fork so the replant is clean.
3. **Base upgrade (Route B re-fork)** — re-fork vanilla 1.122, replant our delta.
4. **Verify the chat webview renders** on the new runtime (our highest risk).
5. **Verify the integrated browser** (ships in 1.122; mostly enable + rebrand).
6. **QoL inheritance** — git worktrees, terminal IntelliSense, TS6, security/policy.
7. **Patch-overlay discipline** — never fall 23 versions behind again.

---

## 0. Reality check: why the base upgrade does NOT fix the build pipeline

The "I can't see my visual edits" pain is **not** from the VS Code base. It's from Void's
custom React build layered on top: `scope-tailwind → tsup → gulp compile-client`. That
chain exists on any base version. The slow part is `gulp compile-client` (~3 min) which
recompiles the whole workbench just to propagate a React bundle.

**Fix (already shipped in `dev.ps1`):** for React/CSS edits, skip gulp entirely and copy
the freshly-built `react/out/*` straight into the host output tree
(`out/vs/workbench/contrib/void/browser/react/out/`), then reload the window (`Ctrl+R`).
Measured: ~18s vs ~3+ min.

```
.\dev.ps1            # WATCH, fast path. Edit .tsx -> auto rebuild+copy -> Ctrl+R in V3Code.
.\dev.ps1 -Once      # one fast build + launch.
.\dev.ps1 -FullGulp  # full gulp build (needed after editing .ts service files).
```

Rule of thumb:
- Edited `.tsx`/`.css` under `react/src/` → fast path is enough.
- Edited `.ts` in `browser/` or `common/` → run `.\dev.ps1 -FullGulp` once.

The new base *might* help marginally (webview perf rework in 1.118) but do not expect HMR.

---

## 1. The mental model (do not skip)

This repo is **not** layered on a VS Code that lives elsewhere. The entire VS Code source
tree at **1.99.3** is **vendored** into the repo. There is **no base version to bump**.
Upgrading = a **source merge / re-fork**: bring 23 versions of upstream changes in while
keeping our edits on top.

Our git history does **not** descend from `microsoft/vscode`, so a plain `git merge` can't
find a base. We re-fork and replant.

---

## 2. Our exact delta vs vanilla 1.99.3 (measured in PR #2, still accurate)

- **340 Added files** → all of `contrib/void/`, `backend/`, docs, branding. Carry over as-is.
- **22 Deleted files** → Microsoft CI/`.github`. Ignore.
- **57 Modified files** → the only merge surface. Most are branding. The real core-logic
  edits are tiny (~10 files, 1–87 lines each).

### Everything built in the recent feature work is replant-safe
All of the May 2026 additions — image input, `autoContextService`, `backgroundAgentService`,
`slashCommandService`, `chatGhostTextService`, `tokenBudget`, embeddings, the DeepSeek V4 /
reasoning_content fixes, the LSP caller fallback, the new tools — live **inside
`contrib/void/`** (added files + edits within the void contribution). They are **additions**
and **carry over wholesale**. None touch the ~10 core touchpoints. The re-fork will not fight
this work; it just needs **re-verification that the chat webview still renders** on the new
runtime.

### The ~10 core touchpoints to re-apply by hand (3-way merge)
```
src/vs/workbench/workbench.common.main.ts          (registers Void contribution)
src/vs/code/electron-main/app.ts                   (+33)
src/vs/editor/contrib/smartSelect/browser/smartSelect.ts (+87, the big one)
src/vs/editor/common/config/editorOptions.ts       (1-2 lines)
src/vs/editor/contrib/lineSelection/browser/lineSelection.ts (1-2 lines)
src/vs/workbench/browser/layout.ts
src/vs/platform/telemetry/common/telemetryService.ts
src/vs/platform/keybinding/common/keybindingsRegistry.ts
src/vs/platform/encryption/electron-main/encryptionMainService.ts
src/vs/base/common/product.ts
src/vs/workbench/services/themes/common/workbenchThemeService.ts
(+ auxiliarybar / paneCompositeBar / panelActions / workbench.contribution UI tweaks)
```

### Measured breakage on the merge itself (from the breakage report)
- **0 of 570** `contrib/void` → core module imports break.
- **2 of 761** named symbols moved: `inputBackground` / `inputForeground` moved from
  `vs/platform/theme/common/colorRegistry` → `vs/platform/theme/common/colors/inputColors`.
- **7 small merge conflicts** in touchpoint files.
- **2 files moved** by the `electron-sandbox → electron-browser` rename.

The merge is hours. The time sink is runtime (next section).

---

## 3. Bloat reduction (do BEFORE the re-fork)

Goal: shrink what the agent indexes and what carries over. **Do not delete VS Code source** —
the large grammars/perf-fixtures/icons are legitimate and required to build.

### Safe to remove (ours, served their purpose)
- `docs/cursor-blueprint/*.txt` and `docs/trae-blueprint/*.txt` extracted CSS/classname dumps
  (~1.7 MB). The `.md` blueprints are small and worth keeping; the giant `-extracted.txt`
  dumps were scraping artifacts used to build the UI, which is now built.
- Any `docs/cursor-blueprint/source/cursor-workbench.js` (~60k-line minified bundle) if present
  (already untracked).
- `.tmp/` runtime user-data/logs (already a runtime dir; ensure gitignored).

### Agent hygiene (the real "workspace too big" fix)
- Add `.cursorignore` at workspace root excluding: `**/node_modules`, `out/`, `.build/`,
  `.tmp/`, `**/*-extracted.txt`, `*.future`, and the vendored test fixtures that dominate
  search. This shrinks what the AI indexes without changing the build.

### Keep
- `src/`, `extensions/`, `build/`, `resources/`, `backend/`, `void_icons/`, all `contrib/void/`.

---

## 4. Base upgrade — Route B (clean re-fork + replant)

Recommended over the graft trick: most predictable.

```bash
# 1) fresh checkout of the target stable tag
git clone https://github.com/microsoft/vscode.git v3code-next && cd v3code-next
git checkout 1.122.0           # or latest Stable at execution time

# 2) copy ALL added files wholesale
cp -r <oldrepo>/src/vs/workbench/contrib/void  src/vs/workbench/contrib/
cp -r <oldrepo>/backend .
cp -r <oldrepo>/void_icons <oldrepo>/resources .
cp  <oldrepo>/product.json <oldrepo>/*.md <oldrepo>/*.ps1 .

# 3) re-apply the ~10 core touchpoints by hand, using the old diff as the spec:
git --git-dir=<oldrepo>/.git diff 1.99.3 HEAD -- <each core file>

# 4) merge package.json + eslint.config.js by hand:
#    keep OUR scripts (buildreact/watchreact) and OUR added deps, on the new base.

# 5) fix the 2 symbol imports:
#    inputBackground/inputForeground -> vs/platform/theme/common/colors/inputColors

# 6) build & iterate
npm install
npm run buildreact
npm run watch
```

---

## 5. Runtime hotspots (where the real time goes — NOT merge conflicts)

In rough order of risk for V3Code specifically:

1. **Our React chat webview** — webview got reworked twice (1.118 perf/memory, 1.119 CSS
   anchor positioning). `SidebarChat` + all recent UI is a webview. **Highest risk.** Verify
   it renders, positions, and that the new image paste/drop still works.
2. **Electron 35→37 / Node 20→22** — the `navigator` global now exists in the ext host.
3. **EditContext input default-on (1.101)** — affects any custom cursor/input handling.
4. **New default themes (1.113)** — color tokens changed; reconcile with branding.
5. **Built-in Copilot from 1.116** — upstream bundles it; strip/disable it (we have our own chat).
6. **The React/esbuild bundle** (`contrib/void/browser/react/`) — its own deps/build on the new base.

---

## 6. Priority features to land after build-green

Owner priority: **integrated browser first; security comes free with the base.**

- **Integrated browser** (introduced 1.109, matured to 1.122): device emulation, screenshots,
  HTML + Mermaid preview, in-editor `editor-browser` debug type, attach-tab-as-context. Mostly
  needs enabling + rebranding — it ships in the base.
- **Mermaid preview** built-in extension merged upstream at 1.121 — pull wholesale.
- **Security/policy** (free with base): Linux signature verification, `chat.agent.networkFilter`
  group policy, MCP server sandboxing, auth PKCE/MSAL brokers, core security patches.
- **QoL** (free with base): git worktrees, terminal IntelliSense, TypeScript 6.0, sticky scroll.

---

## 7. Patch-overlay discipline (so we never fall this far behind again)

Upstream now ships **weekly** (since 1.111). To stay current:
- Keep our delta minimal and isolated (it already is — `contrib/void/` + ~10 touchpoints).
- Maintain the touchpoint list in this doc. Document any NEW touchpoint the moment it's added.
- Periodically: `git fetch vscode --tags`, checkout the new stable, replant (steps in §4).
  Because the delta is small and isolated, this becomes a fetch + replay, not a 23-version catch-up.

---

## Status log

- 2026-05-29: Dev loop fast path shipped (`dev.ps1`). Bloat + base upgrade pending.
