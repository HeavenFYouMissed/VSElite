# V3Code Plan Preview — Build Spec & Handoff

**Owner:** DeepSeek (queued — pick up after auto-context + Phase B)
**Reviewer:** Claude (Copilot Chat)
**Status:** SPEC LOCKED — ready to build
**Prereqs:** Phase B native CB tools registered (so the agent has something real to plan execution AROUND); Phase 1–4 auto-context wired (the plan card lives in the chat sidebar, which is already shipped via Sprint 1 agent panel).

Read in order before touching code:
1. [V3CODE-PLAN.md](V3CODE-PLAN.md)
2. [AGENTS.md](AGENTS.md) — operating rules
3. [AGENT-PANEL-SPEC.md](AGENT-PANEL-SPEC.md) — Sprint 1/2 panel context
4. This doc

---

## Mission

Match Cursor's "planning mode" UX: when the agent decides to take a multi-step action, it emits a **structured plan** that renders in the chat as an interactive card — numbered steps with file targets, rationale, complexity, and approve/edit/reject controls per step. Execution proceeds step-by-step with live status. The user always sees what the agent is about to do before it does it, and can edit or veto individual steps.

This is the **"holy shit" screenshot moment**. It's also load-bearing for Phase 4 (end-of-thread digest writer) because the plan structure feeds directly into the Session Memory bullet.

---

## Design decisions LOCKED

1. **Plan is a structured tool call, not a free-form markdown block.** The agent calls `propose_plan(steps: PlanStep[])`. The chat UI intercepts this tool call and renders the plan card. The LLM cannot bypass the card by writing markdown — if it wants to plan, it must use the tool.
2. **The card is in-chat, not in a popover.** Renders inline in the conversation thread, takes full available width, sticky-collapses to a summary line when scrolled past.
3. **Three approval modes (user setting):** `'always-ask'` (default), `'auto-approve-low-risk'` (S complexity + non-destructive ops), `'auto-approve-all'` (yolo). Default is `'always-ask'` — match Cursor's safe default.
4. **Per-step approval, not just plan-level.** User can approve all, approve some + skip some, or edit a step's params before approval. Cursor does plan-level only; we go finer because per-step is cheap and prevents "approve the plan, then the agent does step 3 which destroys node_modules" rage.
5. **Steps execute serially by default.** Parallel execution is opt-in at the step level (`canParallelize: true` flag in `PlanStep`). Most refactors are dependent enough that parallel is dangerous — default to safe.
6. **Live status per step:** `pending` → `running` → `done` / `failed` / `skipped` / `vetoed`. Status badge updates in real time as the agent works through the plan.
7. **A failed step pauses execution.** Subsequent steps go to `pending` and the user sees options: retry, skip-and-continue, abort-plan. No silent continue past a failure.
8. **Plan persists with the thread.** Stored on the `chatThreadService` thread state, not in React local state. Survives panel close/reopen, survives reload (because thread state already persists to disk).
9. **Plans are versioned.** If the user edits a step mid-execution or the agent re-plans after a failure, a new plan version is recorded. UI shows version history (collapsed by default).
10. **Plan card uses V3Code dark palette ONLY** — same rule as the agent panel chrome. Do not honor VS Code theme tokens inside the card.
11. **Keyboard-first.** `J`/`K` step navigation when card has focus, `Enter` approves current step, `Esc` collapses card, `Cmd/Ctrl+Enter` approves all. No mouse required.
12. **Tool registration is closed-world.** `propose_plan` is a V3Code built-in tool, not visible to external MCP clients (same moat policy as the CB tools).

---

## Architecture

```
LLM emits: <tool_call name="propose_plan">{ steps: [...] }</tool_call>
            │
            ▼
┌──────────────────────────────────────────────────────────────┐
│  toolsService.ts (existing)                                  │
│    - 'propose_plan' tool handler                             │
│    - Validates PlanStep[] shape                              │
│    - Stores plan in thread state via PlanService             │
│    - Returns "plan proposed, awaiting approval" sentinel     │
│    - LLM loop PAUSES until plan state transitions to         │
│      'executing' or 'rejected'                               │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  PlanService (new, browser)                                  │
│    - State: { plans: Map<threadId, Plan[]> }                 │
│    - Methods: proposePlan, approveStep, approveAll,          │
│               rejectStep, rejectPlan, editStep,              │
│               markStepRunning, markStepDone, markStepFailed  │
│    - Events: onDidChangePlan(threadId)                       │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  PlanCard.tsx (new, react/src2/sidebar-tsx/)                 │
│    - Subscribes to PlanService for current thread            │
│    - Renders numbered steps, status badges, action buttons   │
│    - Inline edit UI for step params                          │
│    - Sticky-collapse on scroll                               │
└──────────────────────────────┬───────────────────────────────┘
                               │ user clicks "Approve"
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Plan executor (in chatThreadService.ts)                     │
│    - When PlanService.getPlan(threadId).status === 'approved'│
│      OR specific steps are approved:                         │
│      → builds a step-specific LLM continuation prompt        │
│      → resumes the LLM loop with "execute step N"            │
│      → ties tool calls during that turn back to step N       │
│      → updates PlanService with status                       │
└──────────────────────────────────────────────────────────────┘
```

---

## File-by-file plan

All paths relative to `vselite/src/vs/workbench/contrib/void/`.

### New files

#### `common/plan/planTypes.ts`
```ts
export type PlanStepKind = 'edit' | 'create' | 'delete' | 'run-command' | 'read' | 'refactor' | 'test' | 'other';
export type PlanStepStatus = 'pending' | 'approved' | 'running' | 'done' | 'failed' | 'skipped' | 'vetoed';
export type StepComplexity = 'S' | 'M' | 'L';

export interface PlanStep {
    id: string;                   // stable across edits/versions
    index: number;                // display order, 1-based
    title: string;                // ≤80 chars, imperative ("Add `notes` table to schema")
    kind: PlanStepKind;
    files: string[];              // workspace-relative paths the step will touch
    rationale: string;            // markdown, 1-3 sentences, why this step
    complexity: StepComplexity;
    canParallelize: boolean;      // if true, can run alongside sibling parallel steps
    dependsOn: string[];          // step ids that must complete first
    params?: Record<string, unknown>;  // free-form, step-kind-specific (e.g. command string for 'run-command')
}

export interface PlanStepRuntime extends PlanStep {
    status: PlanStepStatus;
    startedAt?: number;
    finishedAt?: number;
    error?: string;
    output?: string;              // captured tool output or diff summary
}

export interface Plan {
    id: string;
    threadId: string;
    version: number;              // bumps on re-plan
    createdAt: number;
    status: 'awaiting-approval' | 'partially-approved' | 'executing' | 'paused' | 'done' | 'rejected' | 'failed';
    steps: PlanStepRuntime[];
    summary: string;              // 1-line plan headline
    rejectionReason?: string;
}
```

#### `common/plan/planService.ts` + `IPlanService` interface
Browser-side service. Owns `Map<threadId, Plan[]>`. All state changes go through it; emits `onDidChangePlan(threadId)` after every mutation. Persists to the existing thread storage layer (piggyback on `chatThreadService` persistence — don't invent a new storage backend).

Methods:
- `proposePlan(threadId: string, steps: PlanStep[], summary: string): Plan`
- `getCurrentPlan(threadId: string): Plan | undefined`
- `getPlanHistory(threadId: string): Plan[]`
- `approveStep(threadId: string, stepId: string): void`
- `approveAll(threadId: string): void`
- `rejectStep(threadId: string, stepId: string, reason?: string): void`
- `rejectPlan(threadId: string, reason?: string): void`
- `editStep(threadId: string, stepId: string, patch: Partial<PlanStep>): void` — bumps plan version
- `markStepRunning(threadId: string, stepId: string): void`
- `markStepDone(threadId: string, stepId: string, output?: string): void`
- `markStepFailed(threadId: string, stepId: string, error: string): void`
- `onDidChangePlan: Event<string>` (threadId)

#### `browser/plan/planExecutor.ts`
The executor lives separately from the service to keep PlanService pure-state. Subscribes to `onDidChangePlan`. When status transitions to `'executing'` or an individual step transitions to `'approved'`:
- Builds the next-step prompt: original user message + plan summary + completed steps + "EXECUTE STEP N: {step.title}\nFiles: {step.files}\nRationale: {step.rationale}"
- Calls into `chatThreadService` to resume the LLM loop with that prompt
- Tags tool calls during that turn with `stepId` so per-step output is captured
- On step completion, transitions next pending step to `'approved'` (if mode is `auto-approve-low-risk` and step qualifies) or back to `'awaiting-approval'`

#### `react/src2/sidebar-tsx/PlanCard.tsx`
Renders the current plan for the active thread. Subscribes via the existing `useService(IPlanService)` pattern Void uses for service consumption from React.

Layout (top to bottom):
```
┌─────────────────────────────────────────────────────────┐
│ 📋 Plan · v2 · 6 steps · 2 done · 1 running             │
│                                          [⚙️] [✕]       │
├─────────────────────────────────────────────────────────┤
│ ▼ Add `notes` table to schema                       [S] │
│   ✓ Done · migration.ts                                 │
├─────────────────────────────────────────────────────────┤
│ ▼ Implement NotesService.upsert                     [M] │
│   ⟳ Running · notesService.ts                           │
├─────────────────────────────────────────────────────────┤
│ ▶ Wire NotesService into toolsService                [S]│
│   Pending · toolsService.ts                             │
│   [Approve] [Edit] [Skip] [Reject]                      │
├─────────────────────────────────────────────────────────┤
│ ▶ Add 3 unit tests                                  [S] │
│   Pending · notesService.test.ts                        │
├─────────────────────────────────────────────────────────┤
│ ▶ Update AGENTS.md Recent Changes                   [S] │
│   Pending · AGENTS.md                                   │
└─────────────────────────────────────────────────────────┘
                            [Approve all remaining]
                            [Reject plan]
```

Per-step expanded view shows: rationale (markdown), `dependsOn` list, complexity badge, files badges (clickable → open file), per-step output once executed (collapsible, default-collapsed).

Sticky-collapse: when scrolled past, card collapses to the title bar (`📋 Plan · v2 · 6 steps · 2 done · 1 running`) and remains visible at top of chat scroll region.

#### `react/src2/sidebar-tsx/PlanCard.css`
Branded styles. Reuses V3Code palette CSS variables already in `styles.css` (`--v3-bg-1`, `--v3-amethyst`, `--v3-venom`, `--v3-text`, `--v3-muted`). Status badge colors:
- `pending` — `--v3-muted`
- `running` — amethyst + pulse animation
- `done` — venom
- `failed` — red (`#FF6B6B`)
- `skipped` / `vetoed` — `--v3-muted` with strikethrough

#### `browser/plan/planActions.ts`
Keyboard shortcuts + command palette entries:
- `v3code.plan.approveCurrent` (Enter when card focused)
- `v3code.plan.approveAll` (Ctrl/Cmd+Enter)
- `v3code.plan.rejectCurrent` (Cmd/Ctrl+Backspace)
- `v3code.plan.nextStep` (J)
- `v3code.plan.prevStep` (K)
- `v3code.plan.showHistory` (Cmd/Ctrl+Shift+H)
- Command Palette: `V3Code: Show Plan History`, `V3Code: Reject Current Plan`

### Modified files

#### `common/toolsServiceTypes.ts`
Add `'propose_plan'` to the tool name union + define the params type:
```ts
export interface ProposePlanParams {
    summary: string;
    steps: PlanStep[];   // PlanStep imported from common/plan/planTypes
}
```

#### `browser/toolsService.ts`
Register the `'propose_plan'` handler. The handler:
1. Validates the steps array shape (zod-like check — Void already has runtime validation patterns, follow them).
2. Calls `planService.proposePlan(threadId, steps, summary)`.
3. Returns a sentinel result `{ status: 'plan-proposed', planId, awaitingApproval: true }`.
4. The chat loop checks for this sentinel and PAUSES — does not feed the result back to the LLM yet. Resumes when `planService.onDidChangePlan` fires with a status of `'executing'` and feeds back the approved step list.

#### `common/prompt/prompts.ts`
Add `propose_plan` to the Tool Hierarchy section of `V3CODE_AGENT_OS_PROMPT`. New bullet near the top of the Tools section:

> **`propose_plan(summary, steps[])`** — Call this BEFORE making any multi-file change, refactor, or change touching 3+ steps. Each step has: title (imperative), kind, files, rationale, complexity (S/M/L), and dependsOn. After calling, STOP and wait — execution is gated on user approval. Do not call other tools in the same turn. Use it for: any refactor, any plan touching ≥3 files, any "I'll do X then Y then Z" sequence. Do NOT use for: single-file edits, single-tool answers, simple reads.

#### `browser/sidebarPane.ts` and `react/src2/sidebar-tsx/Sidebar.tsx`
Mount `<PlanCard threadId={currentThreadId} />` at the top of the chat thread render, above the message list. Card renders nothing if no plan exists for the current thread.

#### `common/chatThreadServiceTypes.ts`
Add `plans: Plan[]` to the persisted thread state type.

#### `browser/chatThreadService.ts`
- On thread load, hydrate `planService` with the thread's `plans` array.
- On thread save, snapshot the current `planService.getPlanHistory(threadId)` into `plans`.
- Add the plan-executor wiring: hook the executor into the chat loop so it can resume turns with step-specific prompts.

### Settings (configurationRegistry)

Register under `v3code.plan.*`:
- `approvalMode: 'always-ask' | 'auto-approve-low-risk' | 'auto-approve-all'` (default `'always-ask'`)
- `parallelStepsAllowed: boolean` (default `true` — respects per-step `canParallelize` flag; false forces serial regardless)
- `autoExpandRationale: boolean` (default `false` — false = expand on click only)
- `showVersionHistory: boolean` (default `false`)

---

## Approval state machine

```
            propose_plan tool call
                    │
                    ▼
          ┌─────────────────────┐
          │ awaiting-approval   │◄────── user edits a step (version++)
          └──────┬──────────────┘
                 │ user clicks Approve / Approve all
                 ▼
          ┌─────────────────────┐
          │ partially-approved  │ (if some steps approved, some still pending)
          │       or            │
          │ executing           │
          └──────┬──────────────┘
                 │
                 │ executor picks next approved+pending step
                 ▼
          ┌─────────────────────┐
          │ running step N      │
          └──────┬──────────────┘
                 │
        ┌────────┼────────┐
        │        │        │
       done    failed   vetoed
        │        │        │
        │        ▼        │
        │   ┌─────────┐   │
        │   │ paused  │───┘ (user retries / skips / aborts)
        │   └────┬────┘
        │        │
        ▼        ▼
   next step OR done plan OR rejected
```

---

## Step prompt template (executor builds this)

```
You are executing step {N} of {TOTAL} in the approved plan.

PLAN SUMMARY: {plan.summary}

COMPLETED STEPS:
{for each done step: ✓ {title} — {output_summary or 'no output'}}

CURRENT STEP:
Title: {step.title}
Kind: {step.kind}
Files: {step.files joined}
Rationale: {step.rationale}

REMAINING STEPS (do NOT execute these yet):
{for each pending step: ▶ {title}}

Execute ONLY the current step. Use whatever tools you need. When the step is complete, return a brief one-line summary of what changed. Do NOT call propose_plan from within a step.
```

---

## Acceptance criteria

1. **`propose_plan` tool registered** and visible in tool listings (internal only — not exposed to external MCP).
2. **Card renders** in the chat sidebar when a plan exists. Hidden when no plan for the active thread.
3. **Per-step approval** works: clicking Approve on step N transitions only step N, leaves others alone.
4. **Per-step edit** works: opening the edit UI on a pending step lets the user modify title/files/rationale/complexity/params, saves a new plan version, replaces the step in the steps array.
5. **Serial execution** by default: only one step in `running` state at a time.
6. **Parallel execution opt-in**: when two pending steps both have `canParallelize: true` and no dependency on each other, both can be approved and run concurrently.
7. **Failure pauses**: a failed step transitions plan to `'paused'`, subsequent steps stay `pending`, user gets retry/skip/abort UI.
8. **Persistence**: closing and reopening V3Code restores the active plan and its execution state.
9. **Keyboard navigation**: J/K/Enter/Cmd-Enter/Esc all work when card has focus.
10. **Sticky-collapse**: when scrolling past the card, it collapses to a single status line at the top of the chat scroll region.
11. **History view**: previous plan versions for the same thread are viewable via the history command.
12. **Branded palette**: card uses V3Code dark palette only, ignores VS Code theme.
13. **`get_errors` clean** across all new and modified files.
14. **Tests**: at minimum a `planService.test.ts` covering state transitions, version bumping, persistence round-trip.

---

## NOT this sprint (do not build)

- **AI-suggested step edits** ("the agent recommends adjusting this step") — defer to v2
- **Plan templates / saved plans** — defer
- **Multi-thread plan dashboard** — defer
- **Step-level cost estimation** (token forecast per step) — defer, useful later
- **Branching plans** (if-then steps, conditional execution) — defer, likely never
- **External MCP-tool plan-card integration** — closed world only, v1
- **Plan-from-natural-language** ("make me a plan to refactor X" as a separate UI button) — the agent already does this when it calls `propose_plan` in response to user requests; no separate UI needed
- **Streaming step status from a remote agent** — local execution only in v1

---

## Open questions to resolve before coding

1. **`react/src` vs `react/src2`** — both trees still exist per the rebrand-sweep changes notes. Confirm which one is the live render path before placing `PlanCard.tsx`. Recent commits suggest `src2` is the active tree; verify.
2. **Tool-call pause semantics** — how does Void's existing chat loop handle a tool call that returns a sentinel without immediately feeding it back to the LLM? Need to read `chatThreadService.ts` carefully to understand whether the current loop assumes every tool result feeds back instantly. May require small refactor.
3. **Plan persistence** — confirm `chatThreadService` thread state is JSON-serializable with reasonable upper bounds before piling plans into it. Long-running threads with many re-plans could bloat the persisted state.
4. **Service registration timing** — `IPlanService` must be available before `chatThreadService` boots (executor depends on it). Confirm registration order.
5. **Multi-step parallel execution** — when two parallel steps run concurrently, do they share the LLM context or run as independent sub-conversations? Independent sub-conversations is cleaner; needs `chatThreadService` to support multi-turn parallelism. Verify before claiming parallel is shippable in v1 — may have to ship serial-only and add parallel in v1.1.

Resolve these BEFORE writing the first line. Each one could reshape the design.

---

## Build order

1. **Types + service** — `planTypes.ts`, `planService.ts`, `IPlanService` interface. Unit tests covering state transitions, version bumping, event emission.
2. **Persistence wiring** — hook plan state into `chatThreadService` save/load. Round-trip test.
3. **Tool registration** — `propose_plan` handler in `toolsService.ts`. Test: agent calls tool, plan exists in service, sentinel returned.
4. **Card UI** — `PlanCard.tsx` + `PlanCard.css`. Render against synthetic plan data first, no executor wiring.
5. **Approval flow** — wire buttons to service methods. Test in-app manually with a synthetic plan injected.
6. **Executor** — `planExecutor.ts`, hook into chat loop. End-to-end test: agent proposes plan → user approves all → executor walks steps → plan transitions to done.
7. **Failure path** — inject a failing step, confirm pause + retry/skip/abort UI works.
8. **Keyboard navigation + sticky collapse + history view.**
9. **Settings registration + approval modes.**
10. **System prompt update** in `prompts.ts` to teach the LLM when to call `propose_plan`.

---

## What "done" looks like

- User: *"refactor the agent panel service to support a third 'compact' mode"*
- Agent emits `propose_plan` with 5 steps: add type, update state machine, add new editor input variant, update toggle action, update tests.
- Plan card appears at top of chat — purple title bar, 5 steps numbered, each with file targets and complexity badges.
- User reads, edits step 3's files list (adds a file the agent missed), saves edit → plan bumps to v2.
- User clicks "Approve all remaining" → all steps go to `approved` → step 1 starts running → status badge pulses amethyst.
- Step 1 finishes → ✓ venom check → step 2 starts → and so on.
- A step fails (compile error) → card shows red status, plan transitions to `paused`, user gets retry/skip/abort buttons.
- User clicks retry → executor re-runs that step with the failure context → succeeds → plan resumes.
- All 5 steps done → plan transitions to `done` → card collapses to single line: `📋 Plan v2 · 5 steps · ✓ done in 2:14`.
- User can click that collapsed line to expand and review the full history.

That's the screenshot moment. That's what Cursor has that Void doesn't.
