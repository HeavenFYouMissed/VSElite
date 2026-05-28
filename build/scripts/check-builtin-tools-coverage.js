// @ts-check
/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Stub-on-decl coverage check.
//
// Every key declared in `BuiltinToolResultType` (common/toolsServiceTypes.ts) MUST appear in:
//   1. `builtinTools` registry (common/prompt/prompts.ts) — LLM schema
//   2. `this.callTool = { ... }`     (browser/toolsService.ts) — executor
//   3. `this.stringOfResult = { ... }` (browser/toolsService.ts) — formatter
//
// Phase B.1 added the result types but didn't wire registrations/executors; the breakage
// only surfaced when someone read TypeScript strict-compile errors. This script makes
// the drift visible at hygiene-check time and fails CI when it happens again.
//
// Pure-regex parsing — no TypeScript compiler dependency. Stable enough for the
// curly-brace style we use; if someone introduces dynamically-keyed entries this script
// becomes a guard rail, not a sealed door.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TYPES_FILE = path.join(ROOT, 'src/vs/workbench/contrib/void/common/toolsServiceTypes.ts');
const PROMPTS_FILE = path.join(ROOT, 'src/vs/workbench/contrib/void/common/prompt/prompts.ts');
const TOOLS_SERVICE_FILE = path.join(ROOT, 'src/vs/workbench/contrib/void/browser/toolsService.ts');

/**
 * Find a `{ ... }` block following a header line and return its body content
 * (between the outermost braces). Honors nested braces and string literals so
 * a `{` inside a string or nested object literal doesn't confuse the balance.
 *
 * @param {string} source
 * @param {RegExp} headerRe — must match up to (but not including) the opening `{`.
 *                            Use a `g` flag if you want to call this for multiple blocks.
 * @returns {string | null}
 */
function extractBraceBlock(source, headerRe) {
	const m = headerRe.exec(source);
	if (!m) {
		return null;
	}
	// Find the next `{` after the header match.
	let i = m.index + m[0].length;
	while (i < source.length && source[i] !== '{') {
		i++;
	}
	if (i >= source.length) {
		return null;
	}
	const start = i + 1;
	let depth = 1;
	let inString = null; // null | "'" | '"' | '`'
	let inLineComment = false;
	let inBlockComment = false;
	let prevBackslash = false;
	for (i = start; i < source.length; i++) {
		const c = source[i];
		// String / comment state machine.
		if (inLineComment) {
			if (c === '\n') { inLineComment = false; }
			continue;
		}
		if (inBlockComment) {
			if (c === '*' && source[i + 1] === '/') { inBlockComment = false; i++; }
			continue;
		}
		if (inString) {
			if (prevBackslash) { prevBackslash = false; continue; }
			if (c === '\\') { prevBackslash = true; continue; }
			if (c === inString) { inString = null; }
			continue;
		}
		if (c === '/' && source[i + 1] === '/') { inLineComment = true; i++; continue; }
		if (c === '/' && source[i + 1] === '*') { inBlockComment = true; i++; continue; }
		if (c === '\'' || c === '"' || c === '`') { inString = c; continue; }
		if (c === '{') { depth++; }
		else if (c === '}') {
			depth--;
			if (depth === 0) {
				return source.slice(start, i);
			}
		}
	}
	return null;
}

/**
 * Extract top-level property keys from a brace-block body. Handles:
 *   'foo':       -> foo
 *   "foo":       -> foo
 *   foo:         -> foo
 *   [SomeExpr]:  -> SKIPPED (dynamic key, not lintable)
 *
 * Only depth-0 keys (immediate children of the block) are returned.
 *
 * @param {string} body
 * @returns {string[]}
 */
function extractTopLevelKeys(body) {
	/** @type {string[]} */
	const keys = [];
	let depth = 0;
	let inString = null;
	let inLineComment = false;
	let inBlockComment = false;
	let prevBackslash = false;
	let lineStart = true;
	// Tokenize. Whenever we're at depth 0 and just saw a `,` or `{` boundary, the next
	// identifier-like token followed by `:` is a key.
	// Simpler: scan for keys with a regex on a depth-tracked subset of the body.
	// We mask out anything not at depth 0 by replacing it with spaces, then regex.
	let masked = '';
	for (let i = 0; i < body.length; i++) {
		const c = body[i];
		let keep = depth === 0;
		if (inLineComment) {
			if (c === '\n') { inLineComment = false; }
			masked += ' ';
			continue;
		}
		if (inBlockComment) {
			if (c === '*' && body[i + 1] === '/') { inBlockComment = false; masked += '  '; i++; continue; }
			masked += ' ';
			continue;
		}
		if (inString) {
			if (prevBackslash) { prevBackslash = false; masked += keep ? c : ' '; continue; }
			if (c === '\\') { prevBackslash = true; masked += keep ? c : ' '; continue; }
			if (c === inString) { inString = null; }
			masked += keep ? c : ' ';
			continue;
		}
		if (c === '/' && body[i + 1] === '/') { inLineComment = true; masked += '  '; i++; continue; }
		if (c === '/' && body[i + 1] === '*') { inBlockComment = true; masked += '  '; i++; continue; }
		if (c === '\'' || c === '"' || c === '`') { inString = c; masked += keep ? c : ' '; continue; }
		if (c === '{' || c === '(' || c === '[') {
			masked += keep ? c : ' ';
			depth++;
			continue;
		}
		if (c === '}' || c === ')' || c === ']') {
			depth--;
			keep = depth === 0;
			masked += keep ? c : ' ';
			continue;
		}
		masked += keep ? c : ' ';
		if (c === '\n') { lineStart = true; } else if (c !== ' ' && c !== '\t') { lineStart = false; }
	}
	// Now `masked` only contains depth-0 characters; everything nested is blanked.
	const keyRe = /(?:^|[,{])\s*(?:'([a-zA-Z_][\w]*)'|"([a-zA-Z_][\w]*)"|([a-zA-Z_][\w]*))\s*:/g;
	let match;
	while ((match = keyRe.exec(masked)) !== null) {
		const k = match[1] || match[2] || match[3];
		if (k) { keys.push(k); }
	}
	return keys;
}

function readOrDie(file) {
	if (!fs.existsSync(file)) {
		console.error(`[builtin-tools-coverage] missing file: ${file}`);
		process.exit(2);
	}
	return fs.readFileSync(file, 'utf8');
}

function collect(name, source, headerRe) {
	const body = extractBraceBlock(source, headerRe);
	if (body === null) {
		console.error(`[builtin-tools-coverage] could not locate block: ${name}`);
		process.exit(2);
	}
	const keys = extractTopLevelKeys(body);
	if (keys.length === 0) {
		console.error(`[builtin-tools-coverage] ${name} parsed to zero keys — parser bug or empty block`);
		process.exit(2);
	}
	return keys;
}

function main() {
	const typesSrc = readOrDie(TYPES_FILE);
	const promptsSrc = readOrDie(PROMPTS_FILE);
	const toolsSrc = readOrDie(TOOLS_SERVICE_FILE);

	const resultKeys = collect('BuiltinToolResultType', typesSrc, /export\s+type\s+BuiltinToolResultType\s*=\s*/);
	const promptKeys = collect('builtinTools', promptsSrc, /export\s+const\s+builtinTools\s*:[\s\S]*?=\s*/);
	const callKeys = collect('this.callTool', toolsSrc, /this\.callTool\s*=\s*/);
	const stringKeys = collect('this.stringOfResult', toolsSrc, /this\.stringOfResult\s*=\s*/);

	const promptSet = new Set(promptKeys);
	const callSet = new Set(callKeys);
	const stringSet = new Set(stringKeys);

	/** @type {string[]} */
	const errors = [];

	for (const key of resultKeys) {
		const missing = [];
		if (!promptSet.has(key)) { missing.push('builtinTools (prompts.ts)'); }
		if (!callSet.has(key)) { missing.push('this.callTool (toolsService.ts)'); }
		if (!stringSet.has(key)) { missing.push('this.stringOfResult (toolsService.ts)'); }
		if (missing.length > 0) {
			errors.push(`  '${key}' — missing in: ${missing.join(', ')}`);
		}
	}

	// Also flag tool entries that exist in registrations but not in the result-type — usually
	// a typo / abandoned key. Don't fail on these (warn only) since approval flow has its own
	// type-level coverage in `approvalTypeOfBuiltinToolName`.
	const resultSet = new Set(resultKeys);
	/** @type {string[]} */
	const stale = [];
	for (const key of promptKeys) { if (!resultSet.has(key)) { stale.push(`builtinTools.${key}`); } }
	for (const key of callKeys) { if (!resultSet.has(key)) { stale.push(`callTool.${key}`); } }
	for (const key of stringKeys) { if (!resultSet.has(key)) { stale.push(`stringOfResult.${key}`); } }

	if (errors.length > 0) {
		console.error('[builtin-tools-coverage] FAIL — every BuiltinToolResultType key must have a builtinTools + callTool + stringOfResult entry:');
		for (const line of errors) { console.error(line); }
		if (stale.length > 0) {
			console.error('[builtin-tools-coverage] also: stale registrations (key exists in registry but not in BuiltinToolResultType):');
			for (const s of stale) { console.error(`  ${s}`); }
		}
		process.exit(1);
	}

	console.log(`[builtin-tools-coverage] OK — ${resultKeys.length} tools registered consistently across types + registry + executor + formatter.`);
	if (stale.length > 0) {
		console.warn('[builtin-tools-coverage] warning: stale registrations (key exists in registry but not in BuiltinToolResultType):');
		for (const s of stale) { console.warn(`  ${s}`); }
	}
}

main();
