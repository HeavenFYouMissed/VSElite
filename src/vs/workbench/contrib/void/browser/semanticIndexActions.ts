/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { ISemanticIndexService } from '../common/semanticIndex/semanticIndexTypes.js';

const CATEGORY = localize2('v3code.category', 'V3Code');

export const REBUILD_INDEX_ID = 'v3code.semanticIndex.rebuild';
export const SHOW_INDEX_STATUS_ID = 'v3code.semanticIndex.showStatus';

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: REBUILD_INDEX_ID,
			title: localize2('v3code.semanticIndex.rebuild.title', 'V3Code: Rebuild Codebase Index'),
			category: CATEGORY,
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const service = accessor.get(ISemanticIndexService);
		const notify = accessor.get(INotificationService);
		notify.info(localize('v3code.semanticIndex.rebuilding', 'V3Code: rebuilding semantic index…'));
		try {
			await service.rebuild();
			const s = service.getStatus();
			notify.info(localize('v3code.semanticIndex.done', 'V3Code: indexed {0} files, {1} chunks.', s.filesIndexed, s.chunksTotal));
		} catch (err: any) {
			notify.error(localize('v3code.semanticIndex.failed', 'V3Code index rebuild failed: {0}', err?.message ?? String(err)));
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: SHOW_INDEX_STATUS_ID,
			title: localize2('v3code.semanticIndex.showStatus.title', 'V3Code: Show Index Status'),
			category: CATEGORY,
			f1: true,
		});
	}
	run(accessor: ServicesAccessor): void {
		const service = accessor.get(ISemanticIndexService);
		const notify = accessor.get(INotificationService);
		const s = service.getStatus();
		notify.info(localize(
			'v3code.semanticIndex.status',
			'V3Code Index — state: {0}, files: {1}/{2}, chunks: {3}, model: {4}',
			s.state, s.filesIndexed, s.filesTotal, s.chunksTotal, s.modelId ?? 'n/a'
		));
	}
});
