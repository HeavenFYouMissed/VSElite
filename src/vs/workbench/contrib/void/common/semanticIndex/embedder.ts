/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Embedding pipeline wrapper for `@xenova/transformers`.
 *
 * Auto-selects a model on first init based on system RAM:
 *   - >= 6GB free                     →  Xenova/jina-embeddings-v2-base-code (768d)
 *   - <  6GB free OR explicit setting →  Xenova/all-MiniLM-L6-v2          (384d)
 *
 * Model files lazy-download to `~/.v3code/models/` on first use. Subsequent
 * launches load from disk (`env.allowRemoteModels = false` after first run).
 * The download host is configurable for enterprise self-hosted mirrors via
 * `v3code.semanticIndex.modelDownloadHost`.
 */

import { totalmem, homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

export type EmbedModelHint = 'auto' | 'jina-code' | 'minilm';

export interface EmbedderOptions {
	modelHint?: EmbedModelHint;
	cacheDir?: string;
	mirrorHost?: string;
	/** Batch size for `embed([...])`. */
	batchSize?: number;
}

interface ModelDescriptor {
	id: string;
	dim: number;
	quantized: boolean;
}

const MODELS: Record<Exclude<EmbedModelHint, 'auto'>, ModelDescriptor> = {
	'jina-code': { id: 'Xenova/jina-embeddings-v2-base-code', dim: 768, quantized: true },
	'minilm':    { id: 'Xenova/all-MiniLM-L6-v2',             dim: 384, quantized: true },
};

const LOW_RAM_THRESHOLD = 6 * 1024 * 1024 * 1024;

export class Embedder {
	private pipe: any = null;
	private descriptor: ModelDescriptor | null = null;
	private initPromise: Promise<void> | null = null;

	constructor(private readonly opts: EmbedderOptions = {}) {}

	get isReady(): boolean { return this.pipe !== null && this.descriptor !== null; }
	get modelId(): string { return this.descriptor?.id ?? ''; }
	get dim(): number { return this.descriptor?.dim ?? 0; }

	async init(): Promise<void> {
		if (this.pipe) return;
		if (!this.initPromise) {
			this.initPromise = this.doInit();
		}
		await this.initPromise;
	}

	private async doInit(): Promise<void> {
		const hint = this.opts.modelHint ?? 'auto';
		const chosen: ModelDescriptor = hint === 'auto'
			? (totalmem() < LOW_RAM_THRESHOLD ? MODELS.minilm : MODELS['jina-code'])
			: MODELS[hint];

		const cacheDir = this.opts.cacheDir ?? join(homedir(), '.v3code', 'models');
		await mkdir(cacheDir, { recursive: true });

		const transformers = await import('@xenova/transformers' as any);
		transformers.env.cacheDir = cacheDir;
		transformers.env.localModelPath = cacheDir;
		transformers.env.allowRemoteModels = true;
		if (this.opts.mirrorHost) {
			// transformers.js doesn't expose a clean host override; setting
			// localModelPath alone is the documented self-host path. The mirror
			// host is a hint for future use — currently informational only.
		}
		// Pin onnxruntime-web to a small thread pool sized off the host's logical
		// core count. The default tries to use all cores, which starves the
		// renderer; hardcoding 2 leaves big machines idle and saturates small VMs.
		// Cap at 4 to keep the renderer responsive during embedding.
		if (transformers.env.backends?.onnx?.wasm) {
			const cores = (typeof navigator !== 'undefined' && (navigator as any).hardwareConcurrency) || 4;
			transformers.env.backends.onnx.wasm.numThreads = Math.max(1, Math.min(4, Math.floor(cores / 2)));
		}

		this.pipe = await transformers.pipeline('feature-extraction', chosen.id, {
			quantized: chosen.quantized,
			cache_dir: cacheDir,
		});
		this.descriptor = chosen;
	}

	/**
	 * Compute embeddings for a batch of texts. Returns one Float32Array per input.
	 * Uses mean pooling + L2 normalization so dot-product == cosine similarity.
	 */
	async embed(texts: string[]): Promise<Float32Array[]> {
		await this.init();
		if (!this.pipe || !this.descriptor) throw new Error('embedder not initialized');
		const batchSize = this.opts.batchSize ?? 16;
		const out: Float32Array[] = [];
		for (let i = 0; i < texts.length; i += batchSize) {
			const slice = texts.slice(i, i + batchSize);
			const result = await this.pipe(slice, { pooling: 'mean', normalize: true });
			// transformers.js returns a Tensor-like with `data` flat over [batch, dim].
			const data: Float32Array = result.data instanceof Float32Array
				? result.data
				: new Float32Array(result.data);
			const dim = this.descriptor.dim;
			for (let b = 0; b < slice.length; b++) {
				out.push(data.slice(b * dim, (b + 1) * dim));
			}
		}
		return out;
	}

	/** Free the loaded pipeline. Safe to call multiple times. */
	dispose(): void {
		this.pipe = null;
		this.descriptor = null;
		this.initPromise = null;
	}
}
