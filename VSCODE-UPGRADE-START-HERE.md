# START HERE — VS Code base upgrade (read this first, then execute)

**You (the AI agent) have been asked to upgrade this fork's vendored VS Code base from
1.99.3 to the latest Stable (1.122). Everything you need is in this repo. Do this:**

## Step 0 — Get the docs onto your machine

These docs live on the branch `claude/vscode-forks-review-tdtYM` (GitHub PR #2 of
`HeavenFYouMissed/VSElite`). If you're not already on it:

```bash
git fetch origin claude/vscode-forks-review-tdtYM
git checkout claude/vscode-forks-review-tdtYM
```

## Step 1 — Read these four files in order

1. `VSCODE-UPGRADE-START-HERE.md`  ← (this file)
2. `VSCODE-UPGRADE-PLAYBOOK.md`     ← **the method + the full step-by-step brief. This is your main instruction set.**
3. `VSCODE-UPGRADE-BREAKAGE-REPORT.md` ← exactly what will break and the fixes (measured, not guessed).
4. `VSCODE-UPSTREAM-CATCHUP-AND-FORKS-2026.md` ← background: what's new in 1.100–1.122 and why we want it.

## Step 2 — Execute

Follow the **"COPY-PASTE BRIEF FOR CURSOR"** section at the bottom of
`VSCODE-UPGRADE-PLAYBOOK.md`. It is self-contained. In short:

- This repo *is* a full vendored copy of VS Code at 1.99.3 — there is no version number to
  bump; upgrading is a **source merge** onto a fresh 1.122 checkout.
- Re-fork onto vanilla `1.122.0`, replant our delta (340 added files carry over; ~10 core
  touchpoints re-applied; branding re-applied).
- The **entire measured breakage** is: 2 symbol-import fixes (`inputBackground`/`inputForeground`
  → `vs/platform/theme/common/colors/inputColors`), 7 small merge conflicts, and 2 files moved
  by the `electron-sandbox → electron-browser` rename. Tables are in the breakage report.
- Then make `src/vs/workbench/contrib/void/` compile + run on the new runtime
  (Electron 37 / Node 22 / EditContext / webview rework). That's where the real time goes.

## Step 3 — Work in phases, report after each

1. **Build green** on the new base. 2. **Verify the integrated browser** (device emulation,
HTML/Mermaid preview, `editor-browser` debug — they ship in 1.122, mostly need enabling/branding).
3. **QoL** (git worktrees, terminal IntelliSense, TS6, themes, security/policy — inherited from base).

## Rules (from `.voidrules`)
- Keep work inside `src/vs/workbench/contrib/void/`; touch upstream files only at the known
  touchpoints; document any new one.
- No casting to `any`. Don't add/remove semicolons against existing convention.
- Don't do the whole thing in one shot — get it building first, then verify the browser, then QoL.

## Priorities the owner stated
Integrated **browser** first; **security fixes** are important (they come free with the base move).
Don't cherry-pick features onto the old base — upgrade the base.
