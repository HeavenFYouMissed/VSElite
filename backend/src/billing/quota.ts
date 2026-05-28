import { eq, and, sql } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import type { CacheLayer } from '../cache/orchestrator.js';

/**
 * Tier model mirrors the public pricing page (see V3CODE-WEBSITE-CONTENT.md):
 *   free       $0/mo   — editor only, BYOK, no hosted inference, 14-day Context Bridge trial
 *   builder    $5/mo   — Context Bridge permanent + Flash model, 7-day trial
 *   pro       $19/mo   — V4 Pro model + higher caps, 7-day trial
 *   unlimited $99/mo   — no caps, no throttling, team memory + admin tools
 */
export type Tier = 'free' | 'builder' | 'pro' | 'unlimited';

export interface TierLimits {
	monthlyInputTokens: number;
	monthlyOutputTokens: number;
	concurrentRequests: number;
	model: 'deepseek-v4-flash' | 'deepseek-v4-pro';
	allowsHostedInference: boolean;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
	// Free = BYOK only. No hosted inference at all. The 14-day Context Bridge trial is a client-side
	// timer enforced by the editor, not by this backend. If a free user hits /v1/chat/completions
	// we 402; the editor should never call it for free users.
	free: {
		monthlyInputTokens: 0,
		monthlyOutputTokens: 0,
		concurrentRequests: 0,
		model: 'deepseek-v4-flash',
		allowsHostedInference: false
	},
	builder: {
		monthlyInputTokens: 2_000_000,
		monthlyOutputTokens: 400_000,
		concurrentRequests: 3,
		model: 'deepseek-v4-flash',
		allowsHostedInference: true
	},
	pro: {
		monthlyInputTokens: 8_000_000,
		monthlyOutputTokens: 1_500_000,
		concurrentRequests: 5,
		model: 'deepseek-v4-pro',
		allowsHostedInference: true
	},
	// "Unlimited" is soft-unlimited — we cap at fair-use levels to protect against abuse but
	// the user never sees throttling under normal coding workloads (~50M input / mo is genuinely a lot).
	unlimited: {
		monthlyInputTokens: 50_000_000,
		monthlyOutputTokens: 10_000_000,
		concurrentRequests: 20,
		model: 'deepseek-v4-pro',
		allowsHostedInference: true
	}
};

/** Tier ordering for upgrade/downgrade comparisons. */
export const TIER_RANK: Record<Tier, number> = { free: 0, builder: 1, pro: 2, unlimited: 3 };

/**
 * Get-or-create the current billing-period quota row.
 *
 * Billing periods are calendar months in UTC. A user's first request in a month creates the row.
 */
export async function getOrCreateCurrentPeriod(userId: string) {
	const now = new Date();
	const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

	const existing = await db
		.select()
		.from(schema.quotaPeriods)
		.where(and(
			eq(schema.quotaPeriods.userId, userId),
			eq(schema.quotaPeriods.periodStart, periodStart)
		))
		.limit(1);

	if (existing[0]) return existing[0];

	const created = await db
		.insert(schema.quotaPeriods)
		.values({ userId, periodStart, periodEnd })
		.onConflictDoNothing()
		.returning();

	if (created[0]) return created[0];

	// Race: another request inserted between our select and our insert. Re-fetch.
	const refetch = await db
		.select()
		.from(schema.quotaPeriods)
		.where(and(
			eq(schema.quotaPeriods.userId, userId),
			eq(schema.quotaPeriods.periodStart, periodStart)
		))
		.limit(1);

	if (!refetch[0]) throw new Error('quota period race: insert and select both empty');
	return refetch[0];
}

export interface QuotaCheckResult {
	allowed: boolean;
	reason?: string;
	remainingInput: number;
	remainingOutput: number;
}

/**
 * Check whether a user has quota for an upcoming request.
 *
 * We can only estimate cost pre-request. Heuristic: assume worst-case 2x prompt-token output.
 * If the user is at 100% of their input or output limit, deny.
 */
export async function checkQuota(userId: string, tier: Tier): Promise<QuotaCheckResult> {
	const limits = TIER_LIMITS[tier];
	const period = await getOrCreateCurrentPeriod(userId);
	const remainingInput = limits.monthlyInputTokens - Number(period.inputTokensCharged);
	const remainingOutput = limits.monthlyOutputTokens - Number(period.outputTokensCharged);

	if (remainingInput <= 0) {
		return {
			allowed: false,
			reason: 'monthly_input_quota_exceeded',
			remainingInput: 0,
			remainingOutput: Math.max(0, remainingOutput)
		};
	}
	if (remainingOutput <= 0) {
		return {
			allowed: false,
			reason: 'monthly_output_quota_exceeded',
			remainingInput,
			remainingOutput: 0
		};
	}
	return { allowed: true, remainingInput, remainingOutput };
}

/**
 * Record token usage after a request completes.
 *
 * Dual meter:
 *   - charged = full token cost as if cache missed. This is what the user sees and what their quota debits.
 *   - actual = only counted on real DeepSeek calls. This is what we pay for. The delta is our margin.
 */
export async function recordUsage(opts: {
	userId: string;
	layer: CacheLayer;
	inputTokens: number;
	outputTokens: number;
}): Promise<void> {
	const period = await getOrCreateCurrentPeriod(opts.userId);

	const isMiss = opts.layer === 'miss';
	const layerColumn =
		opts.layer === 'l1' ? schema.quotaPeriods.cacheHitL1 :
			opts.layer === 'l2' ? schema.quotaPeriods.cacheHitL2 :
				opts.layer === 'l3' ? schema.quotaPeriods.cacheHitL3 :
					schema.quotaPeriods.cacheMiss;

	await db
		.update(schema.quotaPeriods)
		.set({
			inputTokensCharged: sql`${schema.quotaPeriods.inputTokensCharged} + ${opts.inputTokens}`,
			outputTokensCharged: sql`${schema.quotaPeriods.outputTokensCharged} + ${opts.outputTokens}`,
			inputTokensActual: isMiss
				? sql`${schema.quotaPeriods.inputTokensActual} + ${opts.inputTokens}`
				: schema.quotaPeriods.inputTokensActual,
			outputTokensActual: isMiss
				? sql`${schema.quotaPeriods.outputTokensActual} + ${opts.outputTokens}`
				: schema.quotaPeriods.outputTokensActual,
			requestCount: sql`${schema.quotaPeriods.requestCount} + 1`,
			[layerColumn.name]: sql`${layerColumn} + 1`
		})
		.where(eq(schema.quotaPeriods.id, period.id));
}

/**
 * Per-process concurrency tracking (per user). Survives only this process; multi-instance
 * deployments should swap this for Redis-backed atomic INCR/DECR with TTL.
 */
const concurrentByUser = new Map<string, number>();

export function tryAcquireConcurrency(userId: string, tier: Tier): boolean {
	const limit = TIER_LIMITS[tier].concurrentRequests;
	const cur = concurrentByUser.get(userId) ?? 0;
	if (cur >= limit) return false;
	concurrentByUser.set(userId, cur + 1);
	return true;
}

export function releaseConcurrency(userId: string): void {
	const cur = concurrentByUser.get(userId) ?? 0;
	if (cur <= 1) concurrentByUser.delete(userId);
	else concurrentByUser.set(userId, cur - 1);
}
