/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IEditorCloseEvent, IEditorIdentifier } from '../../../../common/editor.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { URI } from '../../../../../base/common/uri.js';
import { IAgentPanelService, AgentPanelService } from '../../browser/agentPanelService.js';
import { VoidChatEditorInput } from '../../browser/voidChatEditorInput.js';

// Minimal in-memory IEditorService stand-in. Only implements the four members
// AgentPanelService touches: onDidCloseEditor, openEditor, findEditors, closeEditor.
class FakeEditorService {

	readonly _onDidCloseEditor = new Emitter<IEditorCloseEvent>();
	readonly onDidCloseEditor = this._onDidCloseEditor.event;

	openEditors: EditorInput[] = [];
	openCallCount = 0;
	closeCallCount = 0;

	async openEditor(input: EditorInput): Promise<{ input: EditorInput; group: { id: number } } | undefined> {
		this.openCallCount++;
		this.openEditors.push(input);
		return { input, group: { id: 0 } };
	}

	findEditors(resource: URI): readonly IEditorIdentifier[] {
		return this.openEditors
			.filter(e => e.resource?.toString() === resource.toString())
			.map(editor => ({ editor, groupId: 0 } as IEditorIdentifier));
	}

	async closeEditor(identifier: IEditorIdentifier): Promise<void> {
		this.closeCallCount++;
		const idx = this.openEditors.indexOf(identifier.editor);
		if (idx >= 0) {
			this.openEditors.splice(idx, 1);
			this._onDidCloseEditor.fire({ editor: identifier.editor, groupId: 0 } as IEditorCloseEvent);
		}
	}

	// Simulate the user manually closing the editor (e.g. clicking the tab X).
	simulateUserClose(input: EditorInput): void {
		const idx = this.openEditors.indexOf(input);
		if (idx >= 0) {
			this.openEditors.splice(idx, 1);
		}
		this._onDidCloseEditor.fire({ editor: input, groupId: 0 } as IEditorCloseEvent);
	}

	dispose(): void {
		this._onDidCloseEditor.dispose();
	}
}

suite('AgentPanelService', () => {

	const _store = ensureNoDisposablesAreLeakedInTestSuite();

	let store: DisposableStore;
	let instantiationService: TestInstantiationService;
	let fakeEditorService: FakeEditorService;
	let service: IAgentPanelService;

	setup(async () => {
		store = new DisposableStore();
		_store.add(store);

		fakeEditorService = new FakeEditorService();
		store.add({ dispose: () => fakeEditorService.dispose() });

		instantiationService = store.add(new TestInstantiationService());
		instantiationService.stub(IEditorService, fakeEditorService as unknown as IEditorService);

		service = store.add(instantiationService.createInstance(AgentPanelService));
	});

	test('initial mode is chat', () => {
		assert.strictEqual(service.mode, 'chat');
		assert.strictEqual(fakeEditorService.openCallCount, 0);
	});

	test('toggle: chat -> agent opens a chat editor', async () => {
		const modes: string[] = [];
		store.add(service.onDidChangeMode(m => modes.push(m)));

		service.toggle();
		// openEditor is async inside the service; let the microtask queue drain.
		await Promise.resolve();

		assert.strictEqual(service.mode, 'agent');
		assert.deepStrictEqual(modes, ['agent']);
		assert.strictEqual(fakeEditorService.openCallCount, 1);
		assert.strictEqual(fakeEditorService.openEditors.length, 1);
		assert.ok(fakeEditorService.openEditors[0] instanceof VoidChatEditorInput);
	});

	test('toggle: agent -> chat closes the chat editor', async () => {
		service.toggle(); // -> agent
		await Promise.resolve();
		const modes: string[] = [];
		store.add(service.onDidChangeMode(m => modes.push(m)));

		service.toggle(); // -> chat
		await Promise.resolve();

		assert.strictEqual(service.mode, 'chat');
		assert.deepStrictEqual(modes, ['chat']);
		assert.strictEqual(fakeEditorService.openEditors.length, 0);
		assert.ok(fakeEditorService.closeCallCount >= 1);
	});

	test('manual close of chat editor in agent mode flips state back to chat', async () => {
		service.toggle(); // -> agent
		await Promise.resolve();
		assert.strictEqual(service.mode, 'agent');

		const input = fakeEditorService.openEditors[0];
		const modes: string[] = [];
		store.add(service.onDidChangeMode(m => modes.push(m)));

		fakeEditorService.simulateUserClose(input);

		assert.strictEqual(service.mode, 'chat');
		assert.deepStrictEqual(modes, ['chat']);
		// Critical: the flip-back must NOT trigger a recursive closeEditor call
		// (that would loop through onDidCloseEditor again). The _applyEditor=false
		// branch in _setModeInternal guarantees this.
		assert.strictEqual(fakeEditorService.closeCallCount, 0);
	});

	test('open / close / toggle / close / toggle robustness sequence', async () => {
		const modes: string[] = [];
		store.add(service.onDidChangeMode(m => modes.push(m)));

		// open (chat -> agent)
		service.toggle();
		await Promise.resolve();
		assert.strictEqual(service.mode, 'agent');

		// close (manual)
		const firstInput = fakeEditorService.openEditors[0];
		fakeEditorService.simulateUserClose(firstInput);
		assert.strictEqual(service.mode, 'chat');

		// toggle (chat -> agent again)
		service.toggle();
		await Promise.resolve();
		assert.strictEqual(service.mode, 'agent');
		assert.strictEqual(fakeEditorService.openEditors.length, 1);

		// close (manual again)
		fakeEditorService.simulateUserClose(fakeEditorService.openEditors[0]);
		assert.strictEqual(service.mode, 'chat');

		// toggle (chat -> agent third time)
		service.toggle();
		await Promise.resolve();
		assert.strictEqual(service.mode, 'agent');

		assert.deepStrictEqual(modes, ['agent', 'chat', 'agent', 'chat', 'agent']);
		// No recursive close calls — manual closes go through the flip-back branch
		// which skips _applyEditorState.
		assert.strictEqual(fakeEditorService.closeCallCount, 0);
		assert.strictEqual(fakeEditorService.openCallCount, 3);
	});

	test('manual close while already in chat mode is a no-op', async () => {
		const modes: string[] = [];
		store.add(service.onDidChangeMode(m => modes.push(m)));

		// Fire a spurious close event while in chat mode.
		fakeEditorService.simulateUserClose(VoidChatEditorInput.INSTANCE);

		assert.strictEqual(service.mode, 'chat');
		assert.deepStrictEqual(modes, []);
	});

	test('setMode is idempotent', () => {
		service.setMode('chat'); // no change from initial
		assert.strictEqual(fakeEditorService.openCallCount, 0);

		service.setMode('agent');
		assert.strictEqual(service.mode, 'agent');
		const opens = fakeEditorService.openCallCount;

		service.setMode('agent'); // re-set same mode
		assert.strictEqual(fakeEditorService.openCallCount, opens);
	});
});
