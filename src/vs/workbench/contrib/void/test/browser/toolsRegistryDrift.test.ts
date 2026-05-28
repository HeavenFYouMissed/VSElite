/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { builtinTools } from '../../common/prompt/prompts.js';
import { approvalTypeOfBuiltinToolName } from '../../common/toolsServiceTypes.js';

/**
 * Drift guards for the LLM tool registry.
 *
 * The TypeScript mapped types `ValidateBuiltinParams`, `CallBuiltinTool`,
 * `BuiltinToolResultToString` (toolsService.ts) plus the `satisfies` clause on
 * `builtinTools` (prompts.ts) already enforce that every key in
 * `BuiltinToolResultType` has matching entries in all four registries — `tsc`
 * fails the build if those drift apart.
 *
 * What `tsc` does NOT catch — and this test does:
 *  1. An entry in `approvalTypeOfBuiltinToolName` whose key no longer exists in
 *     `builtinTools` (rename / delete leftover). Silently dead approval policy.
 *  2. A `builtinTools` entry registered with empty description or empty param
 *     descriptions. The auto-generated XML tool descriptor is the LLM's only
 *     introduction to most tools — a blank description makes the tool unusable
 *     even though it's wired.
 */
suite('toolsRegistry / drift guards', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const registeredToolNames = Object.keys(builtinTools);

	test('approvalTypeOfBuiltinToolName only references registered tools', () => {
		const registered = new Set(registeredToolNames);
		const orphans: string[] = [];
		for (const name of Object.keys(approvalTypeOfBuiltinToolName)) {
			if (!registered.has(name)) {
				orphans.push(name);
			}
		}
		assert.deepStrictEqual(orphans, [], `approvalTypeOfBuiltinToolName lists tools that no longer exist in builtinTools (likely a rename/delete leftover): ${orphans.join(', ')}`);
	});

	test('every registered tool has a non-empty description', () => {
		const empty: string[] = [];
		for (const name of registeredToolNames) {
			const info = (builtinTools as Record<string, { description?: string }>)[name];
			if (!info || typeof info.description !== 'string' || info.description.trim().length === 0) {
				empty.push(name);
			}
		}
		assert.deepStrictEqual(empty, [], `Tools registered without a description — the LLM has nothing to read: ${empty.join(', ')}`);
	});

	test('every registered tool param has a non-empty description', () => {
		const offenders: string[] = [];
		for (const name of registeredToolNames) {
			const info = (builtinTools as Record<string, { params?: Record<string, { description?: string }> }>)[name];
			const params = info?.params;
			if (!params) continue;
			for (const paramName of Object.keys(params)) {
				const desc = params[paramName]?.description;
				if (typeof desc !== 'string' || desc.trim().length === 0) {
					offenders.push(`${name}.${paramName}`);
				}
			}
		}
		assert.deepStrictEqual(offenders, [], `Tool params registered without a description — the LLM won't know what to pass: ${offenders.join(', ')}`);
	});
});
