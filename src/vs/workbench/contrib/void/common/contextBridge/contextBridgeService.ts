/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { SymbolNote } from './contextBridgeTypes.js';

const STORE_DIR = '.context-bridge';
const NOTES_FILENAME = 'notes.json';

interface NotesFile {
	version: 1;
	notes: SymbolNote[];
}

/** Notes are keyed by {filePath, symbolName}. File paths arrive from multiple
 *  sources with inconsistent separators on Windows. Normalize to POSIX so
 *  equality comparison works regardless of origin. */
function normalizePath(p: string): string {
	return p.split('\\').join('/');
}

export interface IContextBridgeService {
	readonly _serviceBrand: undefined;
	listNotes(filterFilePath?: string): Promise<SymbolNote[]>;
	getNotesForSymbol(filePath: string, symbolName: string): Promise<SymbolNote[]>;
	addNote(filePath: string, symbolName: string, note: string): Promise<SymbolNote>;
	deleteNote(id: string): Promise<boolean>;
}

export const IContextBridgeService = createDecorator<IContextBridgeService>('contextBridgeService');

export class ContextBridgeService extends Disposable implements IContextBridgeService {
	declare readonly _serviceBrand: undefined;

	private notes: SymbolNote[] = [];
	private loaded = false;
	private savePromise: Promise<void> = Promise.resolve();

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	private getNotesUri(): URI | null {
		const folders = this.workspaceService.getWorkspace().folders;
		if (folders.length === 0) return null;
		return URI.joinPath(folders[0].uri, STORE_DIR, NOTES_FILENAME);
	}

	private async ensureLoaded(): Promise<void> {
		if (this.loaded) return;
		const uri = this.getNotesUri();
		if (!uri) {
			this.loaded = true;
			return;
		}
		try {
			const content = await this.fileService.readFile(uri);
			const data = JSON.parse(content.value.toString()) as NotesFile;
			this.notes = Array.isArray(data.notes) ? data.notes : [];
		} catch {
			// File doesn't exist yet or is unreadable — start with empty notes.
			this.notes = [];
		}
		this.loaded = true;
	}

	private async save(): Promise<void> {
		const uri = this.getNotesUri();
		if (!uri) return;
		// Serialize writes — chain on the prior save to avoid interleaved writes.
		const prior = this.savePromise;
		this.savePromise = prior.then(async () => {
			try {
				const data: NotesFile = { version: 1, notes: this.notes };
				const buf = VSBuffer.fromString(JSON.stringify(data, null, 2));
				await this.fileService.writeFile(uri, buf);
			} catch (e) {
				this.logService.error('[ContextBridge] failed to persist notes', e);
				throw e;
			}
		});
		return this.savePromise;
	}

	async listNotes(filterFilePath?: string): Promise<SymbolNote[]> {
		await this.ensureLoaded();
		if (!filterFilePath) return [...this.notes];
		const normalized = normalizePath(filterFilePath);
		return this.notes.filter(n => normalizePath(n.filePath) === normalized);
	}

	async getNotesForSymbol(filePath: string, symbolName: string): Promise<SymbolNote[]> {
		await this.ensureLoaded();
		const normalized = normalizePath(filePath);
		return this.notes.filter(n => normalizePath(n.filePath) === normalized && n.symbolName === symbolName);
	}

	async addNote(filePath: string, symbolName: string, note: string): Promise<SymbolNote> {
		await this.ensureLoaded();
		const now = new Date().toISOString();
		const entry: SymbolNote = {
			id: generateUuid(),
			filePath: normalizePath(filePath),
			symbolName,
			note,
			createdAt: now,
			updatedAt: now,
		};
		this.notes.push(entry);
		await this.save();
		return entry;
	}

	async deleteNote(id: string): Promise<boolean> {
		await this.ensureLoaded();
		const before = this.notes.length;
		this.notes = this.notes.filter(n => n.id !== id);
		if (this.notes.length === before) return false;
		await this.save();
		return true;
	}
}

registerSingleton(IContextBridgeService, ContextBridgeService, InstantiationType.Delayed);
