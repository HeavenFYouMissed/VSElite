# V3Code Website — Content & Business Logic Handoff

Companion doc to `V3CODE-WEBSITE-HANDOFF.md` (which covers visuals/ASCII/CSS). This doc covers **what to say**, **how the product is different**, **auth flow**, **pricing/billing logic**, and **the paid AI + caching architecture**.

Use this as the source of truth for marketing copy and the auth/billing implementation on the website + in the editor.

---

## Part A — The Differentiation Story (Marketing Copy)

### A.1 The One-Sentence Pitch

> **V3Code is VS Code with an AI that actually reads your codebase — structurally, semantically, and persistently.**

### A.2 The Three Pillars (use these as landing-page section headers)

#### Pillar 1 — Structural Intelligence (Context Bridge)

**Headline:** *"The AI sees what the language server sees."*

Every other AI editor (Copilot, Cursor, Trae, Windsurf) has access to the Language Server Protocol — the same engine that powers go-to-definition and find-references in VS Code. None of them pipe that data to the AI agent. The agent works **blind**, using `grep` to rediscover what the language server already knows.

V3Code's **Context Bridge** is a proprietary intelligence layer that pipes LSP data — definitions, callers, callees, references, type hierarchies, diagnostics — directly into the agent's context window. One tool call returns the entire structural neighborhood of any symbol.

**Receipt:** Cursor's own AI agent, during a primary-source audit, said: *"Those three things would eliminate 80% of the searching I do."* Context Bridge ships all three, plus seven more.

#### Pillar 2 — Semantic Search That Stays On Your Machine

**Headline:** *"Your code never leaves your laptop."*

- GitHub Copilot has `@workspace` — but it runs in the cloud. Your code is uploaded.
- Cursor charges $20/mo partly to subsidize their hosted index. Your code is uploaded.
- Void (the editor we forked) doesn't have semantic search at all.

V3Code ships a **local-first semantic index** built on `sqlite-vec` + tree-sitter chunking + HyDE query expansion + Reciprocal Rank Fusion. Embeddings run on-device via `transformers.js`. There is no upload. There is no cloud service. The `.v3code/index.db` is yours and it lives in your project folder.

#### Pillar 3 — Persistent Memory (Never Forget)

**Headline:** *"The project that doesn't forget."*

Every other AI agent starts each chat from zero. It re-derives the same gotchas every session. It re-reads the same files. It re-discovers the same architectural decisions.

V3Code's `remember` tool attaches notes to **specific symbols** in your codebase. When any future session asks about that symbol, the note auto-injects. It's institutional memory at the symbol level.

> Example: After debugging an auth bug, the agent calls `remember("handleAuth", "throws if session is null — callers MUST check first")`. Six months later, a different developer asks "why is handleAuth crashing?" — the agent immediately surfaces the note before reading a single line of code.

---

## Part B — Context Bridge: The Proprietary Tech Stack

Use this section to communicate **technical depth** and **moat**. This is what justifies premium pricing.

### B.1 What's Built In (10 native tools, always on)

| Tool | One-liner |
|---|---|
| `get_symbol_context` | Full structural neighborhood of any symbol in one call. |
| `get_file_context` | What's in this file: symbols, imports, diagnostics — without reading the whole thing. |
| `get_call_graph` | Multi-level caller/callee tree with cycle detection. |
| `get_file_dependencies` | What imports this file + what this file imports. |
| `pack_context` | Task-typed context bundles (understand / refactor / debug / extend). |
| `get_project_briefing` | Fresh project state on session start. |
| `remember` / `forget` / `list_notes` | Persistent symbol-attached notes. |
| `find_text` | LSP-aware workspace text search. |
| `semantic_search` | Local embeddings + FTS5 with RRF fusion. |

### B.2 "Never Forget" — The Memory Architecture

Three layers of memory, each persistent across sessions:

1. **Symbol-attached notes** (`.v3code/notes.db`) — `remember(symbol, note)` writes here. Notes auto-inject when the symbol is queried by any future agent session.
2. **Project journal** (`AGENTS.md`) — the agent reads & writes a structured journal: Recent Changes, Session Memory, Open Questions. Survives across sessions and across agents.
3. **Semantic index** (`.v3code/index.db`) — embeddings of every code chunk. Survives restarts; updates incrementally as files change.

### B.3 "Never Forget Files" — The Indexing Architecture

| Capability | How |
|---|---|
| **Always knows where code is** | Tree-sitter parses every file into semantic chunks (functions, classes, methods). Every chunk is embedded and stored in `sqlite-vec`. Semantic queries find the right chunk even when keywords don't match. |
| **Incremental updates** | SHA-256 hash per chunk. On file change: re-hash, re-embed only the chunks that actually changed. 10k-file repo updates in seconds, not minutes. |
| **File watcher built in** | Debounced (2s) `onDidFilesChange` listener. Edit a file → 2s later the index reflects the change. No "rebuild index" button required for normal workflow. |
| **Multi-root aware** | Workspaces with multiple folders are indexed coherently with stable cross-root paths. |
| **Resilient retrieval** | 15s timeout on retrieval keeps the agent loop responsive even if the DB is under load. |
| **Query expansion** | HyDE — a tiny local LLM (Qwen2.5-Coder-0.5B) rewrites your prompt into hypothetical code before search. Finds the right code even when you describe what it *does* not what it's *called*. |
| **Hybrid retrieval** | Vector search + FTS5 lexical search + HyDE channel, merged by Reciprocal Rank Fusion. Exact identifier matches AND semantic matches, ranked together. |

### B.4 What This Means For The User

| User pain | How V3Code fixes it |
|---|---|
| "The AI keeps re-discovering the same gotchas." | `remember` notes auto-inject. |
| "The AI doesn't know that X breaks if I change Y." | `get_call_graph` + `get_file_dependencies` surface impact. |
| "I have to upload my code to use semantic search." | Local index. No upload. Ever. |
| "Cursor costs $20/mo and still uploads my code." | V3Code's index runs on-device, the editor is yours. |
| "The AI keeps reading 20 files when it only needs 2." | `pack_context` returns a token-budgeted structural bundle. |
| "I want my AI to understand multi-language projects." | LSP-backed = works wherever a language server exists. |

---

## Part C — Auth & Login Flow (To Build)

V3Code is local-first, but the **paid features** (cloud DeepSeek v4 Pro, future cloud index, future team features) require an account. Design the simplest possible flow that scales to billing.

### C.1 Identity Model

| Entity | Where it lives | Notes |
|---|---|---|
| **User account** | Backend (Postgres or Supabase) | `user_id`, `email`, `created_at`, `plan_id`, `stripe_customer_id` |
| **API key (V3Code-issued)** | Backend + stored in editor's secret storage | Used by the editor to authenticate to V3Code's hosted DeepSeek proxy. Rotatable. |
| **BYOK provider keys** | User's machine only (VS Code secret storage) | Anthropic/OpenAI/etc. — never leaves device. No backend involvement. |
| **Subscription state** | Stripe (source of truth) + cached on backend | Webhook from Stripe updates `plan_id`, `quota_remaining`. |

### C.2 Sign-up Flow (recommended)

```
1. Website: user clicks "Get V3Code Pro"
2. Email + password (or magic link, or GitHub OAuth — pick one for v1, GitHub OAuth recommended)
3. Stripe Checkout — pick plan (see Part D)
4. On success → backend creates user, generates v3code_api_key
5. Email user the download link + a one-click "open in V3Code" link that contains the api_key
6. Editor first launch: prompts for api_key OR accepts deep link → stores in secret storage
7. Editor verifies key against /v1/auth/verify → caches plan + quota
```

### C.3 In-Editor Sign-in Flow

For users who download V3Code first:

```
1. Open V3Code → no api_key present
2. Sidebar shows "Sign in to unlock V3Code Pro features"
3. Click → opens v3code.dev/auth/device-code
4. User enters device code → completes auth on website
5. Editor polls /v1/auth/device-code/poll → receives api_key
6. Stored in secret storage. Done.
```

This is the GitHub Copilot / `gh auth login` pattern. Standard, well-understood.

### C.4 Required Backend Endpoints (minimum v1)

| Endpoint | Purpose |
|---|---|
| `POST /v1/auth/signup` | Create user (via Stripe Checkout success webhook). |
| `POST /v1/auth/device-code` | Issue device code for editor sign-in. |
| `POST /v1/auth/device-code/poll` | Editor polls; returns api_key on success. |
| `GET /v1/auth/verify` | Editor calls with api_key; returns plan + quota. |
| `POST /v1/billing/checkout` | Start Stripe Checkout session. |
| `POST /v1/billing/portal` | Open Stripe billing portal (user manages plan). |
| `POST /v1/billing/webhook` | Stripe → us. Updates subscription state. |
| `POST /v1/ai/chat` | The proxied DeepSeek v4 Pro endpoint (see Part E). |
| `GET /v1/usage` | Editor queries current usage / quota. |

### C.5 In-Editor UX For Plans

- Status bar item showing current plan + remaining quota: `V3Code Pro · 80% quota left`
- Settings panel: link to billing portal, ability to sign out, ability to rotate api_key
- Hard quota wall: when quota hits 0, the cloud DeepSeek option is disabled but BYOK providers and local features keep working — never break the editor over billing.

---

## Part D — Pricing Tiers

Use this as the website pricing page structure. **All tiers include the full editor with all local features** — Context Bridge, local semantic indexing, persistent memory, BYOK to any provider. The paid tiers add hosted services on top.

### D.1 The Tiers

#### **V3Code Free**
- The full editor, downloaded as binary
- All 10 Context Bridge tools
- Local semantic indexing (unlimited workspace size)
- Persistent symbol memory
- BYOK — bring your own keys for any of 13+ providers (Anthropic, OpenAI, DeepSeek direct, OpenRouter, Gemini, Groq, Ollama, LM Studio, etc.)
- All local AI features work offline
- **$0 / forever**

#### **V3Code Pro** *(the main commercial tier)*
- Everything in Free, plus:
- **Hosted DeepSeek v4 Pro** — no need to manage your own API key. Included quota: **see Part E for token economics**.
- Premium support (email, 48h SLA)
- Priority access to new structural intelligence tools
- Cloud sync for symbol notes (opt-in)
- **$20/mo** *(matches Cursor's anchor price; users get more for the same dollar)*

#### **V3Code Team** *(future, year-2)*
- Everything in Pro, plus:
- Shared symbol notes across the team
- Shared persistent memory (team-wide institutional knowledge)
- SSO (Google Workspace, Microsoft Entra, Okta)
- Admin dashboard, seat management
- **$30/seat/mo** *(market standard for dev tools)*

#### **V3Code Enterprise** *(future)*
- Everything in Team, plus:
- Self-hosted DeepSeek proxy (your own GPU or your own DeepSeek contract)
- SOC 2, custom DPA
- Dedicated support
- **Custom pricing — "Contact us"**

### D.2 What's Paid vs Free (quick reference)

| Feature | Free | Pro | Team |
|---|:---:|:---:|:---:|
| Editor binary | ✅ | ✅ | ✅ |
| All 10 Context Bridge tools | ✅ | ✅ | ✅ |
| Local semantic indexing | ✅ | ✅ | ✅ |
| Persistent symbol memory (local) | ✅ | ✅ | ✅ |
| BYOK to any provider | ✅ | ✅ | ✅ |
| **Hosted DeepSeek v4 Pro (no key needed)** | ❌ | ✅ | ✅ |
| **Cloud-cached AI responses (cheaper inference)** | ❌ | ✅ | ✅ |
| Cloud sync of symbol notes | ❌ | ✅ | ✅ |
| Shared team memory | ❌ | ❌ | ✅ |
| SSO + admin controls | ❌ | ❌ | ✅ |
| SLA + premium support | ❌ | Email | Email + Slack |

### D.3 Why The Free Tier Is Generous

The bet: the editor itself is the product. Power users will pay for hosted DeepSeek v4 Pro because their own API costs would exceed $20/mo anyway, and the in-editor experience is smoother. BYOK users get the full editor — they pay nothing, but they're also our advocates and word-of-mouth engine.

---

## Part E — Paid AI: DeepSeek v4 Pro + Caching Economics

This is the core business logic that needs to be built into the editor + backend.

### E.1 The Model & Cost Structure

- **Model:** DeepSeek v4 Pro
- **Pricing we pay (per million tokens):**
  - Input: **$20 / 1M tokens**
  - Output: **$80 / 1M tokens**
- **Pricing we charge:** included in $20/mo Pro tier, capped by quota (see E.4)

### E.2 Why Caching Is Existential

At $20-in / $80-out, a single heavy user could easily burn $20 of inference in a few days of agent loops. Without caching, the unit economics break.

The solution: **a shared, public, opt-in response cache.** Every Pro user agrees at sign-up that their prompts and completions are cached and may be served (anonymized) to other Pro users with semantically-equivalent queries. This:

1. Drops our marginal inference cost dramatically (cache hit = $0)
2. Makes responses faster (sub-100ms vs multi-second LLM call)
3. Gets better over time — the more users, the bigger the cache, the better the hit rate
4. Lets us keep the $20/mo price point without burning capital

### E.3 The Caching Architecture (to build)

```
User in editor → chat message → V3Code editor
   ↓
   Editor sends to /v1/ai/chat with: { messages, workspace_fingerprint?, opt_in: true }
   ↓
Backend (V3Code proxy)
   ↓
   1. Hash the conversation (semantic hash, not exact) → cache_key
   2. Look up cache_key in cache store (Redis or Postgres)
      ↓ HIT → return cached response, log usage (cache_hit=true), no inference cost
      ↓ MISS → continue
   3. Call DeepSeek v4 Pro API
   4. Stream response back to editor
   5. After completion, store { cache_key, completion, anonymized_prompt } in cache
   6. Log usage (cache_hit=false), bill the input+output cost to our metering
```

### E.4 Quota Model

The simplest model that scales:

| Plan | Included monthly tokens | Overage |
|---|---|---|
| Pro $20/mo | **5M input + 1M output** *(roughly: ~30 hours of heavy agent use)* | Hard cap at quota → BYOK fallback offered. No surprise bills. |

After cache savings, our expected blended cost per Pro user is closer to $4–8/mo at full utilization, so $20/mo has healthy margin even with the cap.

Numbers are starting estimates — instrument from day 1 and tune monthly.

### E.5 Required UX (Editor Side)

**On first sign-up (consent flow):**

> *"V3Code Pro uses a shared response cache to keep costs low for everyone. By signing up, you agree that your prompts and completions may be anonymized and cached for the benefit of all Pro users. You can opt out at any time, but cached responses are a core part of the Pro tier — opting out means BYOK only."*

Checkboxes:
- ☐ I agree to the shared response cache *(required for Pro)*
- ☐ I agree to the V3Code ToS + Privacy Policy *(required)*

**Status bar:**
- `V3Code Pro · 4.2M / 5M tokens · cached hits: 38%` *(shows cache savings → reinforces "this is working for me")*

**Cache hit indicator in chat:**
- Tiny ⚡ icon next to assistant messages that were served from cache. Builds trust.

### E.6 Privacy & Anonymization

Before caching, the backend must strip:
- File paths
- Identifier names that look like proprietary symbols (heuristic: not in any public package)
- Inline secrets (regex strip of API key patterns, JWT patterns, etc.)
- Workspace fingerprints

Cached prompts that match a user's *own* workspace fingerprint are served first (private cache). Cross-user cache hits require the conversation to be sufficiently generic — measured by an embedding-similarity threshold against the canonical-form cached prompt.

This is the same model that anthropic-cache-and-replay services use; pattern is well-understood.

### E.7 Legal — The ToS Clause (draft language for the lawyer)

> *"By subscribing to V3Code Pro or higher, you grant V3Code (KandD Labs) a non-exclusive, royalty-free license to store, anonymize, and reuse the prompts and AI-generated responses you submit through the hosted AI service, solely for the purpose of operating the V3Code shared response cache. You retain all rights to your code. V3Code does not store source files; only the chat-level prompt/response pairs you explicitly send to the hosted AI service are cached. You may request deletion of your cached entries at any time via the billing portal."*

Get a lawyer to review before launch. This is the load-bearing clause.

---

## Part F — Build Order For The Auth/Billing/Caching System

This is the recommended sequencing. Each step is independently shippable.

1. **Stripe + Checkout** — pick a plan, take money, create user. (1 week)
2. **API key issuance + editor sign-in (device code flow)** — get the editor authenticated. (1 week)
3. **Hosted DeepSeek proxy (no cache yet)** — `/v1/ai/chat` proxies to DeepSeek and meters tokens. Validate the loop end-to-end. (1 week)
4. **Quota enforcement + status bar UX** — hard cap at quota, surface usage in editor. (3 days)
5. **Response cache (private only)** — same user's queries hit their own cache first. Easy win, low risk. (1 week)
6. **Shared/public cache + anonymization** — the big one. Build the embedding-similarity gate, the anonymization pipeline, the cross-user cache. (2-3 weeks)
7. **Billing portal + plan changes** — Stripe customer portal hand-off. (2 days)
8. **Team tier scaffolding** — defer to year-2 unless demand surfaces.

---

## Part G — What To Put On The Website (Page Map)

| Page | Sections |
|---|---|
| `/` (Landing) | Hero (ASCII art per Part 1 of `V3CODE-WEBSITE-HANDOFF.md`), three pillars (Part A.2), comparison table (Part 6 of the existing handoff doc), CTA → Pricing |
| `/features` | Deep dive on Context Bridge tools (Part B), with one animated demo per pillar |
| `/pricing` | The four tiers (Part D), with a feature matrix and a calculator showing "your DeepSeek usage at API price vs Pro tier" |
| `/docs` | Quickstart, indexing explained, BYOK setup, signing in, FAQ on caching |
| `/privacy` | The local-first guarantee + the explicit caching disclosure for Pro |
| `/terms` | Full ToS with the cache-license clause from E.7 |
| `/signin` & `/auth/device-code` | The auth flow endpoints (Part C.3) |
| `/billing` | Logged-in dashboard: plan, usage, billing portal link, sign-out, api_key rotation |

---

## Part H — Marketing One-liners (steal these for the site)

- *"VS Code with an AI that actually reads your codebase."*
- *"Structural code intelligence, wired in."*
- *"The editor whose AI never forgets."*
- *"Your code stays on your machine. The AI gets the context anyway."*
- *"Cursor charges $20/mo and uploads your code. We charge $20/mo and don't."*
- *"Persistent memory at the symbol level. Notes that survive your next chat session, your next IDE restart, your next team member."*
- *"10 native structural intelligence tools. No MCP setup. No external servers. It just works."*

---

## Part I — Open Decisions (you need to make these before launch)

1. **Auth provider:** GitHub OAuth (recommended — devs already have GitHub) vs email/magic link vs both?
2. **Backend stack:** Supabase (fast to ship, includes auth + Postgres + Stripe-ish integrations) vs roll-your-own Node + Postgres?
3. **Cache store:** Redis (fast, ephemeral-friendly) vs Postgres (one DB to operate)?
4. **Quota numbers:** Validate the 5M input / 1M output figure with a week of dogfooding before publishing it.
5. **Free tier limits:** Should there be ANY cap on the free tier (e.g., max workspace size for local indexing)? Recommendation: **no cap**. Free is free, paid is paid.
6. **DeepSeek v4 Pro reliability:** Have a fallback model wired in (DeepSeek v4 standard, or Claude Haiku) in case the primary endpoint is down — Pro users should never see a service outage.

---

*Generated for V3Code website build, May 26, 2026. Pair with `V3CODE-WEBSITE-HANDOFF.md` (visual/design) and `SEMANTIC-INDEXING-SPEC.md` (technical detail for engineering).*
