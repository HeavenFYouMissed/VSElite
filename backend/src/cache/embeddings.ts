import { loadConfig } from '../config.js';

const cfg = loadConfig();

interface EmbeddingResponse {
	data: Array<{ embedding: number[]; index: number }>;
	usage: { prompt_tokens: number; total_tokens: number };
}

/**
 * Embed a single string using the configured provider.
 *
 * Implementation note: we hit OpenAI's embeddings endpoint directly rather than via the SDK
 * to keep the dependency surface minimal. Swap to bge-small self-hosted (sentence-transformers
 * via Python sidecar or onnxruntime) once volume justifies it — OpenAI charges $0.02/1M tokens
 * for text-embedding-3-small, which is fine for MVP but compounds at scale.
 */
export async function embed(text: string): Promise<number[]> {
	if (cfg.EMBEDDINGS_PROVIDER !== 'openai') {
		throw new Error(`Unsupported embeddings provider: ${cfg.EMBEDDINGS_PROVIDER}`);
	}

	const resp = await fetch('https://api.openai.com/v1/embeddings', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${cfg.EMBEDDINGS_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: cfg.EMBEDDINGS_MODEL,
			input: text,
			encoding_format: 'float'
		})
	});

	if (!resp.ok) {
		const body = await resp.text();
		throw new Error(`embeddings api ${resp.status}: ${body}`);
	}

	const json = (await resp.json()) as EmbeddingResponse;
	const vec = json.data[0]?.embedding;
	if (!vec || vec.length !== cfg.EMBEDDINGS_DIM) {
		throw new Error(`embedding dim mismatch: got ${vec?.length}, want ${cfg.EMBEDDINGS_DIM}`);
	}
	return vec;
}

/**
 * Batched embedding for migrations / backfills. Not on hot path.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
	if (texts.length === 0) return [];
	const resp = await fetch('https://api.openai.com/v1/embeddings', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${cfg.EMBEDDINGS_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: cfg.EMBEDDINGS_MODEL,
			input: texts,
			encoding_format: 'float'
		})
	});
	if (!resp.ok) {
		const body = await resp.text();
		throw new Error(`embeddings api ${resp.status}: ${body}`);
	}
	const json = (await resp.json()) as EmbeddingResponse;
	return json.data
		.sort((a, b) => a.index - b.index)
		.map(d => d.embedding);
}
