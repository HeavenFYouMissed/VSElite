import {
	pgTable,
	uuid,
	text,
	integer,
	bigint,
	timestamp,
	boolean,
	jsonb,
	index,
	uniqueIndex,
	customType
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// pgvector type — Drizzle doesn't ship one yet, so we declare it.
const vector = (name: string, opts: { dimensions: number }) =>
	customType<{ data: number[]; driverData: string }>({
		dataType() {
			return `vector(${opts.dimensions})`;
		},
		toDriver(value: number[]): string {
			return `[${value.join(',')}]`;
		},
		fromDriver(value: string): number[] {
			// Postgres returns vectors as "[1,2,3]" strings.
			return JSON.parse(value);
		}
	})(name);

// =============================================================================
// USERS / SESSIONS / SUBSCRIPTIONS
// =============================================================================

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	githubId: text('github_id').notNull().unique(),
	githubLogin: text('github_login').notNull(),
	email: text('email'),
	avatarUrl: text('avatar_url'),
	tier: text('tier', { enum: ['free', 'builder', 'pro', 'unlimited'] }).notNull().default('free'),
	stripeCustomerId: text('stripe_customer_id'),
	stripeSubscriptionId: text('stripe_subscription_id'),
	subscriptionStatus: text('subscription_status'),
	// Deterministic, anonymized user id passed to DeepSeek as `user_id` for KV cache + scheduling isolation.
	// = sha256(users.id) at signup. Never PII.
	upstreamUserId: text('upstream_user_id').notNull().unique(),
	// Opt-in flag for cross-user L3 cache contribution. Defaults true for Pro tier on signup
	// because the ToS requires it for Pro; users can disable but then must use BYOK.
	l3OptIn: boolean('l3_opt_in').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable('sessions', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	tokenHash: text('token_hash').notNull().unique(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	userAgent: text('user_agent'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => ({
	userIdx: index('sessions_user_idx').on(t.userId)
}));

// Device-code flow (gh auth login pattern) for editor sign-in.
export const deviceCodes = pgTable('device_codes', {
	id: uuid('id').primaryKey().defaultRandom(),
	deviceCode: text('device_code').notNull().unique(),
	userCode: text('user_code').notNull().unique(),
	userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
	status: text('status', { enum: ['pending', 'approved', 'denied', 'expired'] }).notNull().default('pending'),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// =============================================================================
// QUOTAS — billing-period token counters
// =============================================================================

export const quotaPeriods = pgTable('quota_periods', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
	periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
	// "User-facing" counters — charged as if cache missed (full token value).
	inputTokensCharged: bigint('input_tokens_charged', { mode: 'number' }).notNull().default(0),
	outputTokensCharged: bigint('output_tokens_charged', { mode: 'number' }).notNull().default(0),
	// "P&L" counters — only counts real DeepSeek API calls.
	inputTokensActual: bigint('input_tokens_actual', { mode: 'number' }).notNull().default(0),
	outputTokensActual: bigint('output_tokens_actual', { mode: 'number' }).notNull().default(0),
	requestCount: integer('request_count').notNull().default(0),
	cacheHitL1: integer('cache_hit_l1').notNull().default(0),
	cacheHitL2: integer('cache_hit_l2').notNull().default(0),
	cacheHitL3: integer('cache_hit_l3').notNull().default(0),
	cacheMiss: integer('cache_miss').notNull().default(0)
}, t => ({
	userPeriodIdx: uniqueIndex('quota_user_period_idx').on(t.userId, t.periodStart)
}));

// =============================================================================
// L1 — EXACT MATCH CACHE (per-user)
// =============================================================================

export const cacheL1 = pgTable('cache_l1', {
	// Key = sha256(upstreamUserId + canonical(messages) + model + temperature + tool_call_signature).
	id: text('id').primaryKey(),
	userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	model: text('model').notNull(),
	// Serialized OpenAI-format response (message + tool_calls + usage).
	response: jsonb('response').notNull(),
	inputTokens: integer('input_tokens').notNull(),
	outputTokens: integer('output_tokens').notNull(),
	byteSize: integer('byte_size').notNull(),
	hitCount: integer('hit_count').notNull().default(0),
	lastHitAt: timestamp('last_hit_at', { withTimezone: true }).notNull().defaultNow(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => ({
	userExpiresIdx: index('cache_l1_user_expires_idx').on(t.userId, t.expiresAt),
	userLastHitIdx: index('cache_l1_user_lasthit_idx').on(t.userId, t.lastHitAt)
}));

// =============================================================================
// L2 — SEMANTIC CACHE (per-user, pgvector)
// =============================================================================

export const cacheL2 = pgTable('cache_l2', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	model: text('model').notNull(),
	// Workspace fingerprint = sha256 of relevant project anchors (package.json hash, top-level dirs).
	// Same fingerprint required for hit — different workspaces don't share semantic cache.
	workspaceFingerprint: text('workspace_fingerprint'),
	// Tool-call signature = sorted list of tool names if any. null = pure chat.
	toolSignature: text('tool_signature'),
	embedding: vector('embedding', { dimensions: 1536 }).notNull(),
	// The canonical messages used to compute embedding (for debugging / re-embedding).
	messages: jsonb('messages').notNull(),
	response: jsonb('response').notNull(),
	inputTokens: integer('input_tokens').notNull(),
	outputTokens: integer('output_tokens').notNull(),
	hitCount: integer('hit_count').notNull().default(0),
	lastHitAt: timestamp('last_hit_at', { withTimezone: true }).notNull().defaultNow(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => ({
	userIdx: index('cache_l2_user_idx').on(t.userId),
	// HNSW index for cosine similarity — built in migration SQL because Drizzle doesn't model it yet.
	expiresIdx: index('cache_l2_expires_idx').on(t.expiresAt)
}));

// =============================================================================
// L3 — PUBLIC CROSS-USER CACHE (anonymized, opt-in, gated)
// =============================================================================
//
// Lifecycle:
//   1. Candidate inserted with status='quarantine' after L1+L2 miss + classifier pass
//   2. After CACHE_L3_QUARANTINE_HOURS + occurrenceCount >= CACHE_L3_MIN_OCCURRENCES,
//      promoted to status='active' by background job
//   3. Reputation drops below threshold -> status='retired'
//
export const cacheL3 = pgTable('cache_l3', {
	id: uuid('id').primaryKey().defaultRandom(),
	model: text('model').notNull(),
	// Role-tokenized prompt — identifiers replaced with <FUNC>, <IDENT>, <STRING>, etc.
	canonicalPrompt: text('canonical_prompt').notNull(),
	embedding: vector('embedding', { dimensions: 1536 }).notNull(),
	response: jsonb('response').notNull(),
	inputTokens: integer('input_tokens').notNull(),
	outputTokens: integer('output_tokens').notNull(),

	status: text('status', { enum: ['quarantine', 'active', 'retired'] }).notNull().default('quarantine'),
	occurrenceCount: integer('occurrence_count').notNull().default(1),
	thumbsUp: integer('thumbs_up').notNull().default(0),
	thumbsDown: integer('thumbs_down').notNull().default(0),
	hitCount: integer('hit_count').notNull().default(0),

	// Hash of contributing user_id, used to enforce min-N-distinct-contributors rule.
	contributorHashes: jsonb('contributor_hashes').notNull().default(sql`'[]'::jsonb`),

	// Safety classifier scores at insertion time (debug/audit trail).
	classifierScores: jsonb('classifier_scores'),

	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	promotedAt: timestamp('promoted_at', { withTimezone: true }),
	lastHitAt: timestamp('last_hit_at', { withTimezone: true })
}, t => ({
	statusIdx: index('cache_l3_status_idx').on(t.status),
	modelStatusIdx: index('cache_l3_model_status_idx').on(t.model, t.status)
}));

// =============================================================================
// REQUEST LOG — every chat completion, for analytics + abuse detection
// =============================================================================

export const requestLog = pgTable('request_log', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	model: text('model').notNull(),
	cacheLayer: text('cache_layer', { enum: ['l1', 'l2', 'l3', 'miss'] }).notNull(),
	inputTokens: integer('input_tokens').notNull(),
	outputTokens: integer('output_tokens').notNull(),
	latencyMs: integer('latency_ms').notNull(),
	deepseekLatencyMs: integer('deepseek_latency_ms'),
	streamed: boolean('streamed').notNull(),
	status: integer('status').notNull(),
	errorCode: text('error_code'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => ({
	userCreatedIdx: index('request_log_user_created_idx').on(t.userId, t.createdAt),
	createdIdx: index('request_log_created_idx').on(t.createdAt)
}));
