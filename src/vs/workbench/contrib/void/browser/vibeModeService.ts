/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IContextKeyService, RawContextKey, IContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

/**
 * VIBE = full-screen agent mode (zen mode + agent panel overlay)
 * DEV  = normal VS Code editor mode
 */
export type VibeMode = 'vibe' | 'dev';

export interface IVibeModeService {
	readonly _serviceBrand: undefined;
	readonly mode: VibeMode;
	readonly onDidChangeMode: Event<VibeMode>;
	toggle(): void;
	enterVibe(): void;
	exitVibe(): void;
}

export const IVibeModeService = createDecorator<IVibeModeService>('vibeModeService');

export const V3CODE_VIBE_MODE_CONTEXT_KEY = new RawContextKey<boolean>('v3code.vibeMode', false);
export const V3CODE_VIBE_TOOLS_TAB_CONTEXT_KEY = new RawContextKey<string>('v3code.vibeToolsTab', 'browser');

const STORAGE_KEY = 'v3code.vibeMode';

export class VibeModeService extends Disposable implements IVibeModeService {
	declare readonly _serviceBrand: undefined;

	private _mode: VibeMode = 'dev';
	get mode(): VibeMode { return this._mode; }

	private readonly _onDidChangeMode = this._register(new Emitter<VibeMode>());
	readonly onDidChangeMode: Event<VibeMode> = this._onDidChangeMode.event;

	private readonly _vibeModeKey: IContextKey<boolean>;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ICommandService private readonly commandService: ICommandService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this._vibeModeKey = V3CODE_VIBE_MODE_CONTEXT_KEY.bindTo(contextKeyService);

		// Restore previous mode
		const stored = this.storageService.get(STORAGE_KEY, StorageScope.WORKSPACE);
		if (stored === 'vibe') {
			queueMicrotask(() => {
				if (this._mode === 'dev') {
					void this.enterVibe();
				}
			});
		}
	}

	toggle(): void {
		if (this._mode === 'dev') {
			void this.enterVibe();
		} else {
			void this.exitVibe();
		}
	}

	async enterVibe(): Promise<void> {
		if (this._mode === 'vibe') { return; }
		this.logService.info('[v3code.vibe] Entering VIBE mode...');

		// Enter zen mode first to hide all chrome and get full screen
		try {
			await this.commandService.executeCommand('workbench.action.toggleZenMode');
			this._mode = 'vibe';
			this._vibeModeKey.set(true);
			this.storageService.store(STORAGE_KEY, 'vibe', StorageScope.WORKSPACE, StorageTarget.USER);
			this._onDidChangeMode.fire('vibe');
			this.logService.info('[v3code.vibe] VIBE mode activated');
		} catch (err) {
			this.logService.error('[v3code.vibe] Failed to enter VIBE mode', err);
		}
	}

	async exitVibe(): Promise<void> {
		if (this._mode === 'dev') { return; }
		this.logService.info('[v3code.vibe] Exiting VIBE mode...');

		// Exit zen mode
		try {
			await this.commandService.executeCommand('workbench.action.toggleZenMode');
			this._mode = 'dev';
			this._vibeModeKey.set(false);
			this.storageService.store(STORAGE_KEY, 'dev', StorageScope.WORKSPACE, StorageTarget.USER);
			this._onDidChangeMode.fire('dev');
			this.logService.info('[v3code.vibe] DEV mode restored');
		} catch (err) {
			this.logService.error('[v3code.vibe] Failed to exit VIBE mode', err);
		}
	}
}

registerSingleton(IVibeModeService, VibeModeService, InstantiationType.Delayed);
