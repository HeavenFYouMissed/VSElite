/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IMCPService } from '../common/mcpService.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';

const CONTEXT_BRIDGE_SERVER_NAME = 'context-bridge';
const CONTEXT_BRIDGE_NODE = 'C:\\nvm4w\\nodejs\\node.exe';
const CONTEXT_BRIDGE_SCRIPT = 'C:\\Users\\heave\\Desktop\\mcp\\context-bridge\\mcp-server\\dist\\index.js';

/**
 * Ensures Context Bridge is registered as an MCP server every time V3Code
 * launches. If the server isn't in the user's mcp.json config file, it
 * adds it programmatically and triggers a refresh so the tools appear
 * in the agent's tool picker immediately.
 */
class ContextBridgeStartup extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.v3code.contextBridgeStartup';

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IPathService private readonly pathService: IPathService,
		@IProductService private readonly productService: IProductService,
		@IMCPService private readonly mcpService: IMCPService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		super();
		this.ensureRegistered();
	}

	private buildEntry() {
		const folders = this.workspaceContextService.getWorkspace().folders;
		const workspace = folders[0]?.uri.fsPath ?? 'C:\\Users\\heave\\Desktop\\mcp';
		return {
			type: 'stdio' as const,
			command: CONTEXT_BRIDGE_NODE,
			args: [CONTEXT_BRIDGE_SCRIPT],
			env: { CONTEXT_BRIDGE_WORKSPACE: workspace },
		};
	}

	private async ensureRegistered(): Promise<void> {
		try {
			await this.voidSettingsService.waitForInitState;

			const entry = this.buildEntry();
			const configUri = await this.getConfigUri();
			let config: { mcpServers: Record<string, unknown> } = { mcpServers: {} };

			try {
				const content = await this.fileService.readFile(configUri);
				config = JSON.parse(content.value.toString());
			} catch {
				// File doesn't exist or is invalid — create from scratch
			}

			if (!config.mcpServers) {
				config.mcpServers = {};
			}

			const existing = config.mcpServers[CONTEXT_BRIDGE_SERVER_NAME] as { command?: string; env?: { CONTEXT_BRIDGE_WORKSPACE?: string } } | undefined;
			const envMatches = existing?.env?.CONTEXT_BRIDGE_WORKSPACE === entry.env.CONTEXT_BRIDGE_WORKSPACE;
			if (existing && existing.command === entry.command && envMatches) {
				await this.mcpService.toggleServerIsOn(CONTEXT_BRIDGE_SERVER_NAME, true);
				return;
			}

			config.mcpServers[CONTEXT_BRIDGE_SERVER_NAME] = entry;

			const buffer = VSBuffer.fromString(JSON.stringify(config, null, 2));
			await this.fileService.writeFile(configUri, buffer);

			await this.voidSettingsService.addMCPUserStateOfNames({
				[CONTEXT_BRIDGE_SERVER_NAME]: { isOn: true },
			});
		} catch (err) {
			console.error('[V3Code] Context Bridge auto-register failed:', err);
		}
	}

	private async getConfigUri(): Promise<URI> {
		const appName = this.productService.dataFolderName;
		const userHome = await this.pathService.userHome();
		return URI.joinPath(userHome, appName, 'mcp.json');
	}
}

registerWorkbenchContribution2(
	ContextBridgeStartup.ID,
	ContextBridgeStartup,
	WorkbenchPhase.BlockRestore,
);
