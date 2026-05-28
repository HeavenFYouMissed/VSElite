import { loadConfig } from '../config.js';
import type { CanonicalRequest } from '../cache/canonical.js';

const cfg = loadConfig();

export interface DeepSeekUsage {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
	// Server-side KV cache hits (only present when DeepSeek had a prefix hit for this user_id).
	prompt_cache_hit_tokens?: number;
	prompt_cache_miss_tokens?: number;
}

export interface DeepSeekResponse {
	id: string;
	object: 'chat.completion';
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: {
			role: 'assistant';
			content: string | null;
			tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
		};
		finish_reason: string;
	}>;
	usage: DeepSeekUsage;
}

export interface DeepSeekStreamChunk {
	id: string;
	object: 'chat.completion.chunk';
	created: number;
	model: string;
	choices: Array<{
		index: number;
		delta: {
			role?: 'assistant';
			content?: string | null;
			tool_calls?: Array<{ index: number; id?: string; type?: 'function'; function?: { name?: string; arguments?: string } }>;
		};
		finish_reason: string | null;
	}>;
	usage?: DeepSeekUsage;
}

export class DeepSeekError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly retryable: boolean
	) {
		super(message);
		this.name = 'DeepSeekError';
	}
}

/**
 * Non-streaming chat completion.
 *
 * Threads upstreamUserId as `user_id` per DeepSeek docs for KV cache + scheduling isolation.
 * Retries 429/5xx with exponential backoff (max 3 attempts).
 */
export async function deepseekChat(opts: {
	upstreamUserId: string;
	req: CanonicalRequest;
	signal?: AbortSignal;
}): Promise<DeepSeekResponse> {
	const body = {
		model: opts.req.model,
		messages: opts.req.messages,
		temperature: opts.req.temperature,
		tools: opts.req.tools,
		stream: false,
		user_id: opts.upstreamUserId
	};

	let lastErr: Error | undefined;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const resp = await fetch(`${cfg.DEEPSEEK_BASE_URL}/chat/completions`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${cfg.DEEPSEEK_API_KEY}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body),
				signal: opts.signal
			});

			if (!resp.ok) {
				const text = await resp.text();
				const retryable = resp.status === 429 || (resp.status >= 500 && resp.status < 600);
				const err = new DeepSeekError(`deepseek ${resp.status}: ${text.slice(0, 500)}`, resp.status, retryable);
				if (!retryable) throw err;
				lastErr = err;
				await backoff(attempt);
				continue;
			}

			return (await resp.json()) as DeepSeekResponse;
		} catch (e) {
			if (e instanceof DeepSeekError && !e.retryable) throw e;
			lastErr = e as Error;
			await backoff(attempt);
		}
	}

	throw lastErr ?? new Error('deepseek: unknown error after retries');
}

/**
 * Streaming chat completion. Yields parsed SSE chunks.
 *
 * Handles DeepSeek's keep-alive comments (lines starting with `:`) per their docs.
 */
export async function* deepseekChatStream(opts: {
	upstreamUserId: string;
	req: CanonicalRequest;
	signal?: AbortSignal;
}): AsyncGenerator<DeepSeekStreamChunk, void, void> {
	const body = {
		model: opts.req.model,
		messages: opts.req.messages,
		temperature: opts.req.temperature,
		tools: opts.req.tools,
		stream: true,
		stream_options: { include_usage: true },
		user_id: opts.upstreamUserId
	};

	const resp = await fetch(`${cfg.DEEPSEEK_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${cfg.DEEPSEEK_API_KEY}`,
			'Content-Type': 'application/json',
			'Accept': 'text/event-stream'
		},
		body: JSON.stringify(body),
		signal: opts.signal
	});

	if (!resp.ok) {
		const text = await resp.text();
		const retryable = resp.status === 429 || (resp.status >= 500 && resp.status < 600);
		throw new DeepSeekError(`deepseek ${resp.status}: ${text.slice(0, 500)}`, resp.status, retryable);
	}

	if (!resp.body) throw new DeepSeekError('deepseek: empty response body', 500, true);

	const reader = resp.body.getReader();
	const decoder = new TextDecoder('utf-8');
	let buffer = '';

	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			let nlIdx: number;
			while ((nlIdx = buffer.indexOf('\n')) !== -1) {
				const line = buffer.slice(0, nlIdx).trimEnd();
				buffer = buffer.slice(nlIdx + 1);

				// SSE keep-alive comments — skip.
				if (line.startsWith(':')) continue;
				if (line === '') continue;
				if (!line.startsWith('data:')) continue;

				const data = line.slice(5).trimStart();
				if (data === '[DONE]') return;

				try {
					yield JSON.parse(data) as DeepSeekStreamChunk;
				} catch {
					// Malformed chunk — skip rather than crash the whole stream.
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}

function backoff(attempt: number): Promise<void> {
	const ms = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;
	return new Promise(r => setTimeout(r, ms));
}
