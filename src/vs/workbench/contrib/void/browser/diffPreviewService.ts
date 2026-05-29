/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { generateUuid } from '../../../../base/common/uuid.js';

export type PendingEditStatus = 'pending' | 'accepted' | 'rejected';

export interface PendingEdit {
	uri: URI;
	originalContent: string;
	newContent: string;
	status: PendingEditStatus;
}

export interface IDiffPreviewService {
	readonly _serviceBrand: undefined;
	startReview(threadId: string): string;
	addPendingEdit(sessionId: string, uri: URI, originalContent: string, newContent: string): void;
	getPendingEdits(sessionId: string): PendingEdit[];
	acceptEdit(sessionId: string, uri: URI): Promise<void>;
	acceptAll(sessionId: string): Promise<void>;
	rejectEdit(sessionId: string, uri: URI): void;
	rejectAll(sessionId: string): void;
	readonly onDidEditsChange: Event<string>;
}

export const IDiffPreviewService = createDecorator<IDiffPreviewService>('diffPreviewService');

interface ReviewSession {
	threadId: string;
	edits: Map<string, PendingEdit>;
}

export class DiffPreviewService extends Disposable implements IDiffPreviewService {
	declare readonly _serviceBrand: undefined;

	private readonly _sessions = new Map<string, ReviewSession>();

	private readonly _onDidEditsChange = this._register(new Emitter<string>());
	readonly onDidEditsChange: Event<string> = this._onDidEditsChange.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	startReview(threadId: string): string {
		const id = generateUuid();
		this._sessions.set(id, { threadId, edits: new Map() });
		this.logService.info(`[v3code.diffPreview] Started review session ${id} for thread ${threadId}`);
		return id;
	}

	addPendingEdit(sessionId: string, uri: URI, originalContent: string, newContent: string): void {
		const session = this._sessions.get(sessionId);
		if (!session) {
			this.logService.warn(`[v3code.diffPreview] Unknown session ${sessionId}`);
			return;
		}
		session.edits.set(uri.toString(), {
			uri,
			originalContent,
			newContent,
			status: 'pending',
		});
		this.logService.trace(`[v3code.diffPreview] Added pending edit for ${uri.toString()} in session ${sessionId}`);
		this._onDidEditsChange.fire(sessionId);
	}

	getPendingEdits(sessionId: string): PendingEdit[] {
		const session = this._sessions.get(sessionId);
		if (!session) {
			return [];
		}
		return Array.from(session.edits.values()).map(e => ({ ...e }));
	}

	async acceptEdit(sessionId: string, uri: URI): Promise<void> {
		const session = this._sessions.get(sessionId);
		if (!session) {
			this.logService.warn(`[v3code.diffPreview] Unknown session ${sessionId}`);
			return;
		}
		const key = uri.toString();
		const edit = session.edits.get(key);
		if (!edit || edit.status !== 'pending') {
			return;
		}
		try {
			await this.fileService.writeFile(uri, VSBuffer.fromString(edit.newContent));
			edit.status = 'accepted';
			this.logService.info(`[v3code.diffPreview] Accepted edit for ${key}`);
			this._onDidEditsChange.fire(sessionId);
		} catch (err) {
			this.logService.error(`[v3code.diffPreview] Failed to apply edit for ${key}`, err);
		}
	}

	async acceptAll(sessionId: string): Promise<void> {
		const session = this._sessions.get(sessionId);
		if (!session) {
			this.logService.warn(`[v3code.diffPreview] Unknown session ${sessionId}`);
			return;
		}
		const pending = Array.from(session.edits.values()).filter(e => e.status === 'pending');
		this.logService.info(`[v3code.diffPreview] Accepting ${pending.length} edit(s) in session ${sessionId}`);

		for (const edit of pending) {
			try {
				await this.fileService.writeFile(edit.uri, VSBuffer.fromString(edit.newContent));
				edit.status = 'accepted';
			} catch (err) {
				this.logService.error(`[v3code.diffPreview] Failed to apply edit for ${edit.uri.toString()}`, err);
			}
		}
		this._onDidEditsChange.fire(sessionId);
	}

	rejectEdit(sessionId: string, uri: URI): void {
		const session = this._sessions.get(sessionId);
		if (!session) {
			return;
		}
		const edit = session.edits.get(uri.toString());
		if (edit && edit.status === 'pending') {
			edit.status = 'rejected';
			this.logService.info(`[v3code.diffPreview] Rejected edit for ${uri.toString()}`);
			this._onDidEditsChange.fire(sessionId);
		}
	}

	rejectAll(sessionId: string): void {
		const session = this._sessions.get(sessionId);
		if (!session) {
			return;
		}
		let changed = false;
		for (const edit of session.edits.values()) {
			if (edit.status === 'pending') {
				edit.status = 'rejected';
				changed = true;
			}
		}
		if (changed) {
			this.logService.info(`[v3code.diffPreview] Rejected all pending edits in session ${sessionId}`);
			this._onDidEditsChange.fire(sessionId);
		}
	}
}

registerSingleton(IDiffPreviewService, DiffPreviewService, InstantiationType.Delayed);
