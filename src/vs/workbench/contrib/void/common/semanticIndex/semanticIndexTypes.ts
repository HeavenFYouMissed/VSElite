/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

// ---------------------------------------------------------------------------
// Chunk shapes
// ---------------------------------------------------------------------------

export type ChunkKind =
	| 'function'
	| 'class'
	| 'method'
	| 'interface'
	| 'type'
	| 'enum'
	| 'file'
	| 'block';

export interface Chunk {
	/** sha256(file + ':' + startLine + ':' + endLine) — stable across edits if location is unchanged. */
	id: string;
	/** Workspace-relative POSIX path. Never absolute, never backslash. */
	file: string;
	/** 1-indexed, inclusive. */
	startLine: number;
	/** 1-indexed, inclusive. */
	endLine: number;
	kind: ChunkKind;
	/** Symbol name (e.g. function/class identifier) or filename for kind:'file'. */
	name: string;
	/** Language id matching VS Code's languageId conventions. */
	language: string;
	/** sha256(content) — drives incremental skip. */
	contentHash: string;
}

// ---------------------------------------------------------------------------
// Retrieval shapes
// ---------------------------------------------------------------------------

export interface Hit {
	chunk: Chunk;
	/** Hydrated from chunk_text. May be elided for transport — call retrieve() for full text. */
	content: string;
	/** Post-RRF score (higher = better). */
	score: number;
	/** Per-channel raw signals for debugging / UI. */
	signals: {
		vec?: number;
		fts?: number;
		hyde?: number;
		terms?: number;
	};
}

export interface QueryExpansion {
	original: string;
	/** Symbol-ish terms surfaced from the prompt — fed straight to FTS5. */
	codeTerms: string[];
	/** HyDE-style hallucinated code snippet that would answer the prompt. */
	hypotheticalCode: string;
	/** Rephrased variations of the prompt. */
	alternatives: string[];
}

// ---------------------------------------------------------------------------
// Index lifecycle
// ---------------------------------------------------------------------------

export type IndexState =
	| 'uninitialized'
	| 'idle'
	| 'walking'
	| 'chunking'
	| 'embedding'
	| 'ready'
	| 'error';

export interface IndexStatus {
	state: IndexState;
	filesTotal: number;
	filesIndexed: number;
	chunksTotal: number;
	lastError?: string;
	/** ms since epoch of last full index completion. */
	lastIndexedAt?: number;
	/** Active embedding model id (e.g. 'jina-embeddings-v2-base-code'). */
	modelId?: string;
	/** Embedding dimension currently in `chunk_vec`. */
	embeddingDim?: number;
	/** Rolling average files processed per second during an active rebuild. */
	filesPerSecond?: number;
	/** Estimated seconds remaining for the active rebuild. */
	etaSeconds?: number;
	/** Path of the file currently being processed (for the meter detail line). */
	currentFile?: string;
	/** Total bytes processed in the active run — used to compute throughput. */
	bytesProcessed?: number;
}

// ---------------------------------------------------------------------------
// Service decorator
// ---------------------------------------------------------------------------

export interface ISemanticIndexService {
	readonly _serviceBrand: undefined;

	readonly status: IndexStatus;
	readonly onDidChangeStatus: Event<IndexStatus>;

	/** Trigger a full re-walk. Resolves when indexing finishes (or rejects on error). */
	rebuild(): Promise<void>;

	/** Issue a semantic query. Returns up to topK hits (default 30). */
	retrieve(prompt: string, opts?: { topK?: number; files?: string[] }): Promise<Hit[]>;

	getStatus(): IndexStatus;
}

export const ISemanticIndexService = createDecorator<ISemanticIndexService>('semanticIndexService');
