import { URI } from '../../../../base/common/uri.js'
import {
	CallGraphOutput,
	FileContextOutput,
	FileDependenciesOutput,
	PackContextTask,
	PackContextOutput,
	ProjectBriefingOutput,
	SymbolContextOutput,
	SymbolNote,
} from './contextBridge/contextBridgeTypes.js';
import { RawMCPToolCall } from './mcpServiceTypes.js';
import { builtinTools } from './prompt/prompts.js';
import { Hit as SemanticHit } from './semanticIndex/semanticIndexTypes.js';
import { RawToolParamsObj } from './sendLLMMessageTypes.js';



export type TerminalResolveReason = { type: 'timeout' } | { type: 'done', exitCode: number }

export type LintErrorItem = { code: string, message: string, startLineNumber: number, endLineNumber: number }

// Partial of IFileStat
export type ShallowDirectoryItem = {
	uri: URI;
	name: string;
	isDirectory: boolean;
	isSymbolicLink: boolean;
}


export const approvalTypeOfBuiltinToolName: Partial<{ [T in BuiltinToolName]?: 'edits' | 'terminal' | 'MCP tools' }> = {
	'create_file_or_folder': 'edits',
	'delete_file_or_folder': 'edits',
	'rewrite_file': 'edits',
	'edit_file': 'edits',
	'run_command': 'terminal',
	'run_persistent_command': 'terminal',
	'open_persistent_terminal': 'terminal',
	'kill_persistent_terminal': 'terminal',
	// Context Bridge tools — write-side notes need approval, find_text is read-only.
	'remember': 'MCP tools',
	'forget': 'MCP tools',
	// Git write operations
	'git_commit': 'terminal',
}


export type ToolApprovalType = NonNullable<(typeof approvalTypeOfBuiltinToolName)[keyof typeof approvalTypeOfBuiltinToolName]>;


export const toolApprovalTypes = new Set<ToolApprovalType>([
	...Object.values(approvalTypeOfBuiltinToolName),
	'MCP tools',
])




// PARAMS OF TOOL CALL
export type BuiltinToolCallParams = {
	'read_file': { uri: URI, startLine: number | null, endLine: number | null, pageNumber: number },
	'ls_dir': { uri: URI, pageNumber: number },
	'get_dir_tree': { uri: URI },
	'search_pathnames_only': { query: string, includePattern: string | null, pageNumber: number },
	'search_for_files': { query: string, isRegex: boolean, searchInFolder: URI | null, pageNumber: number },
	'search_in_file': { uri: URI, query: string, isRegex: boolean },
	'read_lint_errors': { uri: URI },
	// ---
	'rewrite_file': { uri: URI, newContent: string },
	'edit_file': { uri: URI, searchReplaceBlocks: string },
	'create_file_or_folder': { uri: URI, isFolder: boolean },
	'delete_file_or_folder': { uri: URI, isRecursive: boolean, isFolder: boolean },
	// ---
	'run_command': { command: string; cwd: string | null, terminalId: string },
	'open_persistent_terminal': { cwd: string | null },
	'run_persistent_command': { command: string; persistentTerminalId: string },
	'kill_persistent_terminal': { persistentTerminalId: string },
	// ---
	// Context Bridge — symbol-attached notes + workspace text search.
	'remember': { filePath: string, symbolName: string, note: string },
	'forget': { noteId: string },
	'list_notes': { filePath: string | null },
	'find_text': { query: string, isRegex: boolean, includePattern: string | null, pageNumber: number },
	// V3Code semantic index — embeddings + FTS retrieval.
	'semantic_search': { query: string, topK: number | null, includeFile: string | null, includeFiles: string[] | null },
	// LSP-backed context tools (Phase B.2).
	'get_file_context': { filePath: string },
	'get_file_dependencies': { filePath: string },
	'get_symbol_context': { filePath: string, symbolName: string },
	'get_call_graph': { filePath: string, symbolName: string, direction: 'incoming' | 'outgoing', depth: number },
	'pack_context': { filePath: string, symbolName: string, task: PackContextTask, maxTokens: number },
	'get_project_briefing': { includeNotes: boolean },
	// --- Web & Git & Browser ---
	'web_search': { query: string, maxResults: number },
	'git_status': {},
	'git_commit': { message: string },
	'git_diff': { staged: boolean },
	'git_log': { count: number },
	'git_branch': {},
	'browser_screenshot': { url: string },
	// --- Background Subagent ---
	'launch_subagent': { description: string, prompt: string, readOnly: boolean },
	// --- Todo List ---
	'update_plan': { todos: Array<{ id: string, content: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled' }>, merge: boolean },
}

// RESULT OF TOOL CALL
export type BuiltinToolResultType = {
	'read_file': { fileContents: string, totalFileLen: number, totalNumLines: number, hasNextPage: boolean },
	'ls_dir': { children: ShallowDirectoryItem[] | null, hasNextPage: boolean, hasPrevPage: boolean, itemsRemaining: number },
	'get_dir_tree': { str: string, },
	'search_pathnames_only': { uris: URI[], hasNextPage: boolean },
	'search_for_files': { uris: URI[], hasNextPage: boolean },
	'search_in_file': { lines: number[]; },
	'read_lint_errors': { lintErrors: LintErrorItem[] | null },
	// ---
	'rewrite_file': Promise<{ lintErrors: LintErrorItem[] | null }>,
	'edit_file': Promise<{ lintErrors: LintErrorItem[] | null }>,
	'create_file_or_folder': { alreadyExists: boolean },
	'delete_file_or_folder': {},
	// ---
	'run_command': { result: string; resolveReason: TerminalResolveReason; },
	'run_persistent_command': { result: string; resolveReason: TerminalResolveReason; },
	'open_persistent_terminal': { persistentTerminalId: string },
	'kill_persistent_terminal': {},
	// ---
	'remember': { note: SymbolNote },
	'forget': { deleted: boolean },
	'list_notes': { notes: SymbolNote[] },
	'find_text': { matches: Array<{ uri: URI, lineNumber: number, previewText: string }>, hasNextPage: boolean },
	'semantic_search': { hits: SemanticHit[], indexState: string },
	'get_file_context': FileContextOutput,
	'get_file_dependencies': FileDependenciesOutput,
	'get_symbol_context': SymbolContextOutput,
	'get_call_graph': CallGraphOutput,
	'pack_context': PackContextOutput,
	'get_project_briefing': ProjectBriefingOutput,
	// --- Web & Git & Browser ---
	'web_search': { results: Array<{ title: string, url: string, snippet: string }> },
	'git_status': { status: string },
	'git_commit': { output: string },
	'git_diff': { diff: string },
	'git_log': { log: string },
	'git_branch': { branch: string, branches: string },
	'browser_screenshot': { screenshotPath: string },
	'launch_subagent': { subagentThreadId: string, result: string, status: 'completed' | 'error' },
	'update_plan': { todos: Array<{ id: string, content: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled' }> },
}


export type ToolCallParams<T extends BuiltinToolName | (string & {})> = T extends BuiltinToolName ? BuiltinToolCallParams[T] : RawToolParamsObj
export type ToolResult<T extends BuiltinToolName | (string & {})> = T extends BuiltinToolName ? BuiltinToolResultType[T] : RawMCPToolCall

export type BuiltinToolName = keyof BuiltinToolResultType

type BuiltinToolParamNameOfTool<T extends BuiltinToolName> = keyof (typeof builtinTools)[T]['params']
export type BuiltinToolParamName = { [T in BuiltinToolName]: BuiltinToolParamNameOfTool<T> }[BuiltinToolName]


export type ToolName = BuiltinToolName | (string & {})
export type ToolParamName<T extends ToolName> = T extends BuiltinToolName ? BuiltinToolParamNameOfTool<T> : string
