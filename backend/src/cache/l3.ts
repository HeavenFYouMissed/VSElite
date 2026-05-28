/**
 * L3 — public cross-user cache.
 *
 * STATUS: INTERFACE-ONLY. Lookup always returns miss; writes are no-ops.
 *
 * Flip CACHE_L3_ENABLED=true in env to activate (post-launch). When you do, the following
 * pieces must be implemented BEFORE flipping the flag:
 *
 *   1. classifyShareable(req, response) -> { safe: boolean, scores: {...} }
 *      - Detects: secrets, file contents, proprietary identifiers, PII, business logic.
 *      - Trained on a hand-labeled set of >=100 shareable + >=100 leaks-proprietary prompts.
 *      - See AGENTS.md "L3 classifier eval methodology" before implementing.
 *
 *   2. canonicalizePrompt(req) -> string
 *      - Replaces identifiers with <FUNC>, <IDENT>, <STRING>, <PATH>.
 *      - Uses TS-morph / tree-sitter to AST-walk code blocks in messages.
 *
 *   3. Background promotion job:
 *      - Promotes quarantine -> active when:
 *        - createdAt < NOW() - CACHE_L3_QUARANTINE_HOURS
 *        - occurrence_count >= CACHE_L3_MIN_OCCURRENCES
 *        - distinct contributor_hashes >= CACHE_L3_MIN_OCCURRENCES
 *      - Retires entries with thumbs_down > thumbs_up * 0.2 OR thumbs_down >= 5.
 *
 *   4. Per-user opt-in gate (users.l3OptIn). Hard-required by ToS section X.Y.
 *
 *   5. Per-request opt-out gate. If req.metadata.no_l3 === true, skip L3 lookup and write.
 */

import { loadConfig } from '../config.js';
import type { CanonicalRequest, ChatMessage } from './canonical.js';

const cfg = loadConfig();

export interface L3HitResult {
	hit: true;
	response: unknown;
	inputTokens: number;
	outputTokens: number;
	cacheId: string;
	similarity: number;
}

export interface L3MissResult {
	hit: false;
}

export type L3Result = L3HitResult | L3MissResult;

/**
 * Look up an active L3 entry. Currently always returns miss.
 *
 * TODO(post-launch): implement when classifier + canonicalizer + promotion job ready.
 */
export async function l3Lookup(_opts: {
	req: CanonicalRequest;
	userL3OptIn: boolean;
	requestOptOut: boolean;
}): Promise<L3Result> {
	if (!cfg.CACHE_L3_ENABLED) return { hit: false };
	// Future:
	//   if (!opts.userL3OptIn || opts.requestOptOut) return { hit: false };
	//   const canonical = canonicalizePrompt(opts.req);
	//   const vec = await embed(canonical);
	//   const row = await pgvectorLookup(vec, status='active', cosine >= L3_THRESHOLD);
	//   ...
	return { hit: false };
}

/**
 * Submit a candidate to L3. Currently a no-op.
 *
 * TODO(post-launch): classify, canonicalize, embed, upsert into quarantine.
 */
export async function l3Submit(_opts: {
	userUpstreamId: string;
	userL3OptIn: boolean;
	req: CanonicalRequest;
	response: unknown;
	inputTokens: number;
	outputTokens: number;
}): Promise<void> {
	if (!cfg.CACHE_L3_ENABLED) return;
	// Future:
	//   if (!opts.userL3OptIn) return;
	//   const cls = await classifyShareable(opts.req, opts.response);
	//   if (!cls.safe) { logSkipped(cls.scores); return; }
	//   const canonical = canonicalizePrompt(opts.req);
	//   const vec = await embed(canonical);
	//   await upsertCandidate({ canonical, vec, response, contributorHash: sha256(opts.userUpstreamId) });
	return;
}

// Suppress unused-import warning until implementation arrives.
export type _L3Pending = { req: CanonicalRequest; messages: ChatMessage[] };
