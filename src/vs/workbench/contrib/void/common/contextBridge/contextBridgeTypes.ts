/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface SymbolNote {
	id: string;
	filePath: string;
	symbolName: string;
	note: string;
	createdAt: string;
	updatedAt: string;
}

// ---- LSP-derived entry types (mirror @context-bridge/core types) ----
// Positions are 0-indexed (LSP convention) — translate at boundaries with
// VS Code's 1-indexed IPosition.

export type SymbolKind =
	| 'function'
	| 'method'
	| 'class'
	| 'interface'
	| 'enum'
	| 'variable'
	| 'property'
	| 'type'
	| 'module'
	| 'unknown';

export interface SymbolEntry {
	name: string;
	kind: SymbolKind;
	filePath: string;
	line: number;
	character: number;
	containerName?: string;
}

export interface ReferenceEntry {
	filePath: string;
	line: number;
	character: number;
	endLine: number;
	endCharacter: number;
}

export interface CallerEntry {
	name: string;
	kind: SymbolKind;
	filePath: string;
	line: number;
	character: number;
	fromRanges: Array<{
		line: number;
		character: number;
		endLine: number;
		endCharacter: number;
	}>;
}

export interface TypeHierarchyEntry {
	name: string;
	kind: SymbolKind;
	filePath: string;
	line: number;
	character: number;
	detail?: string;
}

export interface DiagnosticEntry {
	filePath: string;
	line: number;
	severity: 'error' | 'warning' | 'info' | 'hint';
	message: string;
	source?: string;
}

export interface ImportEntry {
	module: string;
	line: number;
	importedNames: string[];
	isTypeOnly: boolean;
}

// ---- Composite tool output shapes (mirror CB-core) ----

export interface FileContextOutput {
	filePath: string;
	symbols: SymbolEntry[];
	imports: ImportEntry[];
	diagnostics: DiagnosticEntry[];
}

export interface ResolvedImportEntry extends ImportEntry {
	resolvedFilePath: string | null;
}

export interface FileDependenciesOutput {
	filePath: string;
	directImports: ResolvedImportEntry[];
	externalImports: Array<{ module: string; count: number }>;
	importedBy: Array<{ filePath: string; line: number; importedNames: string[]; isTypeOnly: boolean }>;
	scannedFiles: number;
}

export interface SymbolContextOutput {
	symbol: SymbolEntry | null;
	definition: string | null;
	callers: CallerEntry[];
	callees: CallerEntry[];
	references: ReferenceEntry[];
	diagnostics: DiagnosticEntry[];
	supertypes: TypeHierarchyEntry[];
	subtypes: TypeHierarchyEntry[];
	notes: SymbolNote[];
	via: 'lsp' | 'text';
}

export interface CallGraphNode {
	name: string;
	kind: SymbolKind;
	filePath: string;
	line: number;
	character: number;
	children: CallGraphNode[];
}

export interface CallGraphOutput {
	symbol: { name: string; filePath: string; line: number; character: number };
	direction: 'incoming' | 'outgoing';
	depth: number;
	totalNodes: number;
	tree: CallGraphNode[];
}

export interface CallerWithSnippet extends CallerEntry {
	snippet: { startLine: number; lines: string[] };
}

export interface ReferenceWithSnippet extends ReferenceEntry {
	snippet: { startLine: number; lines: string[] };
}

export type PackContextTask = 'understand' | 'refactor' | 'debug' | 'extend';

export interface PackContextOutput {
	task: PackContextTask;
	symbol: SymbolEntry | null;
	definition: string | null;
	notes: SymbolNote[];
	diagnostics: DiagnosticEntry[];
	callers: CallerWithSnippet[];
	callees: CallerEntry[];
	references: ReferenceWithSnippet[];
	supertypes: TypeHierarchyEntry[];
	subtypes: TypeHierarchyEntry[];
	meta: {
		estimated_tokens: number;
		truncated: {
			references_dropped: number;
			caller_snippets_dropped: number;
			hit_budget: boolean;
		};
	};
}

export interface ProjectBriefingOutput {
	workspaceRoot: string | null;
	hasJournal: boolean;
	journal: { recentChanges: string | null; sessionMemory: string | null };
	fileTree: string;
	recentCommits: string[];
	notes: SymbolNote[];
	warnings: string[];
}
