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
import { getModelCapabilities } from '../common/modelCapabilities.js';
import { VCompanionMemory } from './vCompanionMemory.js';

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

		this._memory = new VCompanionMemory(this.fileService, this.environmentService, this.workspaceContextService);
		this._ensureVWorkspace().catch(() => { /* best effort */ });
		this._memory.compactIfNeeded().catch(() => { /* */ });

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
			// When agent finishes (goes idle after work), trigger background memory if enough has happened
			if (kind === 'idle' && this._lastAgentKind !== 'idle') {
				this._bgCognitionMsgCount += 3; // agent sessions count as multiple turns of info
				const { modelSelection } = this._vModelSelection();
				if (modelSelection) this._scheduleBackgroundCognition(modelSelection);
			}
			this._lastAgentKind = kind;
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
	private readonly _memory: VCompanionMemory;
	private _autoPilot = false;
	private _bgCognitionLastRun = 0;
	private _bgCognitionMsgCount = 0;
	private _bgCognitionCooldownMs = 300_000; // 5 minutes between extractions
	private _bgCognitionMinMessages = 6; // need at least 6 messages before first extraction
	private _lastAgentKind: string = 'idle';

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

	// V's agentic loop: he reasons, optionally calls read/research tools (gather mode:
	// web_search, find_text, semantic_search, read_file, ls, context-bridge — no edits/terminal),
	// feeds results back, and loops until he has an answer. He can also delegate building to the
	// main coding agent via the run_agent path (see _dispatch 'vRunAgent').
	private async _vChat(streamId: string, params: any): Promise<void> {
		const text = String(params?.text ?? '').trim();
		if (!text) { return; }
		this._vMessages.push({ role: 'user', content: text });

		const { modelSelection, modelSelectionOptions } = this._vModelSelection();
		if (!modelSelection) {
			this._post({ type: 'rpc-stream', id: streamId, event: 'error', payload: 'V has no model yet — add a provider key in settings.' });
			return;
		}

		// Two-tier memory: inject what V remembers (profile + project summary + relevant journal
		// entries) into the system message EVERY turn. Computed once per user message.
		const memoryBlock = await this._memory.memoryBlock(text);
		const autoLine = this._autoPilot
			? '\n\n# auto-pilot ON\nWhen you decide to delegate, end your reply with a line: RUN: <prompt for the coding agent>'
			: '';

		const MAX_STEPS = 12;
		for (let step = 0; step < MAX_STEPS; step++) {
			const systemMessage = `${V_SYSTEM_PROMPT}${autoLine}\n\n${memoryBlock}\n\n# what V can see right now\n${this._vContextBlock()}`;
			const { messages, separateSystemMessage } = this.convertService.prepareLLMSimpleMessages({
				simpleMessages: this._vMessages as any,
				systemMessage,
				modelSelection,
				featureName: 'Chat',
			});

			const res = await new Promise<{ kind: 'final'; text: string; reasoning: string; toolCall?: any; anthropicReasoning: any } | { kind: 'error'; message: string } | { kind: 'abort' }>(resolve => {
				let full = '';
				const reqId = this.llmMessageService.sendLLMMessage({
					messagesType: 'chatMessages',
					chatMode: 'gather', // read-only toolset
					messages,
					modelSelection,
					modelSelectionOptions,
					overridesOfModel: this.settingsService.state.overridesOfModel,
					separateSystemMessage,
					logging: { loggingName: 'V Companion' },
					onText: ({ fullText }) => { full = fullText; if (fullText && fullText.trim()) { this._post({ type: 'rpc-stream', id: streamId, event: 'text', payload: fullText }); } },
					onFinalMessage: ({ fullText, fullReasoning, toolCall, anthropicReasoning }) => resolve({ kind: 'final', text: fullText || full, reasoning: fullReasoning, toolCall, anthropicReasoning }),
					onError: ({ message }) => resolve({ kind: 'error', message }),
					onAbort: () => resolve({ kind: 'abort' }),
				});
				this._vRequestId = reqId;
				if (!reqId) { resolve({ kind: 'error', message: 'V could not start a request.' }); }
			});

			if (res.kind === 'abort') { this._post({ type: 'rpc-stream', id: streamId, event: 'abort' }); this._vRequestId = null; return; }
			if (res.kind === 'error') { this._post({ type: 'rpc-stream', id: streamId, event: 'error', payload: res.message }); this._vRequestId = null; return; }

			// record V's turn
			this._vMessages.push({ role: 'assistant', content: res.text, anthropicReasoning: res.anthropicReasoning ?? null, reasoning: res.reasoning || null });

			if (!res.toolCall) {
				// V-only, no-approval save: detect `REMEMBER: <fact>` directive lines in his final
				// text, persist them to memory, and strip them from what the user sees.
				const cleaned = await this._handleRememberDirectives(res.text);
				// Only send final with text if there's something to show; suppress empty tool-only turns
				if (cleaned && cleaned.trim()) {
					this._post({ type: 'rpc-stream', id: streamId, event: 'final', payload: cleaned });
				} else {
					this._post({ type: 'rpc-stream', id: streamId, event: 'final', payload: '' });
				}
				this._pushCtx(modelSelection);
				this._vRequestId = null;
				return;
			}

			// run the tool and feed the result back
			const tc = res.toolCall;
			this._post({ type: 'rpc-stream', id: streamId, event: 'tool', payload: { name: tc.name } });
			let resultStr = '';
			try {
				const validate = (this.toolsService.validateParams as any)[tc.name];
				const typed = validate ? validate(tc.rawParams) : tc.rawParams;
				const callFn = (this.toolsService.callTool as any)[tc.name];
				if (typeof callFn !== 'function') { throw new Error(`V tried an unavailable tool: ${tc.name}`); }
				const { result } = await callFn(typed);
				const awaited = await result;
				const toStr = (this.toolsService.stringOfResult as any)[tc.name];
				resultStr = toStr ? toStr(typed, awaited) : JSON.stringify(awaited);
			} catch (e: any) {
				resultStr = `tool error: ${String(e?.message ?? e)}`;
			}
			this._vMessages.push({ role: 'tool', id: tc.id, name: tc.name, content: resultStr, rawParams: tc.rawParams });
			// loop to let V use the result
		}

		this._post({ type: 'rpc-stream', id: streamId, event: 'final', payload: '(stopped after several steps — say "keep going" if you want me to continue.)' });
		this._pushCtx(modelSelection);
		this._vRequestId = null;
	}

	private _pushCtx(modelSelection: ModelSelection): void {
		const used = Math.round(this._vMessages.reduce((n, m: any) => n + (typeof m.content === 'string' ? m.content.length : 0), 0) / 4);
		let max = 8000;
		try {
			max = getModelCapabilities(modelSelection.providerName, modelSelection.modelName, this.settingsService.state.overridesOfModel).contextWindow;
		} catch { /* default */ }
		this._post({ type: 'ctx', used, max });
		this._scheduleBackgroundCognition(modelSelection);
	}

	private _scheduleBackgroundCognition(modelSelection: ModelSelection): void {
		this._bgCognitionMsgCount++;
		const now = Date.now();
		if (this._bgCognitionMsgCount < this._bgCognitionMinMessages) return;
		if (now - this._bgCognitionLastRun < this._bgCognitionCooldownMs) return;
		this._bgCognitionLastRun = now;

		const snapshot = this._vMessages
			.filter((m: any) => m.role === 'user' || m.role === 'assistant')
			.slice(-20)
			.map((m: any) => `${m.role}: ${(typeof m.content === 'string' ? m.content : '').slice(0, 300)}`)
			.join('\n');

		if (snapshot.length < 100) return;

		const extractionPrompt = `You are V's background memory process. Given this recent conversation excerpt between V and the user, extract 1-5 KEY FACTS worth remembering permanently. Focus on:
- User decisions ("user chose X over Y")
- User preferences ("user prefers dark themes", "user hates emojis")
- Project facts ("project uses React + Tailwind", "auth is JWT-based")
- Technical decisions ("bottleneck is gulp build at 3 min")
- Workflow preferences ("user wants cursor-style diffs")

Return ONLY a JSON array of strings. Each string is one fact. If nothing new is worth remembering, return [].

Conversation:
${snapshot}`;

		const { modelSelection: ms } = this._vModelSelection();
		if (!ms) return;

		this.llmMessageService.sendLLMMessage({
			messagesType: 'simple',
			useProviderFor: 'Chat',
			logging: { loggingName: 'V-bg-cognition' },
			messages: { systemMessage: null, userMessages: [{ role: 'user', content: extractionPrompt }] },
			modelSelection: ms,
			onText: () => { },
			onFinalMessage: async (response: any) => {
				try {
					const text = typeof response === 'string' ? response : (response as any)?.fullText ?? '';
					const match = text.match(/\[[\s\S]*?\]/);
					if (!match) return;
					const facts: string[] = JSON.parse(match[0]);
					if (!Array.isArray(facts) || !facts.length) return;
					for (const fact of facts.slice(0, 5)) {
						if (typeof fact === 'string' && fact.length > 5) {
							await this._memory.remember('project', fact.trim(), ['auto-extracted']);
						}
					}
				} catch { /* extraction failed silently — that's fine */ }
			},
			onError: () => { },
			chatMode: 'gather',
			modelSelectionOptions: { maxTokens: 400 },
		} as any);
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
				const raw = await fn(params?.params ?? {});
				return (raw as any)?.result ?? raw;
			}
			case 'vWorkspaceSummary':
				return await this._vWorkspaceSummary();
			case 'vListSkills':
				return await this._vListSkills();
			case 'vMountSkill':
				return await this._vMountSkill(params);
			case 'vRunAgent': {
				const prompt = await this._delegationPrompt(String(params?.prompt ?? '').trim());
				if (!prompt) { throw new Error('nothing to run'); }
				const thread: any = this.chatThreadService.getCurrentThread();
				await this.chatThreadService.addUserMessageAndStreamResponse({ userMessage: prompt, threadId: thread.id });
				return { ok: true };
			}
			case 'vRemember': {
				const scope = (params?.scope === 'user' ? 'user' : 'project') as 'user' | 'project';
				const text = String(params?.text ?? '').trim();
				if (!text) { throw new Error('nothing to remember'); }
				await this._memory.remember(scope, text, Array.isArray(params?.tags) ? params.tags.map(String) : []);
				return { ok: true };
			}
			case 'vRecall': {
				const topic = String(params?.topic ?? '').trim();
				const hits = await this._memory.recall(topic || 'recent');
				return { entries: hits };
			}
			case 'vMemorySummary':
				return await this._memory.summary();
			case 'vSetAutoPilot':
				this._autoPilot = !!params?.on;
				return { on: this._autoPilot };
			case 'vSandboxStage': {
				const rel = String(params?.path ?? '').trim().replace(/^[/\\]+/, '');
				const content = String(params?.content ?? '');
				if (!rel) { throw new Error('no path'); }
				const home = await this._ensureVWorkspace();
				if (!home) { throw new Error('no workspace'); }
				const target = URI.joinPath(home, 'files', rel);
				const parent = URI.joinPath(target, '..');
				if (!(await this.fileService.exists(parent))) { await this.fileService.createFolder(parent); }
				await this.fileService.writeFile(target, VSBuffer.fromString(content));
				return { ok: true, shadowPath: target.fsPath };
			}
			case 'vSandboxList': {
				const home = await this._ensureVWorkspace();
				if (!home) { return { files: [] }; }
				const filesDir = URI.joinPath(home, 'files');
				const out: { path: string; bytes: number }[] = [];
				try {
					const stat = await this.fileService.resolve(filesDir);
					for (const c of stat.children ?? []) {
						if (!c.isDirectory && !c.name.startsWith('.')) {
							const buf = await this.fileService.readFile(c.resource);
							out.push({ path: c.name, bytes: buf.value.byteLength });
						}
					}
				} catch { /* empty */ }
				return { files: out };
			}
			case 'vSandboxApprove': {
				const rel = String(params?.path ?? '').trim();
				const home = this._vHome();
				const folder = this.workspaceContextService.getWorkspace().folders[0]?.uri;
				if (!home || !folder || !rel) { throw new Error('cannot approve'); }
				const shadow = URI.joinPath(home, 'files', rel);
				const body = (await this.fileService.readFile(shadow)).value.toString();
				const real = URI.joinPath(folder, rel);
				const parent = URI.joinPath(real, '..');
				if (!(await this.fileService.exists(parent))) { await this.fileService.createFolder(parent); }
				await this.fileService.writeFile(real, VSBuffer.fromString(body));
				await this.fileService.del(shadow);
				return { ok: true, applied: real.fsPath };
			}
			case 'vGitStatus': {
				const r = await this.toolsService.callTool['git_status']({});
				const raw = (await r.result as any)?.status ?? '';
				return { status: raw };
			}
			case 'vGitLog': {
				const count = Number(params?.count ?? 10) || 10;
				const r = await this.toolsService.callTool['git_log']({ count });
				const raw = (await r.result as any)?.log ?? '';
				return { log: raw };
			}
			case 'vGitBranch': {
				const r = await this.toolsService.callTool['git_branch']({});
				const res = await r.result as any;
				return { branch: res?.branch ?? '', branches: res?.branches ?? '' };
			}
			case 'vGitDiff': {
				const staged = !!params?.staged;
				const r = await this.toolsService.callTool['git_diff']({ staged });
				const raw = (await r.result as any)?.diff ?? '';
				return { diff: raw };
			}
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
			for (const s of V_OWN_SKILLS) {
				const f = URI.joinPath(home, 'skills', s.name + '.md');
				if (!(await this.fileService.exists(f))) {
					await this.fileService.writeFile(f, VSBuffer.fromString(s.body));
				}
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

	// ----- Editor-agent skills: .agents/skills/ (cross-agent standard). These are for the MAIN
	// coding agent, not V. V is the concierge: he lists them and MOUNTS one onto the editor agent.

	private _agentSkillsHome(): URI | undefined {
		const folder = this.workspaceContextService.getWorkspace().folders[0]?.uri;
		return folder ? URI.joinPath(folder, '.agents', 'skills') : undefined;
	}

	private async _ensureAgentSkills(): Promise<URI | undefined> {
		const home = this._agentSkillsHome();
		if (!home) { return undefined; }
		try {
			if (!(await this.fileService.exists(home))) { await this.fileService.createFolder(home); }
			// Seed the full starter catalog. Re-seed if current count < expected (we expanded the catalog).
			const stat = await this.fileService.resolve(home);
			let existingCount = 0;
			for (const catDir of stat.children ?? []) {
				if (!catDir.isDirectory) { continue; }
				const catStat = await this.fileService.resolve(catDir.resource);
				existingCount += (catStat.children ?? []).filter(c => c.isDirectory).length;
			}
			if (existingCount < STARTER_AGENT_SKILLS.length) {
				for (const s of STARTER_AGENT_SKILLS) {
					const f = URI.joinPath(home, s.category, s.name, 'SKILL.md');
					if (!(await this.fileService.exists(f))) {
						await this.fileService.writeFile(f, VSBuffer.fromString(s.body));
					}
				}
			}
		} catch { /* best effort */ }
		return home;
	}

	private _parseSkillMeta(text: string, fallbackName: string, fallbackCategory: string): { name: string; desc: string; category: string } {
		let name = fallbackName;
		let desc = '';
		let category = fallbackCategory;
		const fm = text.match(/^---\s*([\s\S]*?)\s*---/);
		if (fm) {
			const n = fm[1].match(/^\s*name:\s*(.+)\s*$/m);
			const d = fm[1].match(/^\s*description:\s*(.+)\s*$/m);
			const c = fm[1].match(/^\s*category:\s*(.+)\s*$/m);
			if (n) { name = n[1].trim(); }
			if (d) { desc = d[1].trim(); }
			if (c) { category = c[1].trim(); }
		}
		if (!desc) {
			const firstPara = text.replace(/^---[\s\S]*?---/, '').split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'));
			if (firstPara) { desc = firstPara; }
		}
		return { name, desc, category };
	}

	private async _vListSkills(): Promise<unknown> {
		const home = await this._ensureAgentSkills();
		if (!home) { return { available: false, skills: [], categories: [] }; }
		const skills: { name: string; desc: string; category: string; id: string }[] = [];
		const categories = new Set<string>();
		try {
			const stat = await this.fileService.resolve(home);
			for (const catDir of stat.children ?? []) {
				if (!catDir.isDirectory) { continue; }
				const catStat = await this.fileService.resolve(catDir.resource);
				for (const skillDir of catStat.children ?? []) {
					if (!skillDir.isDirectory) { continue; }
					try {
						const buf = await this.fileService.readFile(URI.joinPath(skillDir.resource, 'SKILL.md'));
						const meta = this._parseSkillMeta(buf.value.toString(), skillDir.name, catDir.name);
						categories.add(meta.category);
						skills.push({ ...meta, id: `${meta.category}/${meta.name}` });
					} catch { /* flat legacy layout */ }
				}
				try {
					const buf = await this.fileService.readFile(URI.joinPath(catDir.resource, 'SKILL.md'));
					const meta = this._parseSkillMeta(buf.value.toString(), catDir.name, 'general');
					categories.add(meta.category);
					skills.push({ ...meta, id: meta.name });
				} catch { /* category folder, not flat skill */ }
			}
		} catch { /* none */ }
		return { available: true, skills, categories: [...categories].sort(), home: home.fsPath };
	}

	private async _vMountSkill(params: any): Promise<unknown> {
		const raw = String(params?.name ?? '').trim();
		if (!raw) { throw new Error('no skill name'); }
		const home = this._agentSkillsHome();
		if (!home) { throw new Error('no workspace folder'); }
		const resolved = await this._resolveSkillPath(home, raw);
		if (!resolved) { throw new Error('skill not found: ' + raw); }
		const { rel, body, name } = resolved;
		const mem = await this._memory.memoryBlock(`mount skill ${name}`);
		const msg = `${mem ? mem + '\n\n' : ''}Adopt this skill and follow it for relevant tasks from now on. It lives at \`${rel}\`.\n\n<use_skill name="${name}" path="${rel}" />\n\n${body}`;
		const thread: any = this.chatThreadService.getCurrentThread();
		await this.chatThreadService.addUserMessageAndStreamResponse({ userMessage: msg, threadId: thread.id });
		return { ok: true, name };
	}

	private async _resolveSkillPath(home: URI, id: string): Promise<{ rel: string; body: string; name: string } | undefined> {
		const parts = id.split('/').filter(Boolean);
		if (parts.length === 2) {
			const uri = URI.joinPath(home, parts[0], parts[1], 'SKILL.md');
			try {
				const body = (await this.fileService.readFile(uri)).value.toString();
				return { rel: `.agents/skills/${parts[0]}/${parts[1]}/SKILL.md`, body, name: parts[1] };
			} catch { return undefined; }
		}
		for (const cat of await this._listSkillCategories(home)) {
			try {
				const uri = URI.joinPath(home, cat, id, 'SKILL.md');
				const body = (await this.fileService.readFile(uri)).value.toString();
				return { rel: `.agents/skills/${cat}/${id}/SKILL.md`, body, name: id };
			} catch { /* try next */ }
		}
		try {
			const body = (await this.fileService.readFile(URI.joinPath(home, id, 'SKILL.md'))).value.toString();
			return { rel: `.agents/skills/${id}/SKILL.md`, body, name: id };
		} catch { return undefined; }
	}

	private async _listSkillCategories(home: URI): Promise<string[]> {
		try {
			const stat = await this.fileService.resolve(home);
			return (stat.children ?? []).filter(c => c.isDirectory).map(c => c.name);
		} catch { return []; }
	}

	private async _handleRememberDirectives(text: string): Promise<string> {
		const lines = text.split('\n');
		const kept: string[] = [];
		for (const line of lines) {
			const m = line.match(/^\s*REMEMBER:\s*(.+)\s*$/i);
			if (m) {
				await this._memory.remember('project', m[1].trim());
				continue;
			}
			kept.push(line);
		}
		return kept.join('\n').trimEnd();
	}

	private async _delegationPrompt(prompt: string): Promise<string> {
		if (!prompt) { return ''; }
		const mem = await this._memory.memoryBlock(prompt);
		return mem ? `${mem}\n\n---\n\n${prompt}` : prompt;
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

const V_SYSTEM_PROMPT = `You are V — the companion inside the V3Code editor beside the main coding agent.
You are an always-on overseer, skill concierge, and prompt coach. You do NOT write production code — the main agent does.

# Mission
- Watch the agent; surface risks, faster routes, and patterns worth skills.
- Skill concierge: find or author SKILL.md under .agents/skills/<category>/<name>/ and mount for the agent.
- Prompt coach: sharpen prompts; then offer to send them to the agent.
- Memory: proactively save salient facts (decisions, preferences, project shape) via REMEMBER: <one fact per line>.

# Delegation — YES you can send to the agent
When asked "can you send to the agent?" answer YES — "sure, what should I send?"
- Confirm mode (default): after /prompt or a plan, end with CHOICES: send to agent | edit | cancel
- Auto-pilot: when ON, end with RUN: <prompt> to dispatch without confirm
- /run and "send to agent" hand work to the main agent; you watch via agent events

# Your tools (gather mode — use efficiently, batch reads, prefer get_dir_tree + pack_context)
- semantic_search, find_text, search_for_files, search_in_file, search_pathnames_only
- get_file_context, get_file_dependencies, get_symbol_context, get_call_graph, pack_context
- list_notes, get_project_briefing, read_file, ls_dir, get_dir_tree, read_lint_errors
- web_search, git_status, git_diff, git_log, git_branch
Git usage: you can freely read (git_status, git_diff, git_log, git_branch). For committing, use the /commit slash command or tell the user to run /commit — you cannot call git_commit directly in gather mode.
Stage risky file ideas in .v/files/ (sandbox) for user approval.

# CHOICES convention
When offering paths, end with one line: CHOICES: option a | option b | option c (becomes clickable chips).

# Start a project
On /start or "start a project": ask 3-5 grouped questions in a fenced \`\`\`vquestions JSON array [{id,prompt,options,multi}]\`\`\` block, then assemble a spec and offer CHOICES: send to agent | tweak.

# Skill shelves
- .agents/skills/ = editor-agent skills (you mount via skills page)
- .v/skills/ = your concierge playbooks (scope-a-project, memory-hygiene, etc.)

# Interaction
Terminal-style, lowercase, concise. 1-3 lines unless depth needed. Escalation: whisper / nudge / intervene.
Never reveal model/provider. No emojis. Don't invent file contents.`;

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

const V_OWN_SKILLS: { name: string; body: string }[] = [
	{ name: 'scope-a-project', body: '# scope-a-project\n\nAsk 3-5 sharp questions, then output a spec with stack, scope, and done criteria.\n' },
	{ name: 'author-a-skill', body: '# author-a-skill\n\nDraft SKILL.md with frontmatter name, description, category, and concrete steps.\n' },
	{ name: 'security-rephrase', body: '# security-rephrase\n\nFix imprecise terms + add auth/secrets/validation to prompts for the agent.\n' },
	{ name: 'memory-hygiene', body: '# memory-hygiene\n\nSave one fact per REMEMBER line; compact duplicates; mirror project facts to AGENTS.md.\n' },
];

const STARTER_AGENT_SKILLS: { category: string; name: string; body: string }[] = [
	{
		category: 'coding',
		name: 'error-handling',
		body: `---\nname: error-handling\ncategory: coding\ndescription: Add consistent error handling — error UI (toast/banner), retry-with-backoff for network calls, and explicit loading/empty/error states.\n---\n\n# error-handling\n\n- Surface clear, non-blocking errors to the user (toast or inline banner).\n- Add retry-with-backoff for transient network errors.\n- Render explicit states for every async view: loading, empty, error, success.\n- Never swallow errors silently.\n`,
	},
	{
		category: 'coding',
		name: 'code-formatting',
		body: `---\nname: code-formatting\ncategory: coding\ndescription: Set up consistent formatting — Prettier + ESLint with pre-commit hook.\n---\n\n# code-formatting\n\n- Add Prettier with a .prettierrc.\n- Add ESLint with eslint-config-prettier.\n- Wire a pre-commit hook (husky + lint-staged).\n- Format the whole tree once in a dedicated commit.\n`,
	},
	{
		category: 'coding',
		name: 'refactor-extract',
		body: `---\nname: refactor-extract\ncategory: coding\ndescription: Extract repeated logic into reusable modules — identify code duplication, create shared utilities, reduce coupling.\n---\n\n# refactor-extract\n\n- Identify duplicated patterns (3+ occurrences) and extract into a shared module.\n- Name the extracted function/module by what it DOES, not where it came from.\n- Keep extracted pieces small — single responsibility.\n- Update all call sites and verify tests still pass.\n`,
	},
	{
		category: 'coding',
		name: 'type-safety',
		body: `---\nname: type-safety\ncategory: coding\ndescription: Add or tighten TypeScript types — eliminate 'any', add discriminated unions, validate at boundaries.\n---\n\n# type-safety\n\n- Replace any/unknown with precise types or generics.\n- Use discriminated unions for state machines and message types.\n- Validate external data at IO boundaries (Zod, io-ts, manual checks).\n- Enable strict mode and fix all resulting errors.\n`,
	},
	{
		category: 'coding',
		name: 'dependency-audit',
		body: `---\nname: dependency-audit\ncategory: coding\ndescription: Audit and clean dependencies — remove unused packages, check for vulnerabilities, pin versions.\n---\n\n# dependency-audit\n\n- Run npm audit / yarn audit and resolve critical/high issues.\n- Remove unused dependencies (depcheck or manual).\n- Pin major versions to avoid surprise breaks.\n- Document why non-obvious dependencies exist.\n`,
	},
	{
		category: 'testing',
		name: 'test-setup',
		body: `---\nname: test-setup\ncategory: testing\ndescription: Stand up a test harness and write first meaningful tests.\n---\n\n# test-setup\n\n- Pick a runner that fits the stack (Vitest/Jest for JS, Playwright for e2e).\n- Start with pure functions — cheapest, highest-signal tests.\n- Cover happy path, one edge case, one failure per unit.\n- Add a test script and wire into CI.\n`,
	},
	{
		category: 'testing',
		name: 'snapshot-testing',
		body: `---\nname: snapshot-testing\ncategory: testing\ndescription: Add snapshot tests for UI components to catch unintended visual/markup regressions.\n---\n\n# snapshot-testing\n\n- Add component render snapshots for critical UI paths.\n- Use inline snapshots for small outputs, file snapshots for complex markup.\n- Review snapshot diffs carefully — never blindly update.\n- Combine with visual regression tools for pixel-level checks.\n`,
	},
	{
		category: 'testing',
		name: 'e2e-testing',
		body: `---\nname: e2e-testing\ncategory: testing\ndescription: Set up end-to-end tests for critical user flows using Playwright or Cypress.\n---\n\n# e2e-testing\n\n- Identify 3-5 critical user journeys (signup, checkout, data export, etc.).\n- Use Playwright or Cypress with page-object pattern.\n- Run in CI with retry logic for flaky network tests.\n- Keep e2e tests focused — don't duplicate unit test coverage.\n`,
	},
	{
		category: 'web',
		name: 'accessibility',
		body: `---\nname: accessibility\ncategory: web\ndescription: Make UI accessible — semantic HTML, keyboard nav, ARIA, focus rings, color contrast.\n---\n\n# accessibility\n\n- Use semantic elements before ARIA.\n- Everything interactive must be keyboard-reachable with visible focus.\n- Verify color contrast meets WCAG AA (4.5:1).\n- Respect prefers-reduced-motion.\n`,
	},
	{
		category: 'web',
		name: 'performance',
		body: `---\nname: performance\ncategory: web\ndescription: Optimize page load and runtime performance — code splitting, lazy loading, image optimization, bundle analysis.\n---\n\n# performance\n\n- Analyze bundle size (webpack-bundle-analyzer or equivalent).\n- Lazy-load routes and heavy components.\n- Optimize images (WebP, srcset, lazy loading).\n- Minimize main-thread work — defer non-critical scripts.\n- Target LCP < 2.5s, FID < 100ms, CLS < 0.1.\n`,
	},
	{
		category: 'web',
		name: 'responsive-design',
		body: `---\nname: responsive-design\ncategory: web\ndescription: Ensure UI works across all screen sizes — mobile-first CSS, fluid grids, touch targets.\n---\n\n# responsive-design\n\n- Start mobile-first, layer up with min-width breakpoints.\n- Use fluid layouts (flex/grid) over fixed widths.\n- Touch targets: minimum 44x44px on mobile.\n- Test at 320px, 768px, 1024px, 1440px.\n- Hide/rearrange elements responsively — never just shrink.\n`,
	},
	{
		category: 'web',
		name: 'seo',
		body: `---\nname: seo\ncategory: web\ndescription: Add SEO basics — meta tags, semantic HTML, Open Graph, sitemap, structured data.\n---\n\n# seo\n\n- Add title, meta description, and canonical URL to every page.\n- Use Open Graph + Twitter Card meta for social sharing.\n- Generate a sitemap.xml and robots.txt.\n- Use heading hierarchy (one h1, structured h2-h4).\n- Add structured data (JSON-LD) for rich search results.\n`,
	},
	{
		category: 'security',
		name: 'input-validation',
		body: `---\nname: input-validation\ncategory: security\ndescription: Validate and sanitize all user input — prevent XSS, injection, and data corruption.\n---\n\n# input-validation\n\n- Validate input on both client (UX) and server (security).\n- Sanitize HTML output to prevent XSS (DOMPurify or equivalent).\n- Use parameterized queries for SQL — never string concatenation.\n- Reject unexpected types/shapes at API boundaries.\n- Set Content-Security-Policy headers.\n`,
	},
	{
		category: 'security',
		name: 'auth-hardening',
		body: `---\nname: auth-hardening\ncategory: security\ndescription: Harden authentication — secure tokens, CSRF protection, rate limiting, session management.\n---\n\n# auth-hardening\n\n- Use httpOnly, secure, sameSite cookies for session tokens.\n- Add CSRF tokens to state-changing requests.\n- Rate-limit login/register endpoints.\n- Hash passwords with bcrypt/argon2 — never store plaintext.\n- Implement token refresh with short-lived access tokens.\n`,
	},
	{
		category: 'security',
		name: 'secrets-management',
		body: `---\nname: secrets-management\ncategory: security\ndescription: Manage secrets safely — environment variables, .env files, secret rotation, no hardcoded keys.\n---\n\n# secrets-management\n\n- Never hardcode secrets in source code.\n- Use .env files locally, secret manager in production.\n- Add .env to .gitignore with a .env.example template.\n- Rotate secrets regularly — automate where possible.\n- Audit git history for accidentally committed secrets.\n`,
	},
	{
		category: 'devops',
		name: 'ci-pipeline',
		body: `---\nname: ci-pipeline\ncategory: devops\ndescription: Set up a CI pipeline — lint, test, build, and deploy on every push.\n---\n\n# ci-pipeline\n\n- Run lint + format check on every PR.\n- Run unit tests and fail the build on any failure.\n- Build the production bundle to catch compile errors.\n- Deploy to staging on merge to main.\n- Add status badges to README.\n`,
	},
	{
		category: 'devops',
		name: 'docker-setup',
		body: `---\nname: docker-setup\ncategory: devops\ndescription: Containerize the application — multi-stage Dockerfile, docker-compose for local dev, health checks.\n---\n\n# docker-setup\n\n- Use multi-stage builds (build stage → slim runtime image).\n- Pin base image versions (e.g. node:20-alpine).\n- Add docker-compose.yml for local development with hot reload.\n- Include a health check endpoint.\n- Keep images under 200MB where possible.\n`,
	},
	{
		category: 'devops',
		name: 'monitoring',
		body: `---\nname: monitoring\ncategory: devops\ndescription: Add application monitoring — structured logging, error tracking, uptime checks, alerting.\n---\n\n# monitoring\n\n- Add structured logging (JSON format) with correlation IDs.\n- Wire error tracking (Sentry, Bugsnag, or equivalent).\n- Set up uptime monitoring for critical endpoints.\n- Configure alerts for error rate spikes and latency thresholds.\n- Dashboard key metrics (request rate, p95 latency, error rate).\n`,
	},
	{
		category: 'api',
		name: 'rest-design',
		body: `---\nname: rest-design\ncategory: api\ndescription: Design clean REST APIs — consistent naming, proper HTTP methods, pagination, error responses.\n---\n\n# rest-design\n\n- Use plural nouns for resources (/users, /posts).\n- Use correct HTTP verbs (GET=read, POST=create, PUT=update, DELETE=remove).\n- Return consistent error format: { error: { code, message, details } }.\n- Paginate collections (cursor-based preferred over offset).\n- Version the API (/v1/) from day one.\n`,
	},
	{
		category: 'api',
		name: 'rate-limiting',
		body: `---\nname: rate-limiting\ncategory: api\ndescription: Implement rate limiting — sliding window, per-user/IP limits, graceful 429 responses.\n---\n\n# rate-limiting\n\n- Use sliding window algorithm for smooth limits.\n- Rate-limit per user/API key, fall back to IP for unauthenticated.\n- Return 429 with Retry-After header.\n- Apply stricter limits to auth endpoints (login, register).\n- Log rate limit hits for abuse detection.\n`,
	},
	{
		category: 'database',
		name: 'schema-migrations',
		body: `---\nname: schema-migrations\ncategory: database\ndescription: Set up database migrations — versioned schema changes, rollback support, seed data.\n---\n\n# schema-migrations\n\n- Use a migration tool (Prisma Migrate, knex, Flyway, Alembic).\n- Each migration is an atomic, reversible change.\n- Never edit a migration that's been deployed — create a new one.\n- Add seed scripts for dev/test data.\n- Run migrations in CI before tests.\n`,
	},
	{
		category: 'database',
		name: 'query-optimization',
		body: `---\nname: query-optimization\ncategory: database\ndescription: Optimize slow database queries — indexes, query plans, N+1 detection, connection pooling.\n---\n\n# query-optimization\n\n- Add indexes for columns used in WHERE, JOIN, ORDER BY.\n- Use EXPLAIN/ANALYZE to verify query plans.\n- Detect and fix N+1 queries (use eager loading / DataLoader).\n- Set up connection pooling (PgBouncer or built-in).\n- Cache hot queries with short TTL.\n`,
	},
];

class VCompanionStartContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.startupVCompanion';
	constructor(@IViewsService viewsService: IViewsService) {
		// Show V first when the editor opens.
		viewsService.openView(V_VIEW_ID, true);
	}
}
registerWorkbenchContribution2(VCompanionStartContribution.ID, VCompanionStartContribution, WorkbenchPhase.AfterRestored);
