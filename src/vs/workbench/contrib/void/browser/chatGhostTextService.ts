/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Chat-aware ghost text (inline completion) service.
// When the user is editing a file that was recently discussed in chat,
// this service provides inline suggestions based on code the assistant proposed.

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { URI } from '../../../../base/common/uri.js';
import { Emitter, Event } from '../../../../base/common/event.js';

export interface GhostTextSuggestion {
	text: string;
	uri: URI;
	line: number;
	sourceThreadId: string;
}

export interface IChatGhostTextService {
	readonly _serviceBrand: undefined;

	/**
	 * Register a code suggestion from an assistant message.
	 * Called when the assistant proposes code for a specific file.
	 */
	registerSuggestion(uri: URI, code: string, threadId: string): void;

	/**
	 * Get a ghost text suggestion for the current cursor position.
	 * Returns null if no relevant suggestion exists.
	 */
	getSuggestion(uri: URI, lineContent: string, lineNumber: number): GhostTextSuggestion | null;

	/**
	 * Clear suggestions for a given file (e.g., after user accepts/rejects).
	 */
	clearSuggestions(uri: URI): void;

	/**
	 * Clear all cached suggestions.
	 */
	clearAll(): void;

	readonly onDidSuggestionsChange: Event<URI>;
}

export const IChatGhostTextService = createDecorator<IChatGhostTextService>('chatGhostTextService');

interface CachedSuggestion {
	lines: string[];
	threadId: string;
	registeredAt: number;
}

const MAX_SUGGESTIONS_PER_FILE = 5;
const SUGGESTION_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class ChatGhostTextService extends Disposable implements IChatGhostTextService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidSuggestionsChange = this._register(new Emitter<URI>());
	readonly onDidSuggestionsChange: Event<URI> = this._onDidSuggestionsChange.event;

	private suggestions = new Map<string, CachedSuggestion[]>();

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	registerSuggestion(uri: URI, code: string, threadId: string): void {
		const key = uri.toString();
		const lines = code.split(/\r?\n/).filter(l => l.trim().length > 0);
		if (lines.length === 0) { return; }

		const existing = this.suggestions.get(key) ?? [];
		existing.push({ lines, threadId, registeredAt: Date.now() });

		// Keep only recent suggestions
		while (existing.length > MAX_SUGGESTIONS_PER_FILE) {
			existing.shift();
		}
		this.suggestions.set(key, existing);
		this.logService.trace(`[v3code.ghostText] Registered ${lines.length}-line suggestion for ${key}`);
		this._onDidSuggestionsChange.fire(uri);
	}

	getSuggestion(uri: URI, lineContent: string, lineNumber: number): GhostTextSuggestion | null {
		const key = uri.toString();
		const candidates = this.suggestions.get(key);
		if (!candidates || candidates.length === 0) { return null; }

		const now = Date.now();
		const trimmedLine = lineContent.trim();
		if (trimmedLine.length < 3) { return null; }

		for (let i = candidates.length - 1; i >= 0; i--) {
			const candidate = candidates[i];
			if (now - candidate.registeredAt > SUGGESTION_TTL_MS) {
				candidates.splice(i, 1);
				continue;
			}

			// Find a line in the suggestion that starts with what the user is typing
			for (let li = 0; li < candidate.lines.length; li++) {
				const suggLine = candidate.lines[li].trim();
				if (suggLine.startsWith(trimmedLine) && suggLine.length > trimmedLine.length) {
					const completion = suggLine.slice(trimmedLine.length);
					// Also grab subsequent lines as multi-line completion
					const additionalLines = candidate.lines.slice(li + 1, li + 4);
					const fullText = completion + (additionalLines.length > 0 ? '\n' + additionalLines.join('\n') : '');
					return {
						text: fullText,
						uri,
						line: lineNumber,
						sourceThreadId: candidate.threadId,
					};
				}
			}
		}
		return null;
	}

	clearSuggestions(uri: URI): void {
		const key = uri.toString();
		if (this.suggestions.delete(key)) {
			this._onDidSuggestionsChange.fire(uri);
		}
	}

	clearAll(): void {
		const uris = [...this.suggestions.keys()];
		this.suggestions.clear();
		for (const key of uris) {
			try { this._onDidSuggestionsChange.fire(URI.parse(key)); } catch { /* ignore */ }
		}
	}
}

registerSingleton(IChatGhostTextService, ChatGhostTextService, InstantiationType.Delayed);
