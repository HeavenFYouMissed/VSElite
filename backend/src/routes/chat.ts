import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { validateSession, type AuthedUser } from '../auth/session.js';
import { orchestrate, orchestrateStream } from '../cache/orchestrator.js';
import {
	TIER_LIMITS,
	checkQuota,
	recordUsage,
	tryAcquireConcurrency,
	releaseConcurrency
} from '../billing/quota.js';
import { db, schema } from '../db/client.js';
import { loadConfig } from '../config.js';
import type { CanonicalRequest, ChatMessage } from '../cache/canonical.js';
import { DeepSeekError } from '../providers/deepseek.js';

const cfg = loadConfig();

const ChatRequestSchema = z.object({
	model: z.enum(['deepseek-v4-pro', 'deepseek-v4-flash', 'auto']).default('auto'),
	messages: z.array(z.any()).min(1),
	temperature: z.number().min(0).max(2).optional(),
	tools: z.array(z.any()).optional(),
	stream: z.boolean().default(false),
	// V3Code-specific extension: workspace identity for L2 partitioning.
	workspace_fingerprint: z.string().nullable().optional(),
	// Per-request override for L3.
	no_share: z.boolean().default(false)
});

export async function registerChatRoutes(app: FastifyInstance): Promise<void> {
	app.post('/v1/chat/completions', async (req, reply) => {
		const user = await authenticate(req);
		if (!user) return reply.code(401).send({ error: 'unauthenticated' });

		const parsed = ChatRequestSchema.safeParse(req.body);
		if (!parsed.success) {
			return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
		}
		const body = parsed.data;

		const limits = TIER_LIMITS[user.tier];

		// Free tier (and any tier without hosted inference flag) is BYOK-only — they hit DeepSeek
		// directly from the editor, not through us. If we ever see them here it's a client bug.
		if (!limits.allowsHostedInference) {
			return reply.code(402).send({
				error: 'upgrade_required',
				detail: 'hosted inference requires Builder, Pro, or Unlimited. Free tier is BYOK only.'
			});
		}

		const model = body.model === 'auto' ? limits.model : body.model;

		// Builder tier only gets Flash. Pro/Unlimited get either.
		if (user.tier === 'builder' && model === 'deepseek-v4-pro') {
			return reply.code(402).send({ error: 'upgrade_required', detail: 'V4 Pro model requires Pro or Unlimited tier' });
		}

		// Quota check.
		const quota = await checkQuota(user.id, user.tier);
		if (!quota.allowed) {
			return reply.code(402).send({ error: 'quota_exceeded', detail: quota.reason });
		}

		// Concurrency check.
		if (!tryAcquireConcurrency(user.id, user.tier)) {
			return reply.code(429).send({ error: 'concurrency_limit', detail: `${limits.concurrentRequests} max` });
		}

		const canonicalReq: CanonicalRequest = {
			model,
			messages: body.messages as ChatMessage[],
			temperature: body.temperature,
			tools: body.tools as CanonicalRequest['tools']
		};

		const ctx = {
			userId: user.id,
			upstreamUserId: user.upstreamUserId,
			userL3OptIn: user.l3OptIn,
			requestL3OptOut: body.no_share,
			workspaceFingerprint: body.workspace_fingerprint ?? null
		};

		const startedAt = Date.now();

		try {
			if (body.stream) {
				return await handleStreaming(reply, ctx, canonicalReq, user, startedAt);
			}
			return await handleNonStreaming(reply, ctx, canonicalReq, user, startedAt);
		} catch (err) {
			if (err instanceof DeepSeekError) {
				return reply.code(err.status === 429 ? 429 : 502).send({
					error: 'upstream_error',
					detail: err.message
				});
			}
			req.log.error({ err }, 'chat completion failed');
			return reply.code(500).send({ error: 'internal_error' });
		} finally {
			releaseConcurrency(user.id);
		}
	});
}

async function handleNonStreaming(
	reply: FastifyReply,
	ctx: Parameters<typeof orchestrate>[0],
	req: CanonicalRequest,
	user: AuthedUser,
	startedAt: number
) {
	const result = await orchestrate(ctx, req);
	const latency = Date.now() - startedAt;

	void Promise.all([
		recordUsage({
			userId: user.id,
			layer: result.layer,
			inputTokens: result.inputTokens,
			outputTokens: result.outputTokens
		}),
		db.insert(schema.requestLog).values({
			userId: user.id,
			model: req.model,
			cacheLayer: result.layer,
			inputTokens: result.inputTokens,
			outputTokens: result.outputTokens,
			latencyMs: latency,
			deepseekLatencyMs: result.deepseekLatencyMs,
			streamed: false,
			status: 200
		})
	]).catch(() => { /* logging is best-effort */ });

	reply.header('x-v3c-cache', result.layer);
	reply.header('x-v3c-latency-ms', String(latency));
	return result.response;
}

async function handleStreaming(
	reply: FastifyReply,
	ctx: Parameters<typeof orchestrateStream>[0],
	req: CanonicalRequest,
	user: AuthedUser,
	startedAt: number
) {
	reply.raw.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache, no-transform',
		'Connection': 'keep-alive',
		'X-Accel-Buffering': 'no'
	});

	const iter = orchestrateStream(ctx, req);
	let final: { layer: 'l1' | 'l2' | 'l3' | 'miss'; inputTokens: number; outputTokens: number; deepseekLatencyMs: number | null } | undefined;

	try {
		while (true) {
			const next = await iter.next();
			if (next.done) {
				final = next.value;
				break;
			}
			reply.raw.write(`data: ${JSON.stringify(next.value)}\n\n`);
		}
		reply.raw.write('data: [DONE]\n\n');
	} finally {
		reply.raw.end();
	}

	if (final) {
		const latency = Date.now() - startedAt;
		void Promise.all([
			recordUsage({
				userId: user.id,
				layer: final.layer,
				inputTokens: final.inputTokens,
				outputTokens: final.outputTokens
			}),
			db.insert(schema.requestLog).values({
				userId: user.id,
				model: req.model,
				cacheLayer: final.layer,
				inputTokens: final.inputTokens,
				outputTokens: final.outputTokens,
				latencyMs: latency,
				deepseekLatencyMs: final.deepseekLatencyMs,
				streamed: true,
				status: 200
			})
		]).catch(() => {});
	}
}

async function authenticate(req: FastifyRequest): Promise<AuthedUser | null> {
	const auth = req.headers.authorization;
	if (!auth || !auth.startsWith('Bearer ')) return null;
	return validateSession(auth.slice(7));
}

// Suppress unused-import warnings on `cfg`; kept for future per-route configuration.
void cfg;
