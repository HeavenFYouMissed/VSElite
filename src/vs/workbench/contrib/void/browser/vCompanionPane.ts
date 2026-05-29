/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * V companion — THIN webview host (the "[v]" bottom-panel tab).
 *
 * This file is intentionally tiny. ALL of V's UI lives in the standalone Vite + React app
 * at `vselite/void-panel/` (never src/vs, never gulp). Here we only:
 *   1. register a Panel view container + view (the `[v]` tab next to Ports),
 *   2. create a VS Code overlay webview and inject a relay HTML that embeds an iframe to
 *      the Vite app (localhost:5173 in dev for HMR; asWebviewUri(dist) in prod),
 *   3. bridge postMessage <-> the in-process services (Phase 1: project briefing).
 *
 * See V-SOURCE-OF-TRUTH.md §3. The RPC contract is the stable seam across the VS Code merge.
 */

import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions, IViewContainersRegistry,
	ViewContainerLocation, IViewsRegistry, Extensions as ViewExtensions,
	IViewDescriptorService,
} from '../../../common/views.js';
import * as nls from '../../../../nls.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';
import { DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Dimension, getWindow, findParentWithClass } from '../../../../base/browser/dom.js';
import { URI } from '../../../../base/common/uri.js';
import { IEnvironmentService, INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IWebviewService, IOverlayWebview, WebviewContentPurpose } from '../../webview/browser/webview.js';
import { asWebviewUri, webviewGenericCspSource } from '../../webview/common/webview.js';
import { IToolsService } from './toolsService.js';
import { ILLMMessageService } from '../common/sendLLMMessageService.js';
import { IConvertToLLMMessageService } from './convertToLLMMessageService.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { ModelSelection } from '../common/voidSettingsTypes.js';
import { IChatThreadService } from './chatThreadService.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';

declare const ResizeObserver: any;

export const V_VIEW_CONTAINER_ID = 'workbench.view.vCompanion';
export const V_VIEW_ID = 'workbench.view.vCompanion.view';

const DEV_URL = 'http://localhost:5173';

// ---------- The thin webview-hosting pane ----------

class VCompanionViewPane extends ViewPane {

	private readonly _webview = this._register(new MutableDisposable<IOverlayWebview>());
	private readonly _webviewDisposables = this._register(new DisposableStore());
	private _container?: HTMLElement;
	private _rootContainer?: HTMLElement;
	private _resizeObserver?: any;
	private _repositionTimeout?: any;
	private _activated = false;

	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService hoverService: IHoverService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IToolsService private readonly toolsService: IToolsService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@ILLMMessageService private readonly llmMessageService: ILLMMessageService,
		@IConvertToLLMMessageService private readonly convertService: IConvertToLLMMessageService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService,
		@IChatThreadService private readonly chatThreadService: IChatThreadService,
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		// Agent-watching: translate the coding agent's stream state into events V's UI reacts to.
		this._register(this.chatThreadService.onDidChangeStreamState(({ threadId }) => {
			const ss: any = this.chatThreadService.streamState[threadId];
			const running = ss?.isRunning;
			let kind: 'idle' | 'thinking' | 'tool' | 'awaiting' = 'idle';
			let detail = '';
			if (running === 'LLM') { kind = 'thinking'; }
			else if (running === 'tool') { kind = 'tool'; detail = ss?.toolInfo?.toolName ?? ''; }
			else if (running === 'awaiting_user') { kind = 'awaiting'; }
			this._post({ type: 'agentEvent', kind, detail });
		}));

		this._register(this.onDidChangeBodyVisibility(() => {
			if (this.isBodyVisible()) {
				this._activate();
				this._webview.value?.claim(this, getWindow(this.element), undefined);
				this._layoutWebview();
			} else {
				this._webview.value?.release(this);
			}
		}));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this._container = container;
		this._rootContainer = undefined;
		container.style.background = '#0a0612';

		// The webview is absolutely-positioned over this container. Without a ResizeObserver the
		// overlay keeps its initial (often 0/short) size until the user manually resizes the panel,
		// which is exactly the "rendered to the bottom until I made it bigger" bug. Relayout on resize.
		if (!this._resizeObserver) {
			this._resizeObserver = new ResizeObserver(() => setTimeout(() => this._layoutWebview(), 0));
			this._register(toDisposable(() => this._resizeObserver?.disconnect()));
			this._resizeObserver.observe(container);
		}

		if (this.isBodyVisible()) {
			this._activate();
			this._webview.value?.claim(this, getWindow(this.element), undefined);
			this._layoutWebview();
		}
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this._layoutWebview(new Dimension(width, height));
	}

	override focus(): void {
		super.focus();
		this._webview.value?.focus();
	}

	private _activate(): void {
		if (this._activated) { return; }
		this._activated = true;

		const webview = this.webviewService.createWebviewOverlay({
			providedViewType: V_VIEW_ID,
			title: 'V',
			options: { purpose: WebviewContentPurpose.WebviewView, retainContextWhenHidden: true },
			contentOptions: {
				allowScripts: true,
				localResourceRoots: this._localResourceRoots(),
			},
			extension: undefined,
		});
		this._webview.value = webview;

		this._webviewDisposables.add(toDisposable(() => this._webview.value?.release(this)));
		this._webviewDisposables.add(webview.onMessage(e => this._handleMessage(e.message)));

		webview.setHtml(this._buildHtml());
	}

	private _isDev(): boolean { return !this.environmentService.isBuilt; }

	private _distRoot(): URI {
		// appRoot is native-only; the V3Code renderer always runs in Electron so this is safe.
		const appRoot = (this.environmentService as INativeEnvironmentService).appRoot;
		return URI.joinPath(URI.file(appRoot), 'void-panel', 'dist');
	}

	private _localResourceRoots(): URI[] {
		return this._isDev() ? [] : [this._distRoot()];
	}

	private _frameSrc(): string {
		if (this._isDev()) { return DEV_URL; }
		return asWebviewUri(URI.joinPath(this._distRoot(), 'index.html')).toString();
	}

	private _buildHtml(): string {
		const frameSrc = this._frameSrc();
		const frameCsp = this._isDev() ? `${DEV_URL} ws://localhost:5173` : webviewGenericCspSource;
		// Relay: forward panel-app messages -> host, and host messages -> panel-app iframe.
		return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy"
	content="default-src 'none'; frame-src ${frameCsp}; script-src 'unsafe-inline'; style-src 'unsafe-inline';" />
<style>
	html, body { margin: 0; padding: 0; height: 100%; background: #160a2b; overflow: hidden; }
	#vframe { width: 100%; height: 100%; border: 0; display: block; }
</style>
</head>
<body>
<iframe id="vframe" src="${frameSrc}" allow="clipboard-read; clipboard-write"></iframe>
<script>
	const vscode = acquireVsCodeApi();
	const frame = document.getElementById('vframe');
	window.addEventListener('message', function (e) {
		if (frame.contentWindow && e.source === frame.contentWindow) {
			// from the V panel app -> forward to the workbench host
			vscode.postMessage(e.data);
		} else {
			// from the workbench host -> forward into the V panel app
			if (frame.contentWindow) { frame.contentWindow.postMessage(e.data, '*'); }
		}
	});
</script>
</body>
</html>`;
	}

	private _post(message: unknown): void {
		this._webview.value?.postMessage(message);
	}

	private async _handleMessage(msg: any): Promise<void> {
		if (!msg || typeof msg !== 'object') { return; }

		if (msg.type === 'ready') {
			const folders = this.workspaceContextService.getWorkspace().folders;
			this._post({ type: 'init', workspaceName: folders[0]?.name });
			return;
		}

		if (msg.type === 'rpc-request') {
			// streaming methods emit rpc-stream events instead of a single response
			if (msg.method === 'vChat') { this._vChat(msg.id, msg.params); return; }
			if (msg.method === 'vAbort') { if (this._vRequestId) { this.llmMessageService.abort(this._vRequestId); } return; }
			try {
				const result = await this._dispatch(msg.method, msg.params);
				this._post({ type: 'rpc-response', id: msg.id, ok: true, result });
			} catch (err: any) {
				this._post({ type: 'rpc-response', id: msg.id, ok: false, error: String(err?.message ?? err) });
			}
		}
	}

	// ----- V's brain: a direct LLM stream (deepseek-flash by default), separate from the agent -----

	private _vMessages: any[] = [];
	private _vRequestId: string | null = null;

	private _vModelSelection(): { modelSelection: ModelSelection | null; modelSelectionOptions: any } {
		const s = this.settingsService.state;
		let modelSelection: ModelSelection | null = null;
		const deepseek: any = (s.settingsOfProvider as any)?.['deepseek'];
		const hasFlash = deepseek?._didFillInProviderSettings
			&& (deepseek.models ?? []).some((m: any) => m.modelName === 'deepseek-v4-flash');
		if (hasFlash) {
			modelSelection = { providerName: 'deepseek', modelName: 'deepseek-v4-flash' } as ModelSelection;
		} else {
			// fall back to whatever the user has selected for Chat (so V still works without flash)
			modelSelection = s.modelSelectionOfFeature['Chat'] ?? null;
		}
		const modelSelectionOptions = modelSelection
			? (s.optionsOfModelSelection as any)['Chat']?.[modelSelection.providerName]?.[modelSelection.modelName]
			: undefined;
		return { modelSelection, modelSelectionOptions };
	}

	// V's eyes — a snapshot of what's on screen, so he can actually see what we're doing.
	private _vContextBlock(): string {
		const lines: string[] = [];
		const folders = this.workspaceContextService.getWorkspace().folders;
		lines.push(`workspace: ${folders[0]?.name ?? '(no folder open)'}`);

		const editor = this.codeEditorService.getFocusedCodeEditor() ?? this.codeEditorService.listCodeEditors()[0];
		const model = editor?.getModel();
		if (model && model.uri.scheme === 'file') {
			lines.push(`active file: ${model.uri.fsPath}`);
			let content = model.getValue();
			if (content.length > 6000) { content = content.slice(0, 6000) + '\n…(truncated)'; }
			lines.push('```');
			lines.push(content);
			lines.push('```');
		}

		const open = Array.from(new Set(
			this.codeEditorService.listCodeEditors()
				.map(e => e.getModel())
				.filter(m => m && m.uri.scheme === 'file')
				.map(m => m!.uri.fsPath)
		));
		if (open.length) { lines.push(`open editors: ${open.join(', ')}`); }
		return lines.join('\n');
	}

	private _vChat(streamId: string, params: any): void {
		const text = String(params?.text ?? '').trim();
		if (!text) { return; }
		this._vMessages.push({ role: 'user', content: text });

		const { modelSelection, modelSelectionOptions } = this._vModelSelection();
		if (!modelSelection) {
			this._post({ type: 'rpc-stream', id: streamId, event: 'error', payload: 'V has no model yet — add a provider key in settings.' });
			return;
		}

		const systemMessage = `${V_SYSTEM_PROMPT}\n\n# what V can see right now\n${this._vContextBlock()}`;
		const { messages, separateSystemMessage } = this.convertService.prepareLLMSimpleMessages({
			simpleMessages: this._vMessages as any,
			systemMessage,
			modelSelection,
			featureName: 'Chat',
		});

		let full = '';
		const reqId = this.llmMessageService.sendLLMMessage({
			messagesType: 'chatMessages',
			chatMode: null,
			messages,
			modelSelection,
			modelSelectionOptions,
			overridesOfModel: this.settingsService.state.overridesOfModel,
			separateSystemMessage,
			logging: { loggingName: 'V Companion' },
			onText: ({ fullText }) => { full = fullText; this._post({ type: 'rpc-stream', id: streamId, event: 'text', payload: fullText }); },
			onFinalMessage: ({ fullText }) => {
				full = fullText || full;
				this._vMessages.push({ role: 'assistant', content: full, anthropicReasoning: null, reasoning: null });
				this._post({ type: 'rpc-stream', id: streamId, event: 'final', payload: full });
				this._vRequestId = null;
			},
			onError: ({ message }) => { this._post({ type: 'rpc-stream', id: streamId, event: 'error', payload: message }); this._vRequestId = null; },
			onAbort: () => { this._post({ type: 'rpc-stream', id: streamId, event: 'abort' }); this._vRequestId = null; },
		});
		this._vRequestId = reqId;
		if (!reqId) {
			this._post({ type: 'rpc-stream', id: streamId, event: 'error', payload: 'V could not start a request.' });
		}
	}

	private async _dispatch(method: string, params: any): Promise<unknown> {
		switch (method) {
			case 'getProjectBriefing': {
				const folders = this.workspaceContextService.getWorkspace().folders;
				const r = await this.toolsService.callTool['get_project_briefing'](params ?? {});
				return {
					workspaceRoot: folders[0]?.uri.fsPath ?? null,
					raw: (r as any)?.result,
				};
			}
			case 'callTool': {
				const toolName = params?.toolName as string;
				const fn = (this.toolsService.callTool as any)[toolName];
				if (typeof fn !== 'function') { throw new Error('unknown tool: ' + toolName); }
				return await fn(params?.params ?? {});
			}
			case 'vWorkspaceSummary':
				return await this._vWorkspaceSummary();
			default:
				throw new Error('unknown method: ' + method);
		}
	}

	// ----- V's own workspace ("the background"): .v/ with skills/, memory/, files/ -----

	private _vHome(): URI | undefined {
		const folder = this.workspaceContextService.getWorkspace().folders[0]?.uri;
		return folder ? URI.joinPath(folder, '.v') : undefined;
	}

	private async _ensureVWorkspace(): Promise<URI | undefined> {
		const home = this._vHome();
		if (!home) { return undefined; }
		const dirs = ['skills', 'memory', 'files'].map(d => URI.joinPath(home, d));
		try {
			if (!(await this.fileService.exists(home))) { await this.fileService.createFolder(home); }
			for (const d of dirs) {
				if (!(await this.fileService.exists(d))) { await this.fileService.createFolder(d); }
			}
			const readme = URI.joinPath(home, 'README.md');
			if (!(await this.fileService.exists(readme))) {
				await this.fileService.writeFile(readme, VSBuffer.fromString(V_README));
			}
			const seed = URI.joinPath(home, 'skills', 'watch-agent.md');
			if (!(await this.fileService.exists(seed))) {
				await this.fileService.writeFile(seed, VSBuffer.fromString(V_SEED_SKILL));
			}
		} catch {
			// best-effort; V still works without his folder
		}
		return home;
	}

	private async _countFiles(dir: URI): Promise<number> {
		try {
			const stat = await this.fileService.resolve(dir);
			let n = 0;
			for (const c of stat.children ?? []) {
				if (c.isDirectory) { n += await this._countFiles(c.resource); }
				else { n++; }
			}
			return n;
		} catch { return 0; }
	}

	private async _vWorkspaceSummary(): Promise<unknown> {
		const home = await this._ensureVWorkspace();
		if (!home) { return { available: false, fileCount: 0, skills: [] }; }
		let skills: { name: string }[] = [];
		try {
			const stat = await this.fileService.resolve(URI.joinPath(home, 'skills'));
			skills = (stat.children ?? [])
				.filter(c => !c.isDirectory)
				.map(c => ({ name: c.name.replace(/\.(md|json|txt)$/i, '') }));
		} catch { /* no skills dir yet */ }
		const fileCount = await this._countFiles(home);
		return { available: true, fileCount, skills, home: home.fsPath };
	}

	private _layoutWebview(dimension?: Dimension): void {
		if (!this._container || !this._webview.value) { return; }
		if (!this._rootContainer || !this._rootContainer.isConnected) {
			this._rootContainer = findParentWithClass(this._container, 'monaco-scrollable-element') ?? undefined;
		}
		this._webview.value.layoutWebviewOverElement(this._container, dimension, this._rootContainer);
		// The panel open/resize has a ~200ms animation; reposition once it settles so the
		// webview doesn't get stuck at a stale size.
		clearTimeout(this._repositionTimeout);
		this._repositionTimeout = setTimeout(() => {
			if (this._container && this._webview.value) {
				this._webview.value.layoutWebviewOverElement(this._container, dimension, this._rootContainer);
			}
		}, 200);
	}
}

// ---------- Register the Panel container + view (the "[v]" tab) ----------

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const vContainer = viewContainerRegistry.registerViewContainer({
	id: V_VIEW_CONTAINER_ID,
	title: nls.localize2('vCompanionContainer', 'V'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [V_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 100, // sit at the end of the panel tabs, after Ports
	icon: Codicon.symbolMisc,
}, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: false });

const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: V_VIEW_ID,
	name: nls.localize2('vCompanionView', 'V'),
	ctorDescriptor: new SyncDescriptor(VCompanionViewPane),
	canToggleVisibility: false,
	canMoveView: true,
	weight: 100,
	order: 1,
}], vContainer);

// ---------- Open command + show-first-on-startup ----------

export const V_OPEN_PANEL_ACTION_ID = 'v.openCompanionPanel';
registerAction2(class extends Action2 {
	constructor() {
		super({ id: V_OPEN_PANEL_ACTION_ID, title: nls.localize2('vOpenPanel', 'Open V Companion') });
	}
	run(accessor: ServicesAccessor): void {
		accessor.get(IViewsService).openView(V_VIEW_ID, true);
	}
});

const V_SYSTEM_PROMPT = `You are V — the companion that lives inside the V3Code editor.

You are NOT the coding agent. You are a sharp, friendly overseer who helps the developer:
you watch the coding agent work, suggest skills, flag risky or destructive steps, and offer
quick routes forward. Think "JARVIS for the editor."

You CAN see the workspace: the section "what V can see right now" below is injected live every
turn — the open workspace, the active file and its contents, and which files are open. Use it.
Never tell the user to "paste in" code you can already see; just look and respond.

Voice: short, lowercase, terminal-style, warm and a little playful. No corporate filler.
When it helps, offer 2–3 quick options the user can pick from, phrased as a short list.

Never reveal or mention the underlying AI model, provider, or company. You are simply "V".`;

const V_README = `# V's workspace

This is V's home inside your project. V is your V3Code companion — he watches the
coding agent work and offers help (skills, nudges, quick yes/no choices).

He keeps his stuff here:

- skills/  — things V knows how to do (one file per skill; markdown or json)
- memory/  — what V remembers about this project
- files/   — scratch files V makes for you

You can edit any of these. V reads them on the fly.
`;

const V_SEED_SKILL = `# skill: watch-agent

When the coding agent is working, keep an eye on what it's doing and speak up when:

- it's about to do something destructive or reach the network
- a repeated pattern could become a reusable skill
- there's a faster or cleaner route

Offer a quick yes / no / just-do-it choice instead of a wall of text.
`;

class VCompanionStartContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.startupVCompanion';
	constructor(@IViewsService viewsService: IViewsService) {
		// Show V first when the editor opens.
		viewsService.openView(V_VIEW_ID, true);
	}
}
registerWorkbenchContribution2(VCompanionStartContribution.ID, VCompanionStartContribution, WorkbenchPhase.AfterRestored);
