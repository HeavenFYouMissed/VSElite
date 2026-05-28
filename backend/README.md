# V3Code Backend

Hosted AI proxy for V3Code. Wraps DeepSeek behind an OpenAI-compatible chat completions API with a three-layer cache, auth, billing, and quota.

## Architecture (one-screen overview)

```
                            ┌──────────────┐
  V3Code editor ─Bearer──►  │  /v1/chat/   │
                            │  completions │
                            └──────┬───────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
   ┌─────────┐  miss         ┌─────────┐  miss          ┌─────────┐  miss
   │   L1    │ ───────────►  │   L2    │ ────────────►  │   L3    │ ─────►  DeepSeek
   │ exact   │               │ pgvector│                │ public  │         (real $$)
   │ per-user│               │ per-user│                │ shared  │
   └────┬────┘               └────┬────┘                └────┬────┘
        │ hit                     │ hit                      │ hit
        ▼                         ▼                          ▼
                          Promote up + serve
```

* **L1** — exact sha256 match on `(upstreamUserId, canonical(request))`. Sub-20ms. Per-user partition.
* **L2** — pgvector cosine similarity ≥ 0.93. Same user, same model, same workspace, same tool signature.
* **L3** — cross-user anonymized cache. **Interface wired, classifier stubbed. Activated post-launch.** See `src/cache/l3.ts` TODOs.

The DeepSeek client threads `user_id` (= deterministic sha256 of internal user id) for KV cache continuity, per-user 429 isolation, and scheduling isolation.

## Tech stack

* Node 20 + TypeScript (ESM)
* Fastify
* Postgres 16 + pgvector + HNSW index
* Drizzle ORM
* Stripe (Checkout + webhooks)
* GitHub OAuth + device-code flow (mirrors `gh auth login`)
* OpenAI embeddings (`text-embedding-3-small`, 1536d)

## Setup

```bash
# 1. Install
cd vselite/backend
npm install

# 2. Postgres + pgvector
# Easiest local: docker run -d --name v3code-pg -p 5432:5432 \
#   -e POSTGRES_USER=v3code -e POSTGRES_PASSWORD=<dev-secret> -e POSTGRES_DB=v3code \
#   pgvector/pgvector:pg16

# 3. Env
cp .env.example .env
# Fill in DEEPSEEK_API_KEY, EMBEDDINGS_API_KEY, GITHUB_CLIENT_ID/SECRET,
# STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SESSION_SECRET.

# 4. Migrate
npm run db:generate   # generates SQL from schema.ts (first time only)
npm run db:migrate    # applies migrations + pgvector + HNSW indexes

# 5. Run
npm run dev
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat. Supports `stream: true`. Headers: `x-v3c-cache: l1\|l2\|l3\|miss`. |
| `GET` | `/auth/github/start` | Begin web OAuth |
| `GET` | `/auth/github/callback` | OAuth callback |
| `POST` | `/auth/logout` | Revoke session |
| `GET` | `/auth/me` | Current user |
| `POST` | `/auth/device` | Editor: request device code |
| `POST` | `/auth/device/poll` | Editor: poll for approval; returns bearer token on approval |
| `POST` | `/auth/device/approve` | Web: user pastes code + approves |
| `POST` | `/billing/checkout` | Start Stripe Checkout |
| `POST` | `/billing/webhook` | Stripe webhook (raw body required) |
| `GET` | `/billing/usage` | Current month usage + cache stats |
| `GET` | `/health` | Liveness |

## Tier model

| Tier | Price | Model | Input / mo | Output / mo | Concurrent | Trial |
|---|---|---|---:|---:|---:|---|
| free      | $0    | (BYOK only — no hosted inference) | — | — | — | — |
| builder   | $5    | `deepseek-v4-flash` | 2M  | 400K | 3  | 7 days |
| pro       | $19   | `deepseek-v4-pro`   | 8M  | 1.5M | 5  | 7 days |
| unlimited | $99   | `deepseek-v4-pro`   | 50M | 10M  | 20 | — |

Concurrency is enforced in-process; multi-instance deployments must swap to Redis (one-line change in `src/billing/quota.ts`).

## Dual-meter accounting

Per request we track two numbers:

* `inputTokensCharged` / `outputTokensCharged` — what the user sees + their quota debits. Counted on every request including cache hits, because the user got value equivalent to a fresh inference.
* `inputTokensActual` / `outputTokensActual` — only counted on real DeepSeek API calls (cache miss). This is what we pay.

Margin per user = `charged - actual` (in token terms). Cache hit rate ≈ `1 - actual/charged`.

## L3 activation checklist (DO NOT enable in prod until all checked)

* [ ] Implement `classifyShareable()` in `src/cache/l3.ts`. Eval on a labeled set of ≥100 shareable + ≥100 leaks-proprietary prompts. F1 ≥ 0.95 on the leaks-proprietary class.
* [ ] Implement `canonicalizePrompt()` — AST-walk code blocks, replace identifiers with role tokens.
* [ ] Implement promotion job: quarantine → active when `occurrenceCount ≥ CACHE_L3_MIN_OCCURRENCES` AND `now() - createdAt ≥ CACHE_L3_QUARANTINE_HOURS` AND distinct contributors ≥ N.
* [ ] Implement retirement job: `thumbs_down / (thumbs_up + thumbs_down) > 0.2` OR `thumbs_down >= 5`.
* [ ] Audit ToS / Privacy Policy in published-website. ToS cache-consent clause must reference L3 by name and link to per-user opt-out.
* [ ] Flip `CACHE_L3_ENABLED=true`.

See [`V3CODE-WEBSITE-CONTENT.md`](../V3CODE-WEBSITE-CONTENT.md) Part E for the full design.

## What's intentionally not here

* No admin UI. Query Postgres directly until pain justifies one.
* No observability stack beyond pino structured logs. Pipe stdout to Loki/Datadog/CloudWatch when shipping to prod.
* No rate-limit storage beyond per-process. Multi-instance prod must use Redis.
* No background jobs scheduler. Run `l1Gc()` and (later) L3 promotion/retirement via cron or a sidecar.
