/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { generateUuid } from '../../../../base/common/uuid.js';

export interface CheckpointInfo {
	id: string;
	threadId: string;
	fileCount: number;
	createdAt: number;
}

export interface IRollbackService {
	readonly _serviceBrand: undefined;
	createCheckpoint(threadId: string): string;
	recordFileChange(checkpointId: string, uri: URI, originalContent: string): void;
	rollback(checkpointId: string): Promise<void>;
	getCheckpoints(): CheckpointInfo[];
	discardCheckpoint(checkpointId: string): void;
}

export const IRollbackService = createDecorator<IRollbackService>('rollbackService');

interface CheckpointData {
	threadId: string;
	createdAt: number;
	files: Map<string, string>;
}

export class RollbackService extends Disposable implements IRollbackService {
	declare readonly _serviceBrand: undefined;

	private readonly _checkpoints = new Map<string, CheckpointData>();

	constructor(
		@IFileService private readonly fileService: IFileService,
		@ILogService private readonly logService: ILogService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
	) {
		super();
	}

	createCheckpoint(threadId: string): string {
		const id = generateUuid();
		this._checkpoints.set(id, {
			threadId,
			createdAt: Date.now(),
			files: new Map(),
		});
		this.logService.info(`[v3code.rollback] Created checkpoint ${id} for thread ${threadId}`);
		return id;
	}

	recordFileChange(checkpointId: string, uri: URI, originalContent: string): void {
		const checkpoint = this._checkpoints.get(checkpointId);
		if (!checkpoint) {
			this.logService.warn(`[v3code.rollback] Unknown checkpoint ${checkpointId}`);
			return;
		}
		const key = uri.toString();
		if (!checkpoint.files.has(key)) {
			checkpoint.files.set(key, originalContent);
			this.logService.trace(`[v3code.rollback] Recorded original content for ${key} in checkpoint ${checkpointId}`);
		}
	}

	async rollback(checkpointId: string): Promise<void> {
		const checkpoint = this._checkpoints.get(checkpointId);
		if (!checkpoint) {
			this.logService.warn(`[v3code.rollback] Cannot rollback unknown checkpoint ${checkpointId}`);
			return;
		}
		this.logService.info(`[v3code.rollback] Rolling back ${checkpoint.files.size} file(s) for checkpoint ${checkpointId}`);

		const errors: Array<{ uri: string; error: unknown }> = [];
		for (const [uriString, originalContent] of checkpoint.files) {
			try {
				const uri = URI.parse(uriString);
				await this.fileService.writeFile(uri, VSBuffer.fromString(originalContent));
			} catch (err) {
				errors.push({ uri: uriString, error: err });
				this.logService.error(`[v3code.rollback] Failed to restore ${uriString}`, err);
			}
		}

		this._checkpoints.delete(checkpointId);

		if (errors.length > 0) {
			this.logService.warn(`[v3code.rollback] Rollback completed with ${errors.length} error(s)`);
		} else {
			this.logService.info(`[v3code.rollback] Rollback of checkpoint ${checkpointId} completed successfully`);
		}
	}

	getCheckpoints(): CheckpointInfo[] {
		const result: CheckpointInfo[] = [];
		for (const [id, data] of this._checkpoints) {
			result.push({
				id,
				threadId: data.threadId,
				fileCount: data.files.size,
				createdAt: data.createdAt,
			});
		}
		return result;
	}

	discardCheckpoint(checkpointId: string): void {
		if (this._checkpoints.delete(checkpointId)) {
			this.logService.info(`[v3code.rollback] Discarded checkpoint ${checkpointId}`);
		}
	}
}

registerSingleton(IRollbackService, RollbackService, InstantiationType.Delayed);
