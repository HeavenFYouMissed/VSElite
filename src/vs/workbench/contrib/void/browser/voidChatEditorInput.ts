/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Dimension } from '../../../../base/browser/dom.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorExtensions, IUntypedEditorInput } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { mountSidebar } from './react/out/sidebar-tsx/index.js';

export class VoidChatEditorInput extends EditorInput {

	static readonly ID = 'workbench.editor.voidChat';
	static readonly RESOURCE = URI.from({ scheme: 'v3code-agent', authority: 'chat' });
	static readonly INSTANCE = new VoidChatEditorInput();

	override get typeId(): string { return VoidChatEditorInput.ID; }
	override get editorId(): string | undefined { return VoidChatEditorInput.ID; }
	override get resource(): URI | undefined { return VoidChatEditorInput.RESOURCE; }

	override getName(): string {
		return localize('voidChatEditor', 'V3Code Agent');
	}

	override getIcon(): ThemeIcon | undefined {
		return Codicon.symbolMethod;
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) { return true; }
		return other instanceof VoidChatEditorInput;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: VoidChatEditorInput.RESOURCE,
			options: { override: VoidChatEditorInput.ID, pinned: true }
		};
	}
}

export class VoidChatEditorPane extends EditorPane {

	static readonly ID = 'workbench.editor.voidChatPane';

	private container: HTMLElement | undefined;
	private mountDispose: (() => void) | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super(VoidChatEditorPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		parent.style.width = '100%';
		parent.style.height = '100%';
		parent.style.userSelect = 'text';
		this.container = parent;

		this.instantiationService.invokeFunction(accessor => {
			const mounted = mountSidebar(parent, accessor);
			this.mountDispose = mounted?.dispose;
		});
	}

	override layout(dimension: Dimension): void {
		if (!this.container) { return; }
		this.container.style.width = `${dimension.width}px`;
		this.container.style.height = `${dimension.height}px`;
	}

	override dispose(): void {
		this.mountDispose?.();
		this.mountDispose = undefined;
		super.dispose();
	}
}

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		VoidChatEditorPane,
		VoidChatEditorPane.ID,
		localize('voidChatEditor', 'V3Code Agent')
	),
	[
		new SyncDescriptor(VoidChatEditorInput)
	]
);
