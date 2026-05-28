/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { IAgentPanelService } from './agentPanelService.js';

export const V3CODE_TOGGLE_AGENT_MODE_ID = 'v3code.toggleAgentMode';

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: V3CODE_TOGGLE_AGENT_MODE_ID,
			title: localize2('v3code.toggleAgentMode', 'V3Code: Toggle Agent Mode'),
			category: localize2('v3code.category', 'V3Code'),
			// LayoutControlMenu renders entries as icon buttons in the title-bar
			// layout-control cluster — without an icon the button is invisible.
			icon: Codicon.hubot,
			f1: true,
			toggled: ContextKeyExpr.equals('v3code.agentMode', true),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA,
				weight: KeybindingWeight.WorkbenchContrib,
			},
			menu: [{
				id: MenuId.LayoutControlMenu,
				group: '0_workbench_layout',
				order: 0,
			}],
		});
	}

	run(accessor: ServicesAccessor): void {
		accessor.get(IAgentPanelService).toggle();
	}
});
