/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// LSP-backed Context Bridge tool implementations (Phase B.2 of vselite).
// Each tool is a pure async function so toolsService.ts can call them
// directly. State lives in the singletons we accept (ILspBridgeAdapter,
// IContextBridgeService, IFileService, IWorkspaceContextService).

import { URI } from '../../../../../base/common/uri.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IContextBridgeService } from '../../common/contextBridge/contextBridgeService.js';
import {
	CallerEntry,
	CallerWithSnippet,
	CallGraphNode,
	CallGraphOutput,
	FileContextOutput,
	FileDependenciesOutput,
	ImportEntry,
	PackContextOutput,
	PackContextTask,
	ProjectBriefingOutput,
	ReferenceWithSnippet,
	ResolvedImportEntry,
	SymbolContextOutput,
	SymbolEntry,
	SymbolNote,
	TypeHierarchyEntry,
} from '../../common/contextBridge/contextBridgeTypes.js';
import { ILspBridgeAdapter } from './lspBridgeAdapter.js';

// ---- Import parsing (ported verbatim from cb-core/get-file-context.ts) ----

const IMPORT_RE =
	/^\s*import\s+(?:(type)\s+)?(?:(\*\s+as\s+\w+|\{[^}]*\}|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+)?["']([^"']+)["']/;

export function parseImportsFromText(text: string): ImportEntry[] {
	const lines = text.split(/\r?\n/);
	const imports: ImportEntry[] = [];
	for (let i = 0; i < lines.length; i++) {
		const match = IMPORT_RE.exec(lines[i]);
		if (!match) { continue; }
		const [, typeKeyword, importClause, module] = match;
		const names: string[] = [];
		if (importClause) {
			const braceMatch = /\{([^}]*)\}/.exec(importClause);
			if (braceMatch) {
				for (const n of braceMatch[1].split(',')) {
					const cleaned = n.trim().replace(/\s+as\s+\w+$/, '').replace(/^type\s+/, '').trim();
					if (cleaned) { names.push(cleaned); }
				}
			}
			const defaultMatch = /^(\w+)(?:\s*,|$)/.exec(importClause);
			if (defaultMatch) { names.unshift(defaultMatch[1]); }
			const starMatch = /\*\s+as\s+(\w+)/.exec(importClause);
			if (starMatch) { names.push(`* as ${starMatch[1]}`); }
		}
		imports.push({ module, line: i, importedNames: names, isTypeOnly: Boolean(typeKeyword) });
	}
	return imports;
}

// ---- File helpers ----

const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];
const SKIP_DIRS = new Set([
	'node_modules', 'dist', 'build', 'out', '.git', '.cache', 'coverage',
	'target', '__pycache__', '.turbo', '.vite', '.next', '.vscode-test',
]);
const MAX_DEP_FILES = 2000;
const MAX_TREE_DEPTH = 3;
const MAX_TREE_ENTRIES = 200;

function normalizePath(p: string): string {
	return p.split('\\').join('/');
}

function joinPosix(...parts: string[]): string {
	const joined = parts.filter(Boolean).join('/');
	return normalizePath(joined).replace(/\/+/g, '/');
}

function dirnamePosix(p: string): string {
	const norm = normalizePath(p);
	const i = norm.lastIndexOf('/');
	return i <= 0 ? '' : norm.slice(0, i);
}



function resolvePosix(base: string, rel: string): string {
	const parts = (base ? base.split('/') : []).concat(rel.split('/'));
	const out: string[] = [];
	for (const p of parts) {
		if (!p || p === '.') { continue; }
		if (p === '..') { out.pop(); continue; }
		out.push(p);
	}
	return out.join('/');
}

async function readTextFile(fileService: IFileService, uri: URI): Promise<string | null> {
	try {
		const content = await fileService.readFile(uri);
		return content.value.toString();
	} catch {
		return null;
	}
}

// ---- 1. get_file_context ----

export async function runGetFileContext(
	adapter: ILspBridgeAdapter,
	fileService: IFileService,
	params: { filePath: string },
): Promise<FileContextOutput> {
	const { filePath } = params;
	const uri = adapter.resolveFile(filePath);
	if (!uri) {
		return { filePath, symbols: [], imports: [], diagnostics: [] };
	}
	const [symbols, diagnostics, text] = await Promise.all([
		adapter.getDocumentSymbols(filePath),
		adapter.getDiagnostics(filePath),
		readTextFile(fileService, uri),
	]);
	const imports = text ? parseImportsFromText(text) : [];
	return { filePath, symbols, imports, diagnostics };
}

// ---- 2. get_file_dependencies ----

async function listWorkspaceSourceFiles(
	fileService: IFileService,
	rootUri: URI,
	limit: number,
): Promise<URI[]> {
	const out: URI[] = [];
	const queue: URI[] = [rootUri];
	while (queue.length > 0 && out.length < limit) {
		const dir = queue.shift()!;
		let stat;
		try {
			stat = await fileService.resolve(dir);
		} catch {
			continue;
		}
		if (!stat.children) { continue; }
		for (const child of stat.children) {
			if (out.length >= limit) { break; }
			const name = child.name;
			if (child.isDirectory) {
				if (SKIP_DIRS.has(name)) { continue; }
				if (name.startsWith('.') && name !== '.github') { continue; }
				queue.push(child.resource);
			} else {
				const lower = name.toLowerCase();
				if (SOURCE_EXTS.some(e => lower.endsWith(e))) {
					out.push(child.resource);
				}
			}
		}
	}
	return out;
}

function resolveRelativeImport(
	fromFilePath: string,
	moduleSpecifier: string,
	allFiles: Set<string>,
): string | null {
	if (!moduleSpecifier.startsWith('.')) { return null; }
	const fromDir = dirnamePosix(fromFilePath);
	const base = resolvePosix(fromDir, moduleSpecifier);
	const candidates: string[] = [];
	if (SOURCE_EXTS.some(e => base.toLowerCase().endsWith(e))) {
		candidates.push(base);
	} else {
		for (const ext of SOURCE_EXTS) { candidates.push(base + ext); }
		for (const ext of SOURCE_EXTS) { candidates.push(joinPosix(base, 'index' + ext)); }
		// Also try .js → .ts swap (common in ESM-style relative imports inside TS projects).
		if (base.toLowerCase().endsWith('.js')) {
			candidates.push(base.slice(0, -3) + '.ts');
			candidates.push(base.slice(0, -3) + '.tsx');
		}
	}
	for (const c of candidates) {
		if (allFiles.has(c)) { return c; }
	}
	return null;
}

export async function runGetFileDependencies(
	adapter: ILspBridgeAdapter,
	fileService: IFileService,
	workspace: IWorkspaceContextService,
	params: { filePath: string },
): Promise<FileDependenciesOutput> {
	const { filePath } = params;
	const folders = workspace.getWorkspace().folders;
	if (folders.length === 0) {
		return { filePath, directImports: [], externalImports: [], importedBy: [], scannedFiles: 0 };
	}
	const rootUri = folders[0].uri;
	const subjectUri = adapter.resolveFile(filePath);
	if (!subjectUri) {
		return { filePath, directImports: [], externalImports: [], importedBy: [], scannedFiles: 0 };
	}

	const allFileUris = await listWorkspaceSourceFiles(fileService, rootUri, MAX_DEP_FILES);
	const relPaths = allFileUris.map(u => adapter.relativize(u));
	const fileSet = new Set(relPaths);

	// Parse subject file's own imports.
	const subjectText = await readTextFile(fileService, subjectUri);
	const subjectImports = subjectText ? parseImportsFromText(subjectText) : [];
	const directImports: ResolvedImportEntry[] = subjectImports.map(imp => ({
		...imp,
		resolvedFilePath: resolveRelativeImport(filePath, imp.module, fileSet),
	}));

	const externalCounts = new Map<string, number>();
	for (const imp of subjectImports) {
		if (!imp.module.startsWith('.')) {
			externalCounts.set(imp.module, (externalCounts.get(imp.module) ?? 0) + 1);
		}
	}
	const externalImports = Array.from(externalCounts.entries())
		.map(([module, count]) => ({ module, count }))
		.sort((a, b) => b.count - a.count);

	// Scan every other source file for imports pointing at this one.
	const importedBy: FileDependenciesOutput['importedBy'] = [];
	for (let i = 0; i < allFileUris.length; i++) {
		const otherPath = relPaths[i];
		if (otherPath === filePath) { continue; }
		const otherText = await readTextFile(fileService, allFileUris[i]);
		if (!otherText) { continue; }
		const otherImports = parseImportsFromText(otherText);
		for (const imp of otherImports) {
			if (!imp.module.startsWith('.')) { continue; }
			const resolved = resolveRelativeImport(otherPath, imp.module, fileSet);
			if (resolved === filePath) {
				importedBy.push({
					filePath: otherPath,
					line: imp.line,
					importedNames: imp.importedNames,
					isTypeOnly: imp.isTypeOnly,
				});
			}
		}
	}

	return {
		filePath,
		directImports,
		externalImports,
		importedBy,
		scannedFiles: allFileUris.length,
	};
}

// ---- 3. get_symbol_context ----

export async function runGetSymbolContext(
	adapter: ILspBridgeAdapter,
	notes: IContextBridgeService,
	params: { filePath: string; symbolName: string },
): Promise<SymbolContextOutput> {
	const { filePath, symbolName } = params;
	const location = await adapter.resolveSymbolLocation(filePath, symbolName);
	const savedNotes = await notes.getNotesForSymbol(filePath, symbolName);

	if (!location) {
		return {
			symbol: null,
			definition: null,
			callers: [],
			callees: [],
			references: [],
			diagnostics: [],
			supertypes: [],
			subtypes: [],
			notes: savedNotes,
			via: 'text',
		};
	}

	const def = await adapter.getDefinition(location.filePath, location.line, location.character);
	const symbol: SymbolEntry = def ?? {
		name: symbolName,
		kind: 'unknown',
		filePath: location.filePath,
		line: location.line,
		character: location.character,
	};

	const [callers, callees, references, diagnostics] = await Promise.all([
		adapter.getIncomingCalls(location.filePath, location.line, location.character),
		adapter.getOutgoingCalls(location.filePath, location.line, location.character),
		adapter.getReferences(location.filePath, location.line, location.character),
		adapter.getDiagnostics(location.filePath),
	]);

	// Type hierarchy only meaningful for class/interface/enum/type-like kinds.
	let supertypes: TypeHierarchyEntry[] = [];
	let subtypes: TypeHierarchyEntry[] = [];
	if (symbol.kind === 'class' || symbol.kind === 'interface' || symbol.kind === 'enum' || symbol.kind === 'type') {
		[supertypes, subtypes] = await Promise.all([
			adapter.getSupertypes(location.filePath, location.line, location.character),
			adapter.getSubtypes(location.filePath, location.line, location.character),
		]);
	}

	// Inline diagnostics filter — limit to ones touching the symbol's line ± a small window.
	const symbolDiagnostics = diagnostics.filter(d => Math.abs(d.line - location.line) <= 30);

	const snippet = await adapter.readSnippet(location.filePath, location.line, 4);
	const definition = snippet.lines.length > 0
		? snippet.lines.map((l, i) => `${snippet.startLine + i + 1} | ${l}`).join('\n')
		: null;

	return {
		symbol,
		definition,
		callers,
		callees,
		references,
		diagnostics: symbolDiagnostics,
		supertypes,
		subtypes,
		notes: savedNotes,
		via: 'lsp',
	};
}

// ---- 4. get_call_graph ----

export async function runGetCallGraph(
	adapter: ILspBridgeAdapter,
	params: { filePath: string; symbolName: string; direction: 'incoming' | 'outgoing'; depth: number },
): Promise<CallGraphOutput> {
	const depth = Math.min(Math.max(1, params.depth || 2), 4);
	const direction = params.direction || 'incoming';
	const root = await adapter.resolveSymbolLocation(params.filePath, params.symbolName);
	if (!root) {
		return {
			symbol: { name: params.symbolName, filePath: params.filePath, line: 0, character: 0 },
			direction, depth, totalNodes: 0, tree: [],
		};
	}

	const seen = new Set<string>();
	const keyOf = (filePath: string, line: number, name: string) => `${filePath}:${line}:${name}`;
	seen.add(keyOf(root.filePath, root.line, params.symbolName));

	let totalNodes = 1;
	const fetch = direction === 'incoming'
		? adapter.getIncomingCalls.bind(adapter)
		: adapter.getOutgoingCalls.bind(adapter);

	const walk = async (filePath: string, line: number, character: number, levelsLeft: number): Promise<CallGraphNode[]> => {
		if (levelsLeft <= 0) { return []; }
		const callers = await fetch(filePath, line, character);
		const nodes: CallGraphNode[] = [];
		for (const caller of callers) {
			const key = keyOf(caller.filePath, caller.line, caller.name);
			if (seen.has(key)) { continue; }
			seen.add(key);
			totalNodes++;
			const children = await walk(caller.filePath, caller.line, caller.character, levelsLeft - 1);
			nodes.push({
				name: caller.name,
				kind: caller.kind,
				filePath: caller.filePath,
				line: caller.line,
				character: caller.character,
				children,
			});
		}
		return nodes;
	};

	const tree = await walk(root.filePath, root.line, root.character, depth);

	return {
		symbol: { name: params.symbolName, filePath: root.filePath, line: root.line, character: root.character },
		direction, depth, totalNodes, tree,
	};
}

// ---- 5. pack_context ----

interface PackCaps { callers: number; references: number; callerCtx: number }
const CAPS: Record<PackContextTask, PackCaps> = {
	understand: { callers: 2, references: 1, callerCtx: 10 },
	refactor: { callers: 10, references: 8, callerCtx: 4 },
	debug: { callers: 6, references: 4, callerCtx: 6 },
	extend: { callers: 4, references: 2, callerCtx: 4 },
};

function estimateTokens(o: unknown): number {
	try { return Math.ceil(JSON.stringify(o).length / 4); } catch { return 0; }
}

export async function runPackContext(
	adapter: ILspBridgeAdapter,
	notes: IContextBridgeService,
	params: { filePath: string; symbolName: string; task: PackContextTask; maxTokens: number },
): Promise<PackContextOutput> {
	const task = params.task || 'understand';
	const maxTokens = Math.max(500, params.maxTokens || 3000);
	const caps = CAPS[task];

	const ctx = await runGetSymbolContext(adapter, notes, { filePath: params.filePath, symbolName: params.symbolName });

	// Apply per-task caps.
	const cappedCallers = ctx.callers.slice(0, caps.callers);
	const cappedReferences = ctx.references.slice(0, caps.references);

	// Hydrate caller + reference snippets.
	const callerSnippets: CallerWithSnippet[] = await Promise.all(
		cappedCallers.map(async (c): Promise<CallerWithSnippet> => ({
			...c,
			snippet: await adapter.readSnippet(c.filePath, c.line, caps.callerCtx),
		})),
	);
	const refSnippets: ReferenceWithSnippet[] = await Promise.all(
		cappedReferences.map(async (r): Promise<ReferenceWithSnippet> => ({
			...r,
			snippet: await adapter.readSnippet(r.filePath, r.line, 2),
		})),
	);

	let referencesDropped = ctx.references.length - cappedReferences.length;
	let callerSnippetsDropped = ctx.callers.length - cappedCallers.length;
	let working: PackContextOutput = {
		task,
		symbol: ctx.symbol,
		definition: ctx.definition,
		notes: ctx.notes,
		diagnostics: ctx.diagnostics,
		callers: callerSnippets,
		callees: ctx.callees,
		references: refSnippets,
		supertypes: ctx.supertypes,
		subtypes: ctx.subtypes,
		meta: {
			estimated_tokens: 0,
			truncated: { references_dropped: referencesDropped, caller_snippets_dropped: callerSnippetsDropped, hit_budget: false },
		},
	};

	// Budget trim: drop references first, then strip caller snippets, then trim callers entirely.
	let tokens = estimateTokens(working);
	while (tokens > maxTokens && working.references.length > 0) {
		working.references.pop();
		referencesDropped++;
		tokens = estimateTokens(working);
	}
	while (tokens > maxTokens && working.callers.length > 0) {
		const last = working.callers.pop()!;
		// Try keeping the caller header without the snippet first.
		(last as CallerEntry & { snippet?: unknown }).snippet = { startLine: 0, lines: [] };
		callerSnippetsDropped++;
		tokens = estimateTokens(working);
	}

	working.meta.estimated_tokens = tokens;
	working.meta.truncated.references_dropped = referencesDropped;
	working.meta.truncated.caller_snippets_dropped = callerSnippetsDropped;
	working.meta.truncated.hit_budget = tokens > maxTokens;
	return working;
}

// ---- 6. get_project_briefing ----

const AGENTS_CANDIDATES = [
	'AGENTS.md',
	'.github/AGENTS.md',
	'.github/copilot-instructions.md',
];

function sliceSection(md: string, heading: string): string | null {
	const re = new RegExp(`^##\\s+${heading}\\s*$`, 'im');
	const start = md.search(re);
	if (start === -1) { return null; }
	const after = md.slice(start);
	const nextHeading = after.slice(1).search(/^##\s+/m);
	const body = nextHeading === -1 ? after : after.slice(0, nextHeading + 1);
	const trimmed = body.trim();
	return trimmed.length > 0 ? trimmed : null;
}

async function readJournal(
	fileService: IFileService,
	rootUri: URI,
): Promise<{ raw: string | null; path: string | null }> {
	for (const candidate of AGENTS_CANDIDATES) {
		const uri = URI.joinPath(rootUri, candidate);
		const text = await readTextFile(fileService, uri);
		if (text !== null) {
			return { raw: text.length > 24000 ? text.slice(0, 24000) : text, path: candidate };
		}
	}
	return { raw: null, path: null };
}

async function curatedFileTree(
	fileService: IFileService,
	rootUri: URI,
	rootPath: string,
): Promise<string> {
	const lines: string[] = [];
	const walk = async (dirUri: URI, dirRel: string, depth: number): Promise<void> => {
		if (lines.length >= MAX_TREE_ENTRIES || depth > MAX_TREE_DEPTH) { return; }
		let stat;
		try { stat = await fileService.resolve(dirUri); } catch { return; }
		if (!stat.children) { return; }
		const sorted = [...stat.children].sort((a, b) => {
			if (a.isDirectory !== b.isDirectory) { return a.isDirectory ? -1 : 1; }
			return a.name.localeCompare(b.name);
		});
		for (const child of sorted) {
			if (lines.length >= MAX_TREE_ENTRIES) { return; }
			if (child.name.startsWith('.') && child.name !== '.github') { continue; }
			if (SKIP_DIRS.has(child.name)) { continue; }
			const rel = dirRel ? `${dirRel}/${child.name}` : child.name;
			if (child.isDirectory) {
				lines.push('  '.repeat(depth) + child.name + '/');
				await walk(child.resource, rel, depth + 1);
			} else {
				lines.push('  '.repeat(depth) + child.name);
			}
		}
	};
	await walk(rootUri, '', 0);
	void rootPath;
	return lines.join('\n');
}

async function readRecentCommits(
	fileService: IFileService,
	rootUri: URI,
): Promise<string[]> {
	const headLog = URI.joinPath(rootUri, '.git', 'logs', 'HEAD');
	const raw = await readTextFile(fileService, headLog);
	if (!raw) { return []; }
	// Each line: <from> <to> <author> <unix> <tz>\t<msg>
	// Take the last 20 lines, parse the short hash + message.
	const lines = raw.split(/\r?\n/).filter(Boolean);
	const last = lines.slice(-20).reverse();
	const out: string[] = [];
	for (const line of last) {
		const tabIdx = line.indexOf('\t');
		const left = tabIdx >= 0 ? line.slice(0, tabIdx) : line;
		const msg = tabIdx >= 0 ? line.slice(tabIdx + 1) : '';
		const parts = left.split(/\s+/);
		const toHash = parts[1] ?? '';
		const shortHash = toHash.slice(0, 8);
		out.push(`${shortHash} ${msg}`.trim());
	}
	return out;
}

export async function runGetProjectBriefing(
	adapter: ILspBridgeAdapter,
	fileService: IFileService,
	workspace: IWorkspaceContextService,
	notes: IContextBridgeService,
	params: { includeNotes: boolean },
): Promise<ProjectBriefingOutput> {
	const cacheKey = params.includeNotes ? 'with-notes' : 'no-notes';
	return adapter.getOrComputeBriefing(cacheKey, async () => {
		const workspaceRoot = adapter.getWorkspaceRoot();
		const folders = workspace.getWorkspace().folders;
		if (folders.length === 0 || !workspaceRoot) {
			return {
				workspaceRoot: null,
				hasJournal: false,
				journal: { recentChanges: null, sessionMemory: null },
				fileTree: '',
				recentCommits: [],
				notes: [],
				warnings: ['No workspace folder open.'],
			};
		}
		const rootUri = folders[0].uri;
		const warnings: string[] = [];

		const [{ raw: journalRaw, path: journalPath }, fileTree, recentCommits] = await Promise.all([
			readJournal(fileService, rootUri),
			curatedFileTree(fileService, rootUri, workspaceRoot),
			readRecentCommits(fileService, rootUri),
		]);

		if (!journalRaw) {
			warnings.push('No AGENTS.md (or .github/AGENTS.md, .github/copilot-instructions.md) at workspace root. Project state will not persist across sessions until one is created.');
		}
		if (recentCommits.length === 0) {
			warnings.push('Could not read .git/logs/HEAD — recent git history unavailable.');
		}

		const journal = {
			recentChanges: journalRaw ? sliceSection(journalRaw, 'Recent Changes') : null,
			sessionMemory: journalRaw ? sliceSection(journalRaw, 'Session Memory') : null,
		};

		const savedNotes = params.includeNotes ? await notes.listNotes() : [];
		void journalPath;

		const out: ProjectBriefingOutput = {
			workspaceRoot,
			hasJournal: journalRaw !== null,
			journal,
			fileTree,
			recentCommits,
			notes: savedNotes,
			warnings,
		};
		return out;
	});
}

// Helper: stringify the most common nested entries for human-readable tool output.
export function stringifySymbolContext(out: SymbolContextOutput): string {
	if (!out.symbol) {
		return `No symbol resolved.${out.notes.length > 0 ? `\n\nNotes:\n${formatNotes(out.notes)}` : ''}`;
	}
	const lines: string[] = [];
	lines.push(`${out.symbol.kind} ${out.symbol.name} @ ${out.symbol.filePath}:${out.symbol.line + 1}`);
	if (out.definition) { lines.push('', 'Definition:', out.definition); }
	if (out.notes.length > 0) { lines.push('', 'Notes:', formatNotes(out.notes)); }
	if (out.diagnostics.length > 0) { lines.push('', `Diagnostics (${out.diagnostics.length}):`, ...out.diagnostics.map(d => `  ${d.severity} ${d.filePath}:${d.line + 1} ${d.message}`)); }
	if (out.callers.length > 0) { lines.push('', `Callers (${out.callers.length}):`, ...out.callers.map(c => `  ${c.name} @ ${c.filePath}:${c.line + 1}`)); }
	if (out.callees.length > 0) { lines.push('', `Callees (${out.callees.length}):`, ...out.callees.map(c => `  ${c.name} @ ${c.filePath}:${c.line + 1}`)); }
	if (out.references.length > 0) { lines.push('', `References (${out.references.length}):`, ...out.references.slice(0, 20).map(r => `  ${r.filePath}:${r.line + 1}`)); }
	if (out.supertypes.length > 0) { lines.push('', `Supertypes:`, ...out.supertypes.map(t => `  ${t.kind} ${t.name} @ ${t.filePath}:${t.line + 1}`)); }
	if (out.subtypes.length > 0) { lines.push('', `Subtypes:`, ...out.subtypes.map(t => `  ${t.kind} ${t.name} @ ${t.filePath}:${t.line + 1}`)); }
	return lines.join('\n');
}

export function stringifyCallGraph(out: CallGraphOutput): string {
	const lines: string[] = [];
	lines.push(`Call graph (${out.direction}, depth ${out.depth}, ${out.totalNodes} nodes) — root: ${out.symbol.name} @ ${out.symbol.filePath}:${out.symbol.line + 1}`);
	const render = (nodes: CallGraphNode[], indent: number) => {
		for (const n of nodes) {
			lines.push('  '.repeat(indent + 1) + `${n.kind} ${n.name} @ ${n.filePath}:${n.line + 1}`);
			render(n.children, indent + 1);
		}
	};
	render(out.tree, 0);
	return lines.join('\n');
}

export function stringifyFileContext(out: FileContextOutput): string {
	const lines: string[] = [];
	lines.push(`File: ${out.filePath}`);
	if (out.symbols.length > 0) {
		lines.push('', `Symbols (${out.symbols.length}):`);
		for (const s of out.symbols.slice(0, 80)) {
			lines.push(`  ${s.kind} ${s.containerName ? `${s.containerName}.` : ''}${s.name} @ ${s.line + 1}`);
		}
		if (out.symbols.length > 80) { lines.push(`  ... (+${out.symbols.length - 80} more)`); }
	}
	if (out.imports.length > 0) {
		lines.push('', `Imports (${out.imports.length}):`);
		for (const i of out.imports) {
			lines.push(`  line ${i.line + 1}: ${i.isTypeOnly ? 'type ' : ''}${i.importedNames.join(', ') || '*'} from "${i.module}"`);
		}
	}
	if (out.diagnostics.length > 0) {
		lines.push('', `Diagnostics (${out.diagnostics.length}):`);
		for (const d of out.diagnostics) {
			lines.push(`  ${d.severity} :${d.line + 1} ${d.message}`);
		}
	}
	return lines.join('\n');
}

export function stringifyFileDependencies(out: FileDependenciesOutput): string {
	const lines: string[] = [];
	lines.push(`Dependencies for ${out.filePath} (scanned ${out.scannedFiles} files)`);
	if (out.directImports.length > 0) {
		lines.push('', `Direct imports (${out.directImports.length}):`);
		for (const d of out.directImports) {
			lines.push(`  ${d.module}${d.resolvedFilePath ? ` → ${d.resolvedFilePath}` : ''}`);
		}
	}
	if (out.externalImports.length > 0) {
		lines.push('', `External packages (${out.externalImports.length}):`);
		for (const e of out.externalImports) { lines.push(`  ${e.module} (${e.count})`); }
	}
	if (out.importedBy.length > 0) {
		lines.push('', `Imported by (${out.importedBy.length}):`);
		for (const i of out.importedBy) {
			lines.push(`  ${i.filePath}:${i.line + 1}  [${i.importedNames.join(', ') || '*'}]`);
		}
	}
	return lines.join('\n');
}

export function stringifyPackContext(out: PackContextOutput): string {
	const head = stringifySymbolContext({
		symbol: out.symbol,
		definition: out.definition,
		callers: out.callers,
		callees: out.callees,
		references: out.references,
		diagnostics: out.diagnostics,
		supertypes: out.supertypes,
		subtypes: out.subtypes,
		notes: out.notes,
		via: 'lsp',
	});
	const footer = `\n\n[pack_context task=${out.task} estimated_tokens=${out.meta.estimated_tokens} dropped_refs=${out.meta.truncated.references_dropped} dropped_caller_snippets=${out.meta.truncated.caller_snippets_dropped}${out.meta.truncated.hit_budget ? ' (budget exceeded)' : ''}]`;
	return head + footer;
}

export function stringifyProjectBriefing(out: ProjectBriefingOutput): string {
	const lines: string[] = [];
	lines.push(`Workspace: ${out.workspaceRoot ?? '<none>'}`);
	if (out.warnings.length > 0) {
		lines.push('', 'Warnings:', ...out.warnings.map(w => `  - ${w}`));
	}
	if (out.journal.recentChanges) {
		lines.push('', '## Recent Changes', out.journal.recentChanges);
	}
	if (out.journal.sessionMemory) {
		lines.push('', '## Session Memory', out.journal.sessionMemory);
	}
	if (out.recentCommits.length > 0) {
		lines.push('', 'Recent commits:', ...out.recentCommits.map(c => `  ${c}`));
	}
	if (out.fileTree) {
		lines.push('', 'File tree (depth 3):', out.fileTree);
	}
	if (out.notes.length > 0) {
		lines.push('', `Persistent notes (${out.notes.length}):`, formatNotes(out.notes));
	}
	return lines.join('\n');
}

function formatNotes(notes: SymbolNote[]): string {
	return notes.map(n => `  [${n.id}] ${n.filePath} :: ${n.symbolName}\n    ${n.note}`).join('\n');
}

// Touched to silence unused-imports while keeping the symbol available for ad-hoc tooling.
void VSBuffer;
