/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IContextKeyService, RawContextKey, IContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IEditorIdentifier } from '../../../common/editor.js';
import { VoidChatEditorInput } from './voidChatEditorInput.js';
import { IChatThreadService } from './chatThreadService.js';

export type AgentPanelMode = 'chat' | 'agent';

export interface IAgentPanelService {
	readonly _serviceBrand: undefined;
	readonly mode: AgentPanelMode;
	readonly onDidChangeMode: Event<AgentPanelMode>;
	toggle(): void;
	setMode(mode: AgentPanelMode): void;
}

export const IAgentPanelService = createDecorator<IAgentPanelService>('agentPanelService');

/** Context key set whenever the agent panel is in `agent` mode. Lets menus,
 *  keybindings, and other commands condition on the current state via
 *  `when: 'v3code.agentMode'`. */
export const V3CODE_AGENT_MODE_CONTEXT_KEY = new RawContextKey<boolean>('v3code.agentMode', false);

const STORAGE_KEY = 'v3code.agentPanelMode';

export class AgentPanelService extends Disposable implements IAgentPanelService {
	declare readonly _serviceBrand: undefined;

	private _mode: AgentPanelMode = 'chat';
	get mode(): AgentPanelMode { return this._mode; }

	private readonly _onDidChangeMode = this._register(new Emitter<AgentPanelMode>());
	readonly onDidChangeMode: Event<AgentPanelMode> = this._onDidChangeMode.event;

	private readonly _agentModeKey: IContextKey<boolean>;

	/** Identity of the chat editor that THIS service opened when entering agent
	 *  mode. We only close this specific editor when leaving — chat editors the
	 *  user manually opened in other tab groups are left alone. Closing
	 *  everything matching `VoidChatEditorInput.RESOURCE` (the previous
	 *  behaviour) was a destructive UX bug. */
	private _ownedEditor: IEditorIdentifier | null = null;

	/** Guards the deferred restore microtask against a concurrent toggle(). */
	private _restoring = false;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IStorageService private readonly storageService: IStorageService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService private readonly logService: ILogService,
		@IChatThreadService private readonly chatThreadService: IChatThreadService,
	) {
		super();
		this._agentModeKey = V3CODE_AGENT_MODE_CONTEXT_KEY.bindTo(contextKeyService);

		// Restore previous mode. Workspace-scoped so different projects can prefer
		// different defaults (a refactor-heavy repo lives in agent mode; a small
		// utility repo never needs it).
		const stored = this.storageService.get(STORAGE_KEY, StorageScope.WORKSPACE);
		if (stored === 'agent') {
			// Defer the editor open until after the workbench has its layout
			// settled — otherwise SIDE_GROUP can race the initial editor restore.
			this._restoring = true;
			queueMicrotask(() => {
				this._restoring = false;
				// If the user hit toggle() before this microtask, the mode already
				// changed — don't fight them.
				if (this._mode !== 'chat') return;
				void this._setModeInternal('agent', /*applyEditor*/ true);
			});
		}

		// If the user manually closes the chat editor while in agent mode, flip back to chat mode.
		this._register(this.editorService.onDidCloseEditor(e => {
			if (this._mode !== 'agent') { return; }
			if (e.editor instanceof VoidChatEditorInput) {
				// Only flip back if no other chat editor instances remain open.
				const remaining = this.editorService.findEditors(VoidChatEditorInput.RESOURCE);
				if (remaining.length === 0) {
					this._ownedEditor = null;
					void this._setModeInternal('chat', /*applyEditor*/ false);
				}
			}
		}));
	}

	toggle(): void {
		// If we're in the middle of restoring a stored agent state, ignore
		// user input — the deferred microtask owns the transition.
		if (this._restoring) return;
		this.setMode(this._mode === 'chat' ? 'agent' : 'chat');
	}

	setMode(mode: AgentPanelMode): void {
		if (mode === this._mode) { return; }
		if (this._restoring) return;
		void this._setModeInternal(mode, /*applyEditor*/ true);
	}

	private async _setModeInternal(mode: AgentPanelMode, applyEditor: boolean): Promise<void> {
		const prev = this._mode;
		this._mode = mode;
		if (applyEditor) {
			const ok = await this._applyEditorState();
			if (!ok) {
				// Editor open failed — don't lie to listeners about the current state.
				this._mode = prev;
				return;
			}
		}
		this._agentModeKey.set(this._mode === 'agent');
		this.storageService.store(STORAGE_KEY, this._mode, StorageScope.WORKSPACE, StorageTarget.USER);
		this._onDidChangeMode.fire(this._mode);
	}

	private async _applyEditorState(): Promise<boolean> {
		if (this._mode === 'agent') {
			try {
				// Entering agent mode — create a fresh chat so the user starts
				// with a clean slate. If an empty thread already exists, reuse it.
				this.chatThreadService.openNewThread();

				// Always create a fresh input — the static INSTANCE singleton gets
				// disposed by closeEditor and EditorInput.isDisposed() returns true,
				// which causes openEditor to reject disposed inputs.
				const input = new VoidChatEditorInput();
				const pane = await this.editorService.openEditor(input, { pinned: true }, SIDE_GROUP);
				if (!pane) {
					this.logService.warn('[v3code.agentPanel] openEditor returned no pane — cannot enter agent mode');
					return false;
				}
				this._ownedEditor = { editor: pane.input!, groupId: pane.group.id };
				return true;
			} catch (err) {
				this.logService.error('[v3code.agentPanel] openEditor failed', err);
				return false;
			}
		}
		// Leaving agent mode — close ONLY the editor we opened, never the
		// user's manually-opened chat editors in other groups.
		if (this._ownedEditor) {
			const owned = this._ownedEditor;
			try {
				await this.editorService.closeEditor(owned);
				// Only forget the editor after the close succeeds — if closeEditor
				// throws, the editor remains open and we must be able to retry.
				this._ownedEditor = null;
			} catch (err) {
				this.logService.warn('[v3code.agentPanel] closeEditor failed', err);
			}
		}
		return true;
	}
}

registerSingleton(IAgentPanelService, AgentPanelService, InstantiationType.Delayed);
