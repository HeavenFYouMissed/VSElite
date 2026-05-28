import { l1Lookup, l1Write } from './l1.js';
import { l2Lookup, l2Write } from './l2.js';
import { l3Lookup, l3Submit } from './l3.js';
import { deepseekChat, deepseekChatStream, type DeepSeekStreamChunk, type DeepSeekResponse } from '../providers/deepseek.js';
import { toolSignature, type CanonicalRequest, type ChatMessage } from './canonical.js';

export type CacheLayer = 'l1' | 'l2' | 'l3' | 'miss';

export interface OrchestrateContext {
	userId: string;
	upstreamUserId: string;
	userL3OptIn: boolean;
	requestL3OptOut: boolean;
	workspaceFingerprint: string | null;
}

export interface OrchestrateResult {
	layer: CacheLayer;
	response: DeepSeekResponse | unknown;
	inputTokens: number;
	outputTokens: number;
	deepseekLatencyMs: number | null;
}

/**
 * Non-streaming orchestration. Walks L1 -> L2 -> L3 -> DeepSeek, writes back on miss.
 *
 * Cache writes after a real DeepSeek call happen fire-and-forget so the response isn't blocked
 * on cache I/O. Failed writes log but don't fail the request — cache is best-effort.
 */
export async function orchestrate(
	ctx: OrchestrateContext,
	req: CanonicalRequest
): Promise<OrchestrateResult> {
	// L1 — exact match.
	const l1 = await l1Lookup({
		userId: ctx.userId,
		upstreamUserId: ctx.upstreamUserId,
		req
	});
	if (l1.hit) {
		return {
			layer: 'l1',
			response: l1.response,
			inputTokens: l1.inputTokens,
			outputTokens: l1.outputTokens,
			deepseekLatencyMs: null
		};
	}

	// L2 — semantic per-user.
	const l2 = await l2Lookup({
		userId: ctx.userId,
		req,
		workspaceFingerprint: ctx.workspaceFingerprint
	});
	if (l2.hit) {
		// Promote into L1 for sub-ms next-time lookup.
		void l1Write({
			cacheKey: l1.cacheKey,
			userId: ctx.userId,
			model: req.model,
			response: l2.response,
			inputTokens: l2.inputTokens,
			outputTokens: l2.outputTokens
		}).catch(() => { /* best-effort */ });

		return {
			layer: 'l2',
			response: l2.response,
			inputTokens: l2.inputTokens,
			outputTokens: l2.outputTokens,
			deepseekLatencyMs: null
		};
	}

	// L3 — cross-user public (currently stubbed to always miss).
	const l3 = await l3Lookup({
		req,
		userL3OptIn: ctx.userL3OptIn,
		requestOptOut: ctx.requestL3OptOut
	});
	if (l3.hit) {
		// Promote into L1 + L2.
		void l1Write({
			cacheKey: l1.cacheKey,
			userId: ctx.userId,
			model: req.model,
			response: l3.response,
			inputTokens: l3.inputTokens,
			outputTokens: l3.outputTokens
		}).catch(() => {});
		void l2Write({
			userId: ctx.userId,
			model: req.model,
			embedding: l2.embedding,
			messages: req.messages as ChatMessage[],
			response: l3.response,
			inputTokens: l3.inputTokens,
			outputTokens: l3.outputTokens,
			workspaceFingerprint: ctx.workspaceFingerprint,
			toolSig: l2.toolSig
		}).catch(() => {});

		return {
			layer: 'l3',
			response: l3.response,
			inputTokens: l3.inputTokens,
			outputTokens: l3.outputTokens,
			deepseekLatencyMs: null
		};
	}

	// MISS — go to DeepSeek.
	const start = Date.now();
	const resp = await deepseekChat({
		upstreamUserId: ctx.upstreamUserId,
		req
	});
	const dsLatency = Date.now() - start;

	const inputTokens = resp.usage.prompt_tokens;
	const outputTokens = resp.usage.completion_tokens;

	// Fire-and-forget cache writes.
	void l1Write({
		cacheKey: l1.cacheKey,
		userId: ctx.userId,
		model: req.model,
		response: resp,
		inputTokens,
		outputTokens
	}).catch(() => {});
	void l2Write({
		userId: ctx.userId,
		model: req.model,
		embedding: l2.embedding,
		messages: req.messages as ChatMessage[],
		response: resp,
		inputTokens,
		outputTokens,
		workspaceFingerprint: ctx.workspaceFingerprint,
		toolSig: toolSignature(req, resp.choices[0]?.message)
	}).catch(() => {});
	void l3Submit({
		userUpstreamId: ctx.upstreamUserId,
		userL3OptIn: ctx.userL3OptIn,
		req,
		response: resp,
		inputTokens,
		outputTokens
	}).catch(() => {});

	return {
		layer: 'miss',
		response: resp,
		inputTokens,
		outputTokens,
		deepseekLatencyMs: dsLatency
	};
}

/**
 * Streaming orchestration. Cached hits are replayed as simulated streams to keep the
 * client-side experience identical regardless of cache layer.
 *
 * On miss: stream from DeepSeek, buffer the full message, then write to cache after stream end.
 */
export async function* orchestrateStream(
	ctx: OrchestrateContext,
	req: CanonicalRequest
): AsyncGenerator<DeepSeekStreamChunk, { layer: CacheLayer; inputTokens: number; outputTokens: number; deepseekLatencyMs: number | null }, void> {
	// Check caches first (cheap).
	const l1 = await l1Lookup({ userId: ctx.userId, upstreamUserId: ctx.upstreamUserId, req });
	if (l1.hit) {
		yield* replayAsStream(l1.response as DeepSeekResponse);
		return { layer: 'l1', inputTokens: l1.inputTokens, outputTokens: l1.outputTokens, deepseekLatencyMs: null };
	}

	const l2 = await l2Lookup({ userId: ctx.userId, req, workspaceFingerprint: ctx.workspaceFingerprint });
	if (l2.hit) {
		void l1Write({
			cacheKey: l1.cacheKey,
			userId: ctx.userId,
			model: req.model,
			response: l2.response,
			inputTokens: l2.inputTokens,
			outputTokens: l2.outputTokens
		}).catch(() => {});
		yield* replayAsStream(l2.response as DeepSeekResponse);
		return { layer: 'l2', inputTokens: l2.inputTokens, outputTokens: l2.outputTokens, deepseekLatencyMs: null };
	}

	const l3 = await l3Lookup({ req, userL3OptIn: ctx.userL3OptIn, requestOptOut: ctx.requestL3OptOut });
	if (l3.hit) {
		void l1Write({
			cacheKey: l1.cacheKey,
			userId: ctx.userId,
			model: req.model,
			response: l3.response,
			inputTokens: l3.inputTokens,
			outputTokens: l3.outputTokens
		}).catch(() => {});
		yield* replayAsStream(l3.response as DeepSeekResponse);
		return { layer: 'l3', inputTokens: l3.inputTokens, outputTokens: l3.outputTokens, deepseekLatencyMs: null };
	}

	// MISS — stream from DeepSeek and buffer for cache write.
	const start = Date.now();
	const buffered: DeepSeekStreamChunk[] = [];
	let usage: DeepSeekStreamChunk['usage'] | undefined;
	let contentBuf = '';
	const toolCallsAcc: NonNullable<NonNullable<DeepSeekResponse['choices'][0]['message']>['tool_calls']> = [];

	for await (const chunk of deepseekChatStream({ upstreamUserId: ctx.upstreamUserId, req })) {
		buffered.push(chunk);
		if (chunk.usage) usage = chunk.usage;
		const delta = chunk.choices[0]?.delta;
		if (delta?.content) contentBuf += delta.content;
		if (delta?.tool_calls) {
			for (const tcDelta of delta.tool_calls) {
				const idx = tcDelta.index ?? 0;
				if (!toolCallsAcc[idx]) {
					toolCallsAcc[idx] = {
						id: tcDelta.id ?? '',
						type: 'function',
						function: { name: tcDelta.function?.name ?? '', arguments: '' }
					};
				}
				const existing = toolCallsAcc[idx];
				if (existing) {
					if (tcDelta.id) existing.id = tcDelta.id;
					if (tcDelta.function?.name) existing.function.name = tcDelta.function.name;
					if (tcDelta.function?.arguments) existing.function.arguments += tcDelta.function.arguments;
				}
			}
		}
		yield chunk;
	}
	const dsLatency = Date.now() - start;

	const inputTokens = usage?.prompt_tokens ?? 0;
	const outputTokens = usage?.completion_tokens ?? 0;

	// Reconstruct a non-streaming response shape for cache storage.
	const lastChunk = buffered[buffered.length - 1];
	const reconstructed: DeepSeekResponse = {
		id: lastChunk?.id ?? 'cached',
		object: 'chat.completion',
		created: lastChunk?.created ?? Math.floor(Date.now() / 1000),
		model: lastChunk?.model ?? req.model,
		choices: [{
			index: 0,
			message: {
				role: 'assistant',
				content: contentBuf || null,
				...(toolCallsAcc.length > 0 ? { tool_calls: toolCallsAcc } : {})
			},
			finish_reason: lastChunk?.choices[0]?.finish_reason ?? 'stop'
		}],
		usage: usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
	};

	void l1Write({
		cacheKey: l1.cacheKey,
		userId: ctx.userId,
		model: req.model,
		response: reconstructed,
		inputTokens,
		outputTokens
	}).catch(() => {});
	void l2Write({
		userId: ctx.userId,
		model: req.model,
		embedding: l2.embedding,
		messages: req.messages as ChatMessage[],
		response: reconstructed,
		inputTokens,
		outputTokens,
		workspaceFingerprint: ctx.workspaceFingerprint,
		toolSig: toolSignature(req, reconstructed.choices[0]?.message)
	}).catch(() => {});
	void l3Submit({
		userUpstreamId: ctx.upstreamUserId,
		userL3OptIn: ctx.userL3OptIn,
		req,
		response: reconstructed,
		inputTokens,
		outputTokens
	}).catch(() => {});

	return { layer: 'miss', inputTokens, outputTokens, deepseekLatencyMs: dsLatency };
}

/**
 * Replay a cached non-streaming response as a sequence of stream chunks.
 *
 * Chunks the assistant content at ~30 chars (approx 6-8 tokens) with no artificial delay —
 * the network already provides natural pacing. Clients see structurally identical SSE to a
 * live DeepSeek stream. tool_calls are emitted as a single chunk for simplicity.
 */
async function* replayAsStream(response: DeepSeekResponse): AsyncGenerator<DeepSeekStreamChunk, void, void> {
	const choice = response.choices[0];
	if (!choice) return;
	const content = choice.message.content ?? '';
	const toolCalls = choice.message.tool_calls;
	const id = response.id;
	const created = response.created;
	const model = response.model;

	// Initial role chunk.
	yield {
		id, object: 'chat.completion.chunk', created, model,
		choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }]
	};

	// Content chunks.
	const CHUNK_SIZE = 30;
	for (let i = 0; i < content.length; i += CHUNK_SIZE) {
		yield {
			id, object: 'chat.completion.chunk', created, model,
			choices: [{ index: 0, delta: { content: content.slice(i, i + CHUNK_SIZE) }, finish_reason: null }]
		};
	}

	// Tool calls — emit as single chunk (rare on cache hits in practice).
	if (toolCalls && toolCalls.length > 0) {
		yield {
			id, object: 'chat.completion.chunk', created, model,
			choices: [{
				index: 0,
				delta: {
					tool_calls: toolCalls.map((tc, idx) => ({
						index: idx,
						id: tc.id,
						type: 'function',
						function: { name: tc.function.name, arguments: tc.function.arguments }
					}))
				},
				finish_reason: null
			}]
		};
	}

	// Final chunk with finish_reason + usage.
	yield {
		id, object: 'chat.completion.chunk', created, model,
		choices: [{ index: 0, delta: {}, finish_reason: choice.finish_reason }],
		usage: response.usage
	};
}
