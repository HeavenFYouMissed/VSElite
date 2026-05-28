import { sql } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { embed } from './embeddings.js';
import { l2EmbedInput, toolSignature, type CanonicalRequest, type ChatMessage } from './canonical.js';
import { loadConfig } from '../config.js';

const cfg = loadConfig();

export interface L2HitResult {
	hit: true;
	response: unknown;
	inputTokens: number;
	outputTokens: number;
	cacheId: string;
	similarity: number;
}

export interface L2MissResult {
	hit: false;
	embedding: number[];
	toolSig: string | null;
}

export type L2Result = L2HitResult | L2MissResult;

/**
 * Look up a semantic match in L2 cache (per-user, pgvector cosine similarity).
 *
 * Hit conditions (ALL must hold):
 *   - same user
 *   - same model
 *   - same workspaceFingerprint (or both null)
 *   - same toolSignature (or both null)
 *   - cosine similarity >= CACHE_L2_COSINE_THRESHOLD (default 0.93)
 *   - not expired
 */
export async function l2Lookup(opts: {
	userId: string;
	req: CanonicalRequest;
	workspaceFingerprint: string | null;
}): Promise<L2Result> {
	const embedInput = l2EmbedInput(opts.req.messages as ChatMessage[]);
	const queryVec = await embed(embedInput);
	const toolSig = toolSignature(opts.req);

	// pgvector cosine distance = 1 - cosine similarity. Compare distance <= 1 - threshold.
	const maxDistance = 1 - cfg.CACHE_L2_COSINE_THRESHOLD;
	const vecLiteral = `[${queryVec.join(',')}]`;

	// HNSW index is used when ORDER BY embedding <=> $1 LIMIT N. Filters applied post-index-scan
	// via WHERE — for small per-user partitions this is fast even without partial indexes.
	const rows = await db.execute<{
		id: string;
		response: unknown;
		input_tokens: number;
		output_tokens: number;
		distance: number;
	}>(sql`
		SELECT id, response, input_tokens, output_tokens, embedding <=> ${vecLiteral}::vector AS distance
		FROM cache_l2
		WHERE user_id = ${opts.userId}::uuid
			AND model = ${opts.req.model}
			AND expires_at > NOW()
			AND (workspace_fingerprint IS NOT DISTINCT FROM ${opts.workspaceFingerprint})
			AND (tool_signature IS NOT DISTINCT FROM ${toolSig})
		ORDER BY embedding <=> ${vecLiteral}::vector
		LIMIT 1
	`);

	const row = (rows as unknown as Array<{ id: string; response: unknown; input_tokens: number; output_tokens: number; distance: number }>)[0];
	if (!row) return { hit: false, embedding: queryVec, toolSig };
	if (row.distance > maxDistance) return { hit: false, embedding: queryVec, toolSig };

	const similarity = 1 - Number(row.distance);

	// Best-effort hit counter bump.
	void db.execute(sql`
		UPDATE cache_l2 SET hit_count = hit_count + 1, last_hit_at = NOW() WHERE id = ${row.id}::uuid
	`).catch(() => { /* counters are best-effort */ });

	return {
		hit: true,
		response: row.response,
		inputTokens: row.input_tokens,
		outputTokens: row.output_tokens,
		cacheId: row.id,
		similarity
	};
}

export async function l2Write(opts: {
	userId: string;
	model: string;
	embedding: number[];
	messages: ChatMessage[];
	response: unknown;
	inputTokens: number;
	outputTokens: number;
	workspaceFingerprint: string | null;
	toolSig: string | null;
}): Promise<void> {
	const expiresAt = new Date(Date.now() + cfg.CACHE_L1_TTL_SECONDS * 1000);
	await db.insert(schema.cacheL2).values({
		userId: opts.userId,
		model: opts.model,
		workspaceFingerprint: opts.workspaceFingerprint,
		toolSignature: opts.toolSig,
		embedding: opts.embedding,
		messages: opts.messages as unknown as object,
		response: opts.response as object,
		inputTokens: opts.inputTokens,
		outputTokens: opts.outputTokens,
		expiresAt
	});
}
