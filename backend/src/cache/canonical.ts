import { createHash } from 'node:crypto';

/**
 * OpenAI-format chat message subset we accept and cache against.
 */
export interface ChatMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string | Array<{ type: string; text?: string }>;
	name?: string;
	tool_call_id?: string;
	tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
}

export interface CanonicalRequest {
	model: string;
	messages: ChatMessage[];
	temperature?: number;
	tools?: Array<{ type: 'function'; function: { name: string; description?: string; parameters?: unknown } }>;
}

/**
 * Canonicalize a chat request into a stable string for hashing.
 *
 * Stability rules:
 *   - Stringify content arrays as concatenated text (only text parts count).
 *   - Whitespace within messages preserved (semantic).
 *   - Tools sorted by function name (order shouldn't affect cache).
 *   - Temperature rounded to 2 decimals (0.700001 == 0.7 for cache purposes).
 *   - Undefined temperature defaults to 1.0 (OpenAI default).
 *
 * This is the L1 input. L2 embeds a different normalization (just the user-message text concat).
 */
export function canonicalizeRequest(req: CanonicalRequest): string {
	const normalized = {
		model: req.model,
		temperature: roundTemp(req.temperature),
		messages: req.messages.map(normalizeMessage),
		tools: (req.tools ?? [])
			.slice()
			.sort((a, b) => a.function.name.localeCompare(b.function.name))
			.map(t => ({
				name: t.function.name,
				params: t.function.parameters ?? null
			}))
	};
	return JSON.stringify(normalized);
}

function roundTemp(t: number | undefined): number {
	if (t === undefined) return 1.0;
	return Math.round(t * 100) / 100;
}

function normalizeMessage(m: ChatMessage): unknown {
	const content = typeof m.content === 'string'
		? m.content
		: m.content
			.filter(p => p.type === 'text' && typeof p.text === 'string')
			.map(p => p.text!)
			.join('');

	const out: Record<string, unknown> = { role: m.role, content };
	if (m.name !== undefined) out.name = m.name;
	if (m.tool_call_id !== undefined) out.tool_call_id = m.tool_call_id;
	if (m.tool_calls !== undefined) {
		out.tool_calls = m.tool_calls
			.slice()
			.sort((a, b) => a.id.localeCompare(b.id))
			.map(tc => ({
				id: tc.id,
				name: tc.function.name,
				args: tc.function.arguments
			}));
	}
	return out;
}

/**
 * L1 cache key = sha256(upstreamUserId || canonical).
 *
 * upstreamUserId is the anonymized per-user id we also pass to DeepSeek. Salting with it
 * ensures user A's cache can never serve user B (per-user partitioning at the key level).
 */
export function l1CacheKey(upstreamUserId: string, req: CanonicalRequest): string {
	const h = createHash('sha256');
	h.update(upstreamUserId);
	h.update('\x00');
	h.update(canonicalizeRequest(req));
	return h.digest('hex');
}

/**
 * L2 embedding input = concatenated text of user + system messages, last 4 turns.
 *
 * Why limit: full context can be 100k+ tokens; embeddings are computed on a fixed budget
 * and similarity past ~2000 tokens degrades. Trimming to recent turns gives stable hits.
 */
export function l2EmbedInput(messages: ChatMessage[]): string {
	const relevant = messages
		.filter(m => m.role === 'user' || m.role === 'system')
		.slice(-4)
		.map(m => {
			const text = typeof m.content === 'string'
				? m.content
				: m.content.filter(p => p.type === 'text').map(p => p.text ?? '').join('');
			return `[${m.role}] ${text}`;
		})
		.join('\n\n');
	return relevant.slice(0, 8000);
}

/**
 * Stable signature for tool-call shape, used as an exact-match gate alongside L2 embedding.
 *
 * Why: two prompts can be semantically identical yet one expects a `read_file` tool and the
 * other expects `find_text`. Serving the wrong tool call breaks the agent. Same tools list
 * (and same first tool call if any) required for L2 hit.
 */
export function toolSignature(req: CanonicalRequest, response?: { tool_calls?: Array<{ function: { name: string } }> }): string | null {
	const toolNames = (req.tools ?? []).map(t => t.function.name).sort();
	const respCallNames = (response?.tool_calls ?? []).map(tc => tc.function.name).sort();
	if (toolNames.length === 0 && respCallNames.length === 0) return null;
	return `${toolNames.join(',')}|${respCallNames.join(',')}`;
}
