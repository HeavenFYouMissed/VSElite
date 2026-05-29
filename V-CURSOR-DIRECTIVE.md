# Cursor Directive — Build V's panel housing (Phase 1)

> Paste this to Cursor (or point Cursor at this file). Full context lives in
> `V-SOURCE-OF-TRUTH.md`; collision rules in `V4CLAUDE.md`. **Read both first.**

## What to build

A new **bottom-panel tab named "V"**, sitting **next to the Ports tab**, that
renders a standalone web app (V's UI) inside a VS Code **webview**. Phase 1 = the
housing + a greeting. No agent behavior yet.

## Hard rules (do not violate)

1. **V is a NEW Panel view.** Do **not** modify `sidebarPane.ts` or the existing
   chat React tree. V is separate from the right-side chat.
2. **V's UI is a NEW standalone Vite + React app at `vselite/void-panel/`.** It
   must **never** live in `src/vs` and must **never** go through
   scope-tailwind / tsup / `gulp`. Plain Vite + plain Tailwind.
3. **The native host is THIN (~100 lines):** register the view, create a webview,
   bridge `postMessage`. **All** UI logic stays in `void-panel/`.
4. **Host the iframe via the VS Code webview API** — NOT a raw `<iframe>`
   appended to the workbench DOM (the workbench CSP `frame-src` blocks it).
5. **React, not vanilla** (streaming transcript + animated sprite + dashboard).

## Placement

Register a new ViewContainer at `ViewContainerLocation.Panel` with an `order`
that puts the tab **right after Ports**. **Mirror how the Ports / Terminal /
Output view containers register in the current (post-refactor) tree** — find that
pattern and copy it; do not rely on any line numbers from the docs.

## Files (all new except two tiny shared edits)

```
vselite/void-panel/                         NEW Vite+React app (V's UI)
  package.json  vite.config.ts  tailwind.config.js  tsconfig.json  index.html
  src/main.tsx  src/App.tsx  src/index.css
  src/components/  VChat VSprite VChoices VDashboard VStatusBar
  src/hooks/       useVoidBridge.ts  useStreamingMessage.ts
  src/lib/         messagePort.ts  types.ts
  dist/  (build output, gitignore)
vselite/src/vs/workbench/contrib/void/browser/
  vCompanionPane.ts        NEW thin webview host (registers the V Panel tab)
  vCompanionContent.html   NEW webview HTML (iframe; env-dependent src)
  void.contribution.ts     ADD one import (shared file — see V4CLAUDE.md)
vselite/package.json       ADD void-panel-dev / void-panel-build (shared file)
```

## Dev / prod

- **Dev:** `cd void-panel && npm run dev` → Vite HMR at `http://localhost:5173`.
  Webview HTML points the iframe at localhost. Edit `void-panel/src/**` →
  hot-reloads in the panel, **no gulp**.
- **Prod:** `npm run build` → `void-panel/dist/`. Host points the iframe at
  `asWebviewUri(dist/index.html)`; set `localResourceRoots` to the **app-root**
  `void-panel/dist` (V3Code is the workbench, NOT an extension — do not use
  `extensionUri`).

## postMessage RPC the host exposes (verified signatures)

- `toolsService.callTool(toolName, params)` — the 11 Context Bridge tools.
- `chatThreadService.addUserMessageAndStreamResponse(userMessage, threadId, images?)`
  — streams via `onText`/`onFinalMessage`; `images?` is the image-attach path.
- `chatThreadService.approveLatestToolRequest(threadId)` / `rejectLatestToolRequest(threadId)`.
- `chatThreadService.jumpToCheckpointBeforeMessageIdx(threadId, idx, jumpToUserModified?)`.
- `llmMessageService.sendLLMMessage(prompt, onText, onFinalMessage, onError, onAbort)` → requestId (V's Flash brain).
- `llmMessageService.abort(requestId)`.

Define the protocol once in `void-panel/src/lib/types.ts`. In `messagePort.ts`
validate `event.origin` — accept `http://localhost:5173` (dev) and the computed
`vscode-resource` origin (prod).

## Phase-1 acceptance

- A **"V" tab appears next to Ports**; clicking it shows the Vite React app.
- App shows the sprite (idle/waving) + a greeting + a status line fed by one RPC
  call (`get_project_briefing` / counts).
- Editing `void-panel/src/**` hot-reloads in the panel with **no gulp**.
- Prod build loads in the webview with no CSP/404 errors.

## Sequencing with the VS Code merge

- `void-panel/` can be built **now** — it's independent of the merge.
- Build the **host** (`vCompanionPane.ts` + html + registration) **after** the
  merge settles, mirroring the post-merge panel/webview APIs.
- Keep V's workbench coupling to exactly the files above so the merge can't
  scatter it.
