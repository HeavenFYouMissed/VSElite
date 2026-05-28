# Trae IDE Recon — What to Steal, What to Skip

Recon doc on **Trae IDE** (ByteDance's VS Code-based AI editor) and **trae-agent** (their open-source CLI agent). Looking for UI patterns, UX choices, and architectural ideas we should pull into VSElite — and confirming what NOT to copy.

Reviewed 2026-05-24. Some Trae IDE details are from public-facing marketing + earlier audit (see [AUDIT-FINDINGS.md](../context-bridge/AUDIT-FINDINGS.md)) since the IDE itself isn't open source. trae-agent CLI is MIT-licensed at github.com/bytedance/trae-agent.

---

## The big picture

**Trae IDE** = closed-source VS Code fork, ByteDance product. Routes through ByteDance infrastructure (5-year data retention policy). Bundles their own model catalog with Gemini 2.5 Pro / Kimi K2 / Grok-4 Beta free, plus DeepSeek V4 as custom provider option. UI is the part worth inspecting.

**trae-agent** = open-source CLI agent loop, separate product. MIT, on GitHub. **No UI**. No code graph. No indexing. Pure LLM agent loop with bash + file edit + sequential-thinking tools. Useful as reference architecture for our own agent loop, not for UI.

**Our Phase 0 verdict** (already established): trae-agent's "internal code graph" marketing claim is flat-text RAG — there is no graph. We built Context Bridge from scratch. That doesn't make trae-agent useless as a recon target; just means we don't extract code from it, we extract *ideas*.

---

## Patterns worth stealing

### 1. **Lakeview** — streaming agent-step summaries

In trae-agent's config (`enable_lakeview: true`), Lakeview generates "short and concise summarisation for agent steps" — mid-loop, while the agent is still working. The user sees a running narrative: *"Reading user-service.ts → calling refactor tool → applied 3 changes → checking lint → done."*

**Why this is good UX:** when an agent loop takes 30-90 seconds, users hate the spinner. A streaming summary keeps them oriented and lets them spot wrong direction early ("wait, why are you reading the test file, that's not what I asked").

**How to port:** in `chatThreadService.ts`, when the agent emits each step (tool call, tool response, internal reasoning), generate a 1-line summary via a small/fast model in parallel and render it in the sidebar as a streaming list. Could be powered by the same model the user picked or by a cheap default (Claude Haiku, DeepSeek Flash, Gemini Flash).

**Cost:** ~50 tokens per step. On a 10-step loop that's 500 cheap-model tokens — fractions of a cent. Worth it for UX.

**Code touch surface in vselite:**
- `browser/chatThreadService.ts` — emit step events
- `browser/react/src/sidebar-tsx/SidebarChat.tsx` — render the streaming summary list
- New service `browser/lakeviewService.ts` or similar — owns the cheap-model calls
- `common/sendLLMMessageService.ts` — already abstracts provider; just call with a different model

**Phase 2 work** (not blocking v0.1). Easy to bolt on once chat is working.

### 2. **Trajectory recording** — JSON log of every agent step

trae-agent records every LLM interaction, agent step, tool call, and metadata as a JSON file per session. The use cases:
- **Debug.** Something went weird → user sends you the trajectory JSON → you replay it without needing their codebase access
- **Eval.** Build a benchmark of past trajectories and re-run them against new model versions
- **Paid feature.** "Session replay" / "agent audit" as a Pro tier feature
- **Training data.** If you ever build your own model, real trajectories are gold (with consent)

**How to port:** `browser/chatThreadService.ts` already has access to every event. Add an opt-in `recordTrajectory` setting. When enabled, write a structured JSON log to `<workspace>/.vselite/trajectories/<session-id>.json`. Each entry: `{step, timestamp, type: "user"|"assistant"|"tool_call"|"tool_response"|"diagnostic", payload}`.

**Privacy note:** trajectories contain user code + AI reasoning + tool inputs/outputs. Default OFF. Easy on/off in settings.

**Phase 2/3 work.** Genuinely valuable. Could be the killer feature for engineers debugging weird agent behavior.

### 3. **Multi-provider config via YAML / JSON**

trae-agent uses YAML for provider config — clean, version-controllable, scriptable. Void already does provider config in TS settings types (`voidSettingsTypes.ts`) — the closed-source pattern is fine. But for **team configurations** (shared model presets across a team), a checked-in `.vselite/team-config.json` could be valuable.

**Phase 3+ work.** Not blocking. Worth adding when teams ask for it.

### 4. **`sequentialthinking` tool**

trae-agent has a built-in "sequentialthinking" tool that lets the agent emit structured reasoning steps. The user sees them rendered as collapsible thought blocks in the chat.

This is the same pattern as Anthropic's "thinking" blocks (Claude API) but exposed as an explicit tool. Useful when you want the agent to plan visibly before acting.

**Already partially solved.** Anthropic models can emit thinking blocks natively; Void already integrates Anthropic. The tool-based abstraction is for providers without native thinking support. Probably skip — overlap with what we already have.

---

## Patterns NOT to copy

### ❌ trae-agent's "internal code graph"

It doesn't exist. Source code grep for `AST`, `code graph`, `symbol indexing` as feature implementations returned zero. The marketing claim is flat-text RAG with branding. We built the actual graph (Context Bridge). Don't waste cycles trying to extract something from trae-agent that isn't there.

### ❌ Trae IDE's data routing

Trae IDE routes through ByteDance infrastructure with 5-year data retention. That's a non-starter for VSElite's positioning. VSElite goes the opposite direction: local-first, BYOK by default, no phone-home (see [REBRAND.md](REBRAND.md) telemetry section).

### ❌ Their model catalog gimmick

Trae IDE bundles "free" access to Gemini 2.5 Pro / Kimi K2 / Grok-4 Beta. That's a customer acquisition trick that costs them money on every user and locks them into provider deals. We don't do this — BYOK is our model, full stop. If someone wants free Gemini, they get a Google API key (free tier exists for Gemini Flash).

### ❌ Their thin context injection

Trae IDE's agent gets almost nothing per turn — just system prompt + env + conversation history. No memory, no file tree, no rules files, no LSP data. That's the gap we're built to close. Don't accidentally regress on this when designing the agent loop.

---

## UI specifics worth observing (from public Trae IDE screenshots)

These are *style observations*, not architectural choices. Worth one round of inspection when designing VSElite's UI.

- **Chat panel placement:** Trae IDE puts chat on the right sidebar (same as Cursor). Void already does this. Keep.
- **Inline diff UI:** Trae IDE has a clean accept/reject diff overlay on edits. Void's `DiffZone`/`DiffArea` system is comparable. Worth comparing once VSElite builds.
- **Agent status indicator:** Trae IDE shows a small avatar / status pill that changes color while the agent is working. Subtle. We could match.
- **Tool result rendering:** Trae IDE renders tool outputs in collapsible cards inside the chat stream. Void does this too via `ChatMarkdownRender.tsx`. Compare and iterate.

---

## Cross-reference with VSElite's roadmap

| Trae idea | Status in VSElite plan | Priority |
|---|---|---|
| Lakeview (streaming summaries) | Not in plan | **Add to Phase 2** post-Task 4 |
| Trajectory recording | Mentioned as optional in [VSELITE-PLAN.md](VSELITE-PLAN.md) "Add" section | **Phase 2/3** — could be paid-tier differentiator |
| YAML provider config | Not in plan | **Defer** (Phase 3+ for teams) |
| sequentialthinking tool | Already covered by Anthropic thinking blocks | **Skip** |
| Multi-model catalog | Anti-pattern for us | **Never do** (BYOK is the model) |
| Cloud data routing | Anti-pattern for us | **Never do** (local-first is the model) |
| Inline diff overlay | Already exists in Void | **Refine post-dogfood** if it sucks |

---

## What we have that Trae doesn't (and should brag about)

Worth keeping this list close — it's marketing copy.

1. **Real structural intelligence** (Context Bridge: LSP-backed call graph, type hierarchy, references — Trae has none of this)
2. **Persistent symbol-attached memory** (our `remember` / `forget` / `list_notes` + auto-injection — Trae has zero memory across sessions)
3. **Token-budgeted Context Packer** (`pack_context` — one bundle replaces 6 tool calls — Trae has no equivalent)
4. **Local-first, BYOK only, no data routing** (vs Trae's 5-year ByteDance retention)
5. **Honest provider catalog** (13+ LLMs, including DeepSeek out of the box, no vendor lock-in)
6. **Self-healing language server reconnect** (a polish detail, but real)
7. **Project-wide auto-preload** (cross-file refs work without manual didOpen — table-stakes that Trae lacks because it has no LSP integration at all)

---

## Recommendations — what to do with this recon

### Adopt now (Phase 2, after rebrand)

1. **Lakeview-style streaming summaries** — biggest UX win per unit of work. Implement after Task 4 (Context Bridge primitives in native tools) so the summaries can describe structural tool calls in plain English.

### Adopt later (Phase 3)

2. **Trajectory recording** — opt-in, written to `.vselite/trajectories/`. Useful for debug + potential paid feature.

### Skip / never

3. trae-agent's "code graph" claim (doesn't exist)
4. Trae IDE's data routing pattern (against our positioning)
5. Bundled "free" model catalog (against BYOK strategy)
6. `sequentialthinking` as separate tool (Claude thinking blocks already cover this)

### Watch for, decide later

7. Trae IDE's chat UI polish — compare screenshot-to-screenshot once VSElite is running. If theirs is meaningfully nicer, port specific patterns.
8. Team / shared config — when users ask for it, not before.

---

*Companion docs at vselite root: [AUDIT-VSELITE.md](AUDIT-VSELITE.md) (codebase map), [VSELITE-PLAN.md](VSELITE-PLAN.md) (build plan), [REBRAND.md](REBRAND.md) (branding decisions), [DEEPSEEK-HANDOFF.md](DEEPSEEK-HANDOFF.md) (DeepSeek's task queue), [AUDIT-FINDINGS.md](../context-bridge/AUDIT-FINDINGS.md) (the original Copilot/Cursor/Trae audit — Trae portion overlaps with this doc).*
