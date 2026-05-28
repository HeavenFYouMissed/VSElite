/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { Extensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';

Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
	id: 'v3code.semanticIndex',
	order: 200,
	title: localize('v3code.semanticIndex.title', 'V3Code Semantic Index'),
	type: 'object',
	properties: {
		'v3code.semanticIndex.enabled': {
			type: 'boolean',
			default: true,
			description: localize('v3code.semanticIndex.enabled', 'Enable the V3Code semantic code index.'),
		},
		'v3code.semanticIndex.autoRebuildOnStartup': {
			type: 'boolean',
			default: false,
			description: localize('v3code.semanticIndex.autoRebuild', 'Rebuild the index automatically when V3Code opens this workspace.'),
		},
		'v3code.semanticIndex.embedModel': {
			type: 'string',
			enum: ['auto', 'jina-code', 'minilm'],
			enumDescriptions: [
				localize('v3code.semanticIndex.embedModel.auto', 'Pick automatically based on available RAM.'),
				localize('v3code.semanticIndex.embedModel.jina', 'Xenova/jina-embeddings-v2-base-code (768d, ~150MB).'),
				localize('v3code.semanticIndex.embedModel.minilm', 'Xenova/all-MiniLM-L6-v2 (384d, ~30MB).'),
			],
			default: 'auto',
			description: localize('v3code.semanticIndex.embedModel.desc', 'Embedding model used for semantic retrieval. Changing this triggers a full reindex.'),
		},
		'v3code.semanticIndex.queryExpander': {
			type: 'string',
			enum: ['heuristic', 'local-llama', 'chat-model'],
			enumDescriptions: [
				localize('v3code.semanticIndex.qx.h', 'Identifier extraction only (fastest, no model).'),
				localize('v3code.semanticIndex.qx.l', 'Bundled tiny local model (Qwen2.5-Coder-0.5B). Best quality offline.'),
				localize('v3code.semanticIndex.qx.c', 'Route through the configured V3Code chat model. Higher latency, uses your API quota.'),
			],
			default: 'heuristic',
			description: localize('v3code.semanticIndex.qx.desc', 'Strategy for expanding short prompts into richer retrieval queries (HyDE-style).'),
		},
		'v3code.semanticIndex.exclude': {
			type: 'array',
			items: { type: 'string' },
			default: ['node_modules', '.git', 'out', 'dist', 'build', '.next', '.cache', '.venv', 'venv', '__pycache__', 'target', 'bin', 'obj', '.v3code'],
			description: localize('v3code.semanticIndex.exclude.desc', 'Directory names to skip during indexing.'),
		},
		'v3code.semanticIndex.maxFileSizeKB': {
			type: 'number',
			default: 256,
			minimum: 1,
			maximum: 4096,
			description: localize('v3code.semanticIndex.maxFile.desc', 'Files larger than this (in KB) are skipped to keep memory bounded.'),
		},
		'v3code.semanticIndex.concurrency': {
			type: 'number',
			default: 4,
			minimum: 1,
			maximum: 8,
			description: localize('v3code.semanticIndex.concurrency.desc', 'Parallel file workers during a rebuild. Higher = faster, lower = lighter on the renderer.'),
		},
		'v3code.semanticIndex.modelDownloadHost': {
			type: 'string',
			default: '',
			description: localize('v3code.semanticIndex.host.desc', 'Optional mirror URL for embedding model downloads (for offline / enterprise environments). Leave blank to use Hugging Face.'),
		},
	},
});
