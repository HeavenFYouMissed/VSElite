# VS Code Upgrade Playbook + Cursor Brief

> Companion to `VSCODE-UPSTREAM-CATCHUP-AND-FORKS-2026.md`.
> Goal: move VSElite/V3Code from its vendored VS Code **1.99.3** base up to current
> upstream (**1.122**, or latest Stable at execution time) to gain the integrated
> browser, security fixes, and platform features — **without losing your work.**

---

## 1. The mental model (read this first)

Your repo is **not** layered on a VS Code that lives somewhere else. The Void team
**copied the entire VS Code source tree at 1.99.3 into the repo** and committed their
changes on top. All of `src/vs/`, `build/`, `extensions/` is **vendored source**, not a
dependency. There is **no base version number to bump.** Upgrading = doing a **source
merge**: bringing 23 versions of upstream file changes into the repo while keeping your
edits on top.

## 2. Your exact fork delta vs vanilla 1.99.3 (measured)

- **419 files changed** total (`100k+` insertions).
- **340 Added** → never conflict (all 152 `contrib/void/` files, `backend/`, docs, branding). They just carry over.
- **22 Deleted** → Microsoft CI/`.github` files you removed. Irrelevant to the merge.
- **57 Modified** → the only real merge surface. Most are branding. The actual core-logic edits are tiny:

```
src/vs/workbench/workbench.common.main.ts   +6/-1   registers Void contribution
src/vs/editor/common/config/editorOptions.ts +1/-1
src/vs/editor/contrib/lineSelection/browser/lineSelection.ts +1/-1
src/vs/workbench/browser/layout.ts          +2/-2
src/vs/code/electron-main/app.ts            +33/0
src/vs/editor/contrib/smartSelect/browser/smartSelect.ts +87/0  (the big one)
```

### The 57 modified files, grouped

**Core VS Code source logic (re-apply by hand / 3-way merge — small edits):**
```
src/vs/base/common/product.ts
src/vs/code/electron-main/app.ts
src/vs/editor/common/config/editorOptions.ts
src/vs/editor/contrib/lineSelection/browser/lineSelection.ts
src/vs/editor/contrib/smartSelect/browser/smartSelect.ts
src/vs/platform/encryption/electron-main/encryptionMainService.ts
src/vs/platform/keybinding/common/keybindingsRegistry.ts
src/vs/platform/telemetry/common/telemetryService.ts
src/vs/workbench/browser/actions/layoutActions.ts
src/vs/workbench/browser/layout.ts
src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts
src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts
src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts
src/vs/workbench/browser/parts/paneCompositeBar.ts
src/vs/workbench/browser/parts/panel/panelActions.ts
src/vs/workbench/browser/workbench.contribution.ts
src/vs/workbench/contrib/chat/browser/actions/chatActions.ts
src/vs/workbench/contrib/chat/browser/chatParticipant.contribution.ts
src/vs/workbench/contrib/files/browser/fileActions.contribution.ts
src/vs/workbench/contrib/files/browser/views/explorerViewer.ts
src/vs/workbench/contrib/quickaccess/browser/viewQuickAccess.ts
src/vs/workbench/electron-sandbox/desktop.contribution.ts
src/vs/workbench/electron-sandbox/parts/dialogs/dialogHandler.ts
src/vs/workbench/services/themes/common/workbenchThemeService.ts
src/vs/workbench/workbench.common.main.ts
```

**Branding / assets / build (trivial re-apply — take YOUR version):**
```
product.json  package.json  package-lock.json  LICENSE.txt  README.md
eslint.config.js  build/hygiene.js  build/gulpfile.hygiene.js  build/npm/dirs.js
build/win32/code.iss  extensions/theme-defaults/package.json
.config/1espt/PipelineAutobaseliningConfig.yml  .vscode/tasks.json  .gitignore
src/vs/base/browser/ui/codicons/codicon/codicon-modifiers.css
src/vs/workbench/browser/media/code-icon.svg
src/vs/workbench/browser/parts/banner/media/bannerpart.css
src/vs/workbench/browser/parts/editor/media/editorgroupview.css
src/vs/workbench/contrib/update/browser/media/releasenoteseditor.css
src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStarted.css
src/vs/workbench/contrib/welcomeWalkthrough/browser/media/walkThroughPart.css
resources/** (all icons)
```

## 3. Strategy decision: upgrade the base, do NOT cherry-pick

- **Security fixes** are spread across hundreds of upstream files — uncherry-pickable. They come free with a base move.
- **The integrated browser** depends on newer webview/debug infra (1.10x+). Backporting it onto 1.99.3 means backporting its dependencies too — more work than upgrading.
- One base upgrade → browser + security + TS6 + terminal IntelliSense + git worktrees, all at once.

## 4. Method: re-fork onto current Stable + replant your delta (3-way merge)

Because your repo's git history does **not** descend from `microsoft/vscode`, a plain
`git merge` can't find the merge base. Use a 3-way merge with the **measured common
ancestor** (vanilla 1.99.3) as the base. Two viable routes:

**Route A — graft the real ancestor so git can 3-way merge (preserves history):**
```bash
git remote add vscode https://github.com/microsoft/vscode.git
git fetch vscode --tags --depth 1 1.99.3
git fetch vscode --tags --depth 1 1.122          # or latest Stable tag
# tell git that vanilla 1.99.3 is the ancestor of your tree:
git replace --graft <your-first-void-commit> 1.99.3
git merge 1.122      # now a real 3-way merge; conflicts confined to your 57 files
# resolve, then: git replace -d <your-first-void-commit>
```

**Route B — clean re-fork + replant (most predictable; recommended):**
```bash
git clone https://github.com/microsoft/vscode.git v3code-next && cd v3code-next
git checkout 1.122
# 1) copy ALL added files wholesale:
cp -r <oldrepo>/src/vs/workbench/contrib/void src/vs/workbench/contrib/
cp -r <oldrepo>/backend .
cp <oldrepo>/product.json <oldrepo>/*.md .
cp -r <oldrepo>/void_icons <oldrepo>/resources .
# 2) re-apply the ~10 small core touchpoints by hand (use the diff as the spec):
git --git-dir=<oldrepo>/.git diff 1.99.3 HEAD -- <each core file>   # shows exactly what to add
# 3) merge package.json/eslint.config.js by hand (keep your scripts + deps, on new base)
# 4) build & fix:
npm install && npm run buildreact && npm run watch
```

## 5. Runtime hotspots (where the real debugging time goes — NOT merge conflicts)

These can break `contrib/void` at runtime even after a clean merge:
- **Electron 35→37 / Node 20→22** (the `navigator` global now exists in the ext host).
- **EditContext input default-on** (1.101) — affects any custom input/cursor handling.
- **ViewPane constructor drift** — the chat is React mounted **directly into the workbench
  DOM** via `SidebarViewPane extends ViewPane` (NOT a webview/iframe). `renderBody`/`layoutBody`
  are verified unchanged in 1.122, but the `super(...)` call passes 10 positional deps; verify
  the `ViewPane` constructor didn't gain/reorder a dependency. Most likely signature break.
  (The 1.118/1.119 webview rework does NOT affect us — no `IWebviewService` in `contrib/void`.)
- **New default themes** (1.113) changed color tokens — reconcile with your branding.
- From **1.116**, upstream ships Copilot as a **built-in extension** — strip/replace it (you have your own chat).

## 6. Suggested sequencing

1. **Phase 0 — inventory (done):** the 57-file delta above is your spec.
2. **Phase 1 — runtime:** get it building/running on the new base (Electron37/Node22/EditContext/webview). This unblocks everything.
3. **Phase 2 — your priority features:** verify the integrated browser, HTML/Mermaid preview, `editor-browser` debug now work (they're in the base — mostly just need enabling/branding).
4. **Phase 3 — QoL:** git worktrees, terminal IntelliSense, TS6, themes, security/policy hardening (all inherited from the base).
5. **Phase 4 — discipline:** keep a small patch set so future upstream bumps are `fetch + replay`, not another 23-version catch-up (upstream ships weekly now).

---

## COPY-PASTE BRIEF FOR CURSOR

```
You are upgrading a VS Code fork. Read this fully before acting.

CONTEXT
- This repo (V3Code/VSElite) is a fork of Void, which is a fork of Microsoft VS Code OSS.
- The ENTIRE VS Code source is vendored into this repo at version 1.99.3 (April 2025).
  There is no "base dependency" to bump — upgrading means a SOURCE MERGE that brings
  upstream's changes into the vendored files while preserving our edits.
- Current upstream is 1.122 (May 2026). We are ~23 versions behind.
- Our chat/AI lives ENTIRELY in src/vs/workbench/contrib/void/ (152 files). Do not rewrite it.

OUR EXACT DELTA vs vanilla 1.99.3 (measured):
- 340 ADDED files (all of contrib/void/, backend/, docs, branding) -> carry over as-is.
- 22 DELETED files (Microsoft .github/CI) -> ignore.
- 57 MODIFIED files -> the only merge surface. Most are branding. Core-logic edits are tiny
  (workbench.common.main.ts +6, app.ts +33, smartSelect.ts +87, others 1-2 lines).

GOAL (in priority order)
1. Get the fork BUILDING and RUNNING on the latest VS Code Stable base.
2. Confirm the INTEGRATED BROWSER works (device emulation, HTML/Mermaid preview,
   editor-browser debug type) — these exist in the new base; mostly need enabling/branding.
3. Inherit all upstream SECURITY FIXES (they come free with the base move).

METHOD (re-fork + replant, 3-way merge)
1. git remote add vscode https://github.com/microsoft/vscode.git
2. Fetch tags 1.99.3 (our ancestor) and the latest Stable (e.g. 1.122).
3. Start from a clean checkout of the target Stable tag.
4. Copy all ADDED files wholesale: contrib/void/, backend/, *.md, void_icons/, product.json.
5. For each of the ~10 modified CORE source files, run
   `git diff 1.99.3 HEAD -- <file>` against the OLD repo to see exactly what we added,
   and re-apply that small edit onto the new file (3-way merge). Files:
     src/vs/workbench/workbench.common.main.ts  (Void contribution registration)
     src/vs/code/electron-main/app.ts
     src/vs/editor/common/config/editorOptions.ts
     src/vs/editor/contrib/lineSelection/browser/lineSelection.ts
     src/vs/editor/contrib/smartSelect/browser/smartSelect.ts
     src/vs/workbench/browser/layout.ts
     src/vs/platform/telemetry/common/telemetryService.ts
     src/vs/platform/keybinding/common/keybindingsRegistry.ts
     src/vs/platform/encryption/electron-main/encryptionMainService.ts
     src/vs/base/common/product.ts
     src/vs/workbench/services/themes/common/workbenchThemeService.ts
     (+ the auxiliarybar/paneCompositeBar/panelActions/workbench.contribution UI tweaks)
6. Merge package.json + eslint.config.js by hand: keep OUR scripts (buildreact/watchreact)
   and OUR added deps, on top of the new base's deps.
7. Re-apply branding (product.json, resources/ icons, *.css) — take OUR versions.
8. Build: npm install && npm run buildreact && npm run watch. Fix errors iteratively.

RUNTIME HOTSPOTS to expect (these break contrib/void at runtime, not at merge time):
- Electron 35->37 / Node 20->22: the `navigator` global now exists in the extension host.
- EditContext input is default-on (1.101): check custom cursor/input handling.
- ViewPane drift: the chat is React mounted DIRECTLY into the workbench DOM via
  SidebarViewPane extends ViewPane (NOT a webview). renderBody/layoutBody are unchanged in
  1.122, but the super(...) call passes 10 positional deps -- verify the ViewPane constructor
  didn't gain/reorder a dependency. Most likely signature break. (1.118/1.119 webview rework
  does NOT affect us.)
- New default themes (1.113) changed color tokens: reconcile with our branding.
- From 1.116 upstream bundles Copilot as a built-in extension: remove/disable it, we have
  our own chat.

RULES
- Per .voidrules: most work belongs in src/vs/workbench/contrib/void/. Touch upstream files
  only at the ~10 known touchpoints above; document any new one.
- Do NOT cast to `any`. Do NOT add/remove semicolons against existing convention.
- Work in phases: get it building first, then verify the browser, then QoL.
- After each phase, report what broke and what you changed.
```
