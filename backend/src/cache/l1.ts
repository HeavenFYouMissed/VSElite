import { eq, and, lt, sql } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { l1CacheKey, type CanonicalRequest } from './canonical.js';
import { loadConfig } from '../config.js';

const cfg = loadConfig();

export interface L1HitResult {
	hit: true;
	response: unknown;
	inputTokens: number;
	outputTokens: number;
	cacheId: string;
}

export interface L1MissResult {
	hit: false;
	cacheKey: string;
}

export type L1Result = L1HitResult | L1MissResult;

/**
 * Look up an exact match in L1 cache.
 *
 * Returns the cached response (OpenAI-format) if found, else a miss with the cache key
 * to be used for the subsequent write.
 */
export async function l1Lookup(opts: {
	userId: string;
	upstreamUserId: string;
	req: CanonicalRequest;
}): Promise<L1Result> {
	const key = l1CacheKey(opts.upstreamUserId, opts.req);

	const rows = await db
		.select({
			id: schema.cacheL1.id,
			response: schema.cacheL1.response,
			inputTokens: schema.cacheL1.inputTokens,
			outputTokens: schema.cacheL1.outputTokens,
			expiresAt: schema.cacheL1.expiresAt
		})
		.from(schema.cacheL1)
		.where(and(
			eq(schema.cacheL1.id, key),
			eq(schema.cacheL1.userId, opts.userId)
		))
		.limit(1);

	const row = rows[0];
	if (!row) return { hit: false, cacheKey: key };

	// Expired? Treat as miss; eviction job will GC.
	if (row.expiresAt.getTime() <= Date.now()) {
		return { hit: false, cacheKey: key };
	}

	// Fire-and-forget hit counter bump. Don't block the response.
	void db
		.update(schema.cacheL1)
		.set({
			hitCount: sql`${schema.cacheL1.hitCount} + 1`,
			lastHitAt: new Date()
		})
		.where(eq(schema.cacheL1.id, key))
		.catch(() => { /* swallow — counters are best-effort */ });

	return {
		hit: true,
		response: row.response,
		inputTokens: row.inputTokens,
		outputTokens: row.outputTokens,
		cacheId: row.id
	};
}

/**
 * Write an L1 entry. Idempotent via PK conflict — duplicate writes are silent no-ops.
 */
export async function l1Write(opts: {
	cacheKey: string;
	userId: string;
	model: string;
	response: unknown;
	inputTokens: number;
	outputTokens: number;
}): Promise<void> {
	const byteSize = JSON.stringify(opts.response).length;
	const expiresAt = new Date(Date.now() + cfg.CACHE_L1_TTL_SECONDS * 1000);

	await db
		.insert(schema.cacheL1)
		.values({
			id: opts.cacheKey,
			userId: opts.userId,
			model: opts.model,
			response: opts.response as object,
			inputTokens: opts.inputTokens,
			outputTokens: opts.outputTokens,
			byteSize,
			expiresAt
		})
		.onConflictDoNothing();
}

/**
 * GC expired entries and enforce per-user byte cap (LRU eviction by lastHitAt).
 *
 * Called by a background job, not on the hot path. Returns rows deleted.
 */
export async function l1Gc(): Promise<{ expired: number; evicted: number }> {
	const expired = await db
		.delete(schema.cacheL1)
		.where(lt(schema.cacheL1.expiresAt, new Date()))
		.returning({ id: schema.cacheL1.id });

	// LRU eviction per user when over byte cap.
	// Cheap implementation: select users over cap, delete oldest until under cap.
	const overCap = await db.execute<{ user_id: string; total_bytes: number }>(sql`
		SELECT user_id, SUM(byte_size)::bigint AS total_bytes
		FROM cache_l1
		GROUP BY user_id
		HAVING SUM(byte_size) > ${cfg.CACHE_L1_MAX_BYTES_PER_USER}
	`);

	let evictedCount = 0;
	for (const row of overCap as unknown as Array<{ user_id: string; total_bytes: number }>) {
		let toEvict = Number(row.total_bytes) - cfg.CACHE_L1_MAX_BYTES_PER_USER;
		const candidates = await db
			.select({ id: schema.cacheL1.id, byteSize: schema.cacheL1.byteSize })
			.from(schema.cacheL1)
			.where(eq(schema.cacheL1.userId, row.user_id))
			.orderBy(schema.cacheL1.lastHitAt)
			.limit(1000);

		const idsToDelete: string[] = [];
		for (const c of candidates) {
			if (toEvict <= 0) break;
			idsToDelete.push(c.id);
			toEvict -= c.byteSize;
		}
		if (idsToDelete.length > 0) {
			await db
				.delete(schema.cacheL1)
				.where(sql`id = ANY(${idsToDelete})`);
			evictedCount += idsToDelete.length;
		}
	}

	return { expired: expired.length, evicted: evictedCount };
}
