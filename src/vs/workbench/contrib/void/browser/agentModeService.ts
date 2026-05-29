/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentMode = 'agent' | 'ask' | 'plan';

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface IAgentModeService {
	readonly _serviceBrand: undefined;
	readonly mode: AgentMode;
	readonly onDidChangeMode: Event<AgentMode>;
	setMode(mode: AgentMode): void;
	isToolAllowed(toolName: string): boolean;
}

export const IAgentModeService = createDecorator<IAgentModeService>('agentModeService');

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const READ_ONLY_TOOLS = new Set([
	'read_file',
	'ls_dir',
	'get_dir_tree',
	'search_pathnames_only',
	'search_for_files',
	'search_in_file',
	'read_lint_errors',
	'find_text',
	'semantic_search',
	'get_file_context',
	'get_file_dependencies',
	'get_symbol_context',
	'get_call_graph',
	'pack_context',
	'get_project_briefing',
	'list_notes',
	'web_search',
	'git_status',
	'git_diff',
]);

class AgentModeService extends Disposable implements IAgentModeService {
	declare readonly _serviceBrand: undefined;

	private _mode: AgentMode = 'agent';
	get mode(): AgentMode { return this._mode; }

	private readonly _onDidChangeMode = this._register(new Emitter<AgentMode>());
	readonly onDidChangeMode: Event<AgentMode> = this._onDidChangeMode.event;

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	setMode(mode: AgentMode): void {
		if (this._mode === mode) {
			return;
		}

		this.logService.info('[AgentMode] switching mode:', this._mode, '->', mode);
		this._mode = mode;
		this._onDidChangeMode.fire(mode);
	}

	isToolAllowed(toolName: string): boolean {
		switch (this._mode) {
			case 'agent':
				return true;
			case 'ask':
				return READ_ONLY_TOOLS.has(toolName);
			case 'plan':
				return false;
		}
	}
}

registerSingleton(IAgentModeService, AgentModeService, InstantiationType.Delayed);
