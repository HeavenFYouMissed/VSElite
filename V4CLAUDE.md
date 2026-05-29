# V4CLAUDE — Claude ⇄ Cursor coordination log

> Live touch-log so Claude and Cursor don't collide while working `vselite` in
> parallel. **Both agents: read this before editing. Update it when you
> start/stop work on a path.**

**Last updated:** 2026-05-29

---

## Who's doing what right now

**Cursor (Daniel driving):** hardening V3Code — image-with-chat, making existing
features work correctly. **MAJOR REFACTOR IN PROGRESS:** merging newer VS Code
into the fork — panel/webview/registration APIs and file paths will move.
Touching existing `void/` services + the chat UI + broad `src/vs` areas.

> Because of the merge: build V's **UI (`void-panel/`) anytime** (decoupled,
> unaffected); build V's **host shell after the merge settles**, mirroring the
> post-merge panel/webview pattern. Locate integration points by pattern, not
> line number.

**Claude (this agent):** designed the **V companion** + produced its build plan.
Currently **planning/docs only — NOT writing V3Code code.** Cursor will build V
from the plan.

---

## Paths Claude has touched

- `vselite/V4CLAUDE.md` (this file)
- `vselite/V-SOURCE-OF-TRUTH.md` (the V plan + structure + status + build checklist)

That's it. **Claude has NOT modified anything under `src/`.**

---

## Paths reserved for the V build (where V code WILL go)

When V gets built, it is **all new files** — zero overlap with Cursor's hardening:

- `vselite/void-panel/**` — NEW standalone Vite + React app (V's UI). New folder.
- `vselite/src/vs/workbench/contrib/void/browser/vCompanionPane.ts` — NEW thin
  webview host (registers V's bottom-panel tab).
- `vselite/src/vs/workbench/contrib/void/browser/vCompanionContent.html` — NEW
  webview HTML template.
- `vselite/src/vs/workbench/contrib/void/browser/void.contribution.ts` — small
  ADD (one import line to register the pane). **Shared file — coordinate here.**
- root `package.json` — small ADD (two `void-panel-*` scripts). **Shared file.**

**Do NOT modify** `sidebarPane.ts` or the existing chat React tree for V — V is a
separate bottom-panel view, not a change to the right-side chat.

## Collision rule

V is almost entirely new files, so conflicts are unlikely. The only shared files
are `void.contribution.ts` (one import) and root `package.json` (two scripts) —
if either side edits those, note it here first. Anyone starting V work: update
the "Who's doing what" section above.
