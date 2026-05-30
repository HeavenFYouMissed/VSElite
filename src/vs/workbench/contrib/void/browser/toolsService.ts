import { CancellationToken } from '../../../../base/common/cancellation.js'
import { URI } from '../../../../base/common/uri.js'
import { IFileService } from '../../../../platform/files/common/files.js'
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js'
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js'
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js'
import { QueryBuilder } from '../../../services/search/common/queryBuilder.js'
import { ISearchService } from '../../../services/search/common/search.js'
import { IEditCodeService } from './editCodeServiceInterface.js'
import { ITerminalToolService } from './terminalToolService.js'
import { LintErrorItem, BuiltinToolCallParams, BuiltinToolResultType, BuiltinToolName } from '../common/toolsServiceTypes.js'
import { IVoidModelService } from '../common/voidModelService.js'
import { EndOfLinePreference } from '../../../../editor/common/model.js'
import { IVoidCommandBarService } from './voidCommandBarService.js'
import { computeDirectoryTree1Deep, IDirectoryStrService, stringifyDirectoryTree1Deep } from '../common/directoryStrService.js'
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js'
import { timeout } from '../../../../base/common/async.js'
import { RawToolParamsObj } from '../common/sendLLMMessageTypes.js'
import { MAX_CHILDREN_URIs_PAGE, MAX_FILE_CHARS_PAGE, MAX_TERMINAL_BG_COMMAND_TIME, MAX_TERMINAL_INACTIVE_TIME } from '../common/prompt/prompts.js'
import { IVoidSettingsService } from '../common/voidSettingsService.js'
import { generateUuid } from '../../../../base/common/uuid.js'
import { IContextBridgeService } from '../common/contextBridge/contextBridgeService.js'
import { ISemanticIndexService } from '../common/semanticIndex/semanticIndexTypes.js'
import { ILspBridgeAdapter } from './contextBridge/lspBridgeAdapter.js'
import { PackContextTask } from '../common/contextBridge/contextBridgeTypes.js'
import { ILogService } from '../../../../platform/log/common/log.js'
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js'
import {
	runGetFileContext,
	runGetFileDependencies,
	runGetSymbolContext,
	runGetCallGraph,
	runPackContext,
	runGetProjectBriefing,
	stringifyFileContext,
	stringifyFileDependencies,
	stringifySymbolContext,
	stringifyCallGraph,
	stringifyPackContext,
	stringifyProjectBriefing,
} from './contextBridge/contextBridgeTools.js'


// tool use for AI
type ValidateBuiltinParams = { [T in BuiltinToolName]: (p: RawToolParamsObj) => BuiltinToolCallParams[T] }
export type ToolCallContext = { threadId?: string, toolId?: string }
type CallBuiltinTool = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T], ctx?: ToolCallContext) => Promise<{ result: BuiltinToolResultType[T] | Promise<BuiltinToolResultType[T]>, interruptTool?: () => void }> }
type BuiltinToolResultToString = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T], result: Awaited<BuiltinToolResultType[T]>) => string }


const isFalsy = (u: unknown) => {
	return !u || u === 'null' || u === 'undefined'
}

const validateStr = (argName: string, value: unknown) => {
	if (value === null) throw new Error(`Invalid LLM output: ${argName} was null.`)
	if (typeof value !== 'string') throw new Error(`Invalid LLM output format: ${argName} must be a string, but its type is "${typeof value}". Full value: ${JSON.stringify(value)}.`)
	return value
}


// We are NOT checking to make sure in workspace
const validateURI = (uriStr: unknown) => {
	if (uriStr === null) throw new Error(`Invalid LLM output: uri was null.`)
	if (typeof uriStr !== 'string') throw new Error(`Invalid LLM output format: Provided uri must be a string, but it's a(n) ${typeof uriStr}. Full value: ${JSON.stringify(uriStr)}.`)

	// Check if it's already a full URI with scheme (e.g., vscode-remote://, file://, etc.)
	// Look for :// pattern which indicates a scheme is present
	// Examples of supported URIs:
	// - vscode-remote://wsl+Ubuntu/home/user/file.txt (WSL)
	// - vscode-remote://ssh-remote+myserver/home/user/file.txt (SSH)
	// - file:///home/user/file.txt (local file with scheme)
	// - /home/user/file.txt (local file path, will be converted to file://)
	// - C:\Users\file.txt (Windows local path, will be converted to file://)
	if (uriStr.includes('://')) {
		try {
			const uri = URI.parse(uriStr)
			return uri
		} catch (e) {
			// If parsing fails, it's a malformed URI
			throw new Error(`Invalid URI format: ${uriStr}. Error: ${e}`)
		}
	} else {
		// No scheme present, treat as file path
		// This handles regular file paths like /home/user/file.txt or C:\Users\file.txt
		const uri = URI.file(uriStr)
		return uri
	}
}

const validateOptionalURI = (uriStr: unknown) => {
	if (isFalsy(uriStr)) return null
	return validateURI(uriStr)
}

const validateOptionalStr = (argName: string, str: unknown) => {
	if (isFalsy(str)) return null
	return validateStr(argName, str)
}


const validatePageNum = (pageNumberUnknown: unknown) => {
	if (!pageNumberUnknown) return 1
	const parsedInt = Number.parseInt(pageNumberUnknown + '')
	if (!Number.isInteger(parsedInt)) throw new Error(`Page number was not an integer: "${pageNumberUnknown}".`)
	if (parsedInt < 1) throw new Error(`Invalid LLM output format: Specified page number must be 1 or greater: "${pageNumberUnknown}".`)
	return parsedInt
}

const validateNumber = (numStr: unknown, opts: { default: number | null }) => {
	if (typeof numStr === 'number')
		return numStr
	if (isFalsy(numStr)) return opts.default

	if (typeof numStr === 'string') {
		const parsedInt = Number.parseInt(numStr + '')
		if (!Number.isInteger(parsedInt)) return opts.default
		return parsedInt
	}

	return opts.default
}

const validateProposedTerminalId = (terminalIdUnknown: unknown) => {
	if (!terminalIdUnknown) throw new Error(`A value for terminalID must be specified, but the value was "${terminalIdUnknown}"`)
	const terminalId = terminalIdUnknown + ''
	return terminalId
}

const validateBoolean = (b: unknown, opts: { default: boolean }) => {
	if (typeof b === 'string') {
		if (b === 'true') return true
		if (b === 'false') return false
	}
	if (typeof b === 'boolean') {
		return b
	}
	return opts.default
}


const checkIfIsFolder = (uriStr: string) => {
	uriStr = uriStr.trim()
	if (uriStr.endsWith('/') || uriStr.endsWith('\\')) return true
	return false
}

export type SubagentLauncher = (opts: { parentThreadId: string, parentToolId: string, description: string, prompt: string, readOnly: boolean }) => Promise<{ subagentThreadId: string, result: string, status: 'completed' | 'error' }>;
export type NotificationInjector = (threadId: string, content: string, source: 'subagent' | 'terminal' | 'system') => void;

export interface IToolsService {
	readonly _serviceBrand: undefined;
	validateParams: ValidateBuiltinParams;
	callTool: CallBuiltinTool;
	stringOfResult: BuiltinToolResultToString;
	setSubagentLauncher(launcher: SubagentLauncher): void;
	setNotificationInjector(injector: NotificationInjector): void;
	getTodosForThread(threadId: string): Array<{ id: string, content: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled' }>;
}

export const IToolsService = createDecorator<IToolsService>('ToolsService');

export class ToolsService implements IToolsService {

	readonly _serviceBrand: undefined;

	public validateParams: ValidateBuiltinParams;
	public callTool: CallBuiltinTool;
	public stringOfResult: BuiltinToolResultToString;

	private _subagentLauncher: SubagentLauncher | undefined;
	setSubagentLauncher(launcher: SubagentLauncher) { this._subagentLauncher = launcher; }

	private _notificationInjector: NotificationInjector | undefined;
	setNotificationInjector(injector: NotificationInjector) { this._notificationInjector = injector; }

	// Per-thread todo state
	private _todosByThread: Map<string, Array<{ id: string, content: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled' }>> = new Map()
	getTodosForThread(threadId: string) { return this._todosByThread.get(threadId) ?? [] }

	constructor(
		@IFileService fileService: IFileService,
		@IWorkspaceContextService workspaceContextService: IWorkspaceContextService,
		@ISearchService searchService: ISearchService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IVoidModelService voidModelService: IVoidModelService,
		@IEditCodeService editCodeService: IEditCodeService,
		@ITerminalToolService private readonly terminalToolService: ITerminalToolService,
		@IVoidCommandBarService private readonly commandBarService: IVoidCommandBarService,
		@IDirectoryStrService private readonly directoryStrService: IDirectoryStrService,
		@IMarkerService private readonly markerService: IMarkerService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IContextBridgeService private readonly contextBridgeService: IContextBridgeService,
		@ISemanticIndexService private readonly semanticIndexService: ISemanticIndexService,
		@ILspBridgeAdapter private readonly lspBridgeAdapter: ILspBridgeAdapter,
		@ILogService private readonly logService: ILogService,
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
	) {
		const queryBuilder = instantiationService.createInstance(QueryBuilder);

		this.validateParams = {
			read_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, start_line: startLineUnknown, end_line: endLineUnknown, page_number: pageNumberUnknown } = params
				const uri = validateURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)

				let startLine = validateNumber(startLineUnknown, { default: null })
				let endLine = validateNumber(endLineUnknown, { default: null })

				if (startLine !== null && startLine < 1) startLine = null
				if (endLine !== null && endLine < 1) endLine = null

				return { uri, startLine, endLine, pageNumber }
			},
			ls_dir: (params: RawToolParamsObj) => {
				const { uri: uriStr, page_number: pageNumberUnknown } = params

				const uri = validateURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)
				return { uri, pageNumber }
			},
			get_dir_tree: (params: RawToolParamsObj) => {
				const { uri: uriStr, } = params
				const uri = validateURI(uriStr)
				return { uri }
			},
			search_pathnames_only: (params: RawToolParamsObj) => {
				const {
					query: queryUnknown,
					search_in_folder: includeUnknown,
					page_number: pageNumberUnknown
				} = params

				const queryStr = validateStr('query', queryUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				const includePattern = validateOptionalStr('include_pattern', includeUnknown)

				return { query: queryStr, includePattern, pageNumber }

			},
			search_for_files: (params: RawToolParamsObj) => {
				const {
					query: queryUnknown,
					search_in_folder: searchInFolderUnknown,
					is_regex: isRegexUnknown,
					page_number: pageNumberUnknown
				} = params
				const queryStr = validateStr('query', queryUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				const searchInFolder = validateOptionalURI(searchInFolderUnknown)
				const isRegex = validateBoolean(isRegexUnknown, { default: false })
				return {
					query: queryStr,
					isRegex,
					searchInFolder,
					pageNumber
				}
			},
			search_in_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, query: queryUnknown, is_regex: isRegexUnknown } = params;
				const uri = validateURI(uriStr);
				const query = validateStr('query', queryUnknown);
				const isRegex = validateBoolean(isRegexUnknown, { default: false });
				return { uri, query, isRegex };
			},

			read_lint_errors: (params: RawToolParamsObj) => {
				const {
					uri: uriUnknown,
				} = params
				const uri = validateURI(uriUnknown)
				return { uri }
			},

			// ---

			create_file_or_folder: (params: RawToolParamsObj) => {
				const { uri: uriUnknown } = params
				const uri = validateURI(uriUnknown)
				const uriStr = validateStr('uri', uriUnknown)
				const isFolder = checkIfIsFolder(uriStr)
				return { uri, isFolder }
			},

			delete_file_or_folder: (params: RawToolParamsObj) => {
				const { uri: uriUnknown, is_recursive: isRecursiveUnknown } = params
				const uri = validateURI(uriUnknown)
				const isRecursive = validateBoolean(isRecursiveUnknown, { default: false })
				const uriStr = validateStr('uri', uriUnknown)
				const isFolder = checkIfIsFolder(uriStr)
				return { uri, isRecursive, isFolder }
			},

			rewrite_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, new_content: newContentUnknown } = params
				const uri = validateURI(uriStr)
				const newContent = validateStr('newContent', newContentUnknown)
				return { uri, newContent }
			},

			edit_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, search_replace_blocks: searchReplaceBlocksUnknown } = params
				const uri = validateURI(uriStr)
				const searchReplaceBlocks = validateStr('searchReplaceBlocks', searchReplaceBlocksUnknown)
				return { uri, searchReplaceBlocks }
			},

			// ---

			run_command: (params: RawToolParamsObj) => {
				const { command: commandUnknown, cwd: cwdUnknown } = params
				const command = validateStr('command', commandUnknown)
				const cwd = validateOptionalStr('cwd', cwdUnknown)
				const terminalId = generateUuid()
				return { command, cwd, terminalId }
			},
			run_persistent_command: (params: RawToolParamsObj) => {
				const { command: commandUnknown, persistent_terminal_id: persistentTerminalIdUnknown } = params;
				const command = validateStr('command', commandUnknown);
				const persistentTerminalId = validateProposedTerminalId(persistentTerminalIdUnknown)
				return { command, persistentTerminalId };
			},
			open_persistent_terminal: (params: RawToolParamsObj) => {
				const { cwd: cwdUnknown } = params;
				const cwd = validateOptionalStr('cwd', cwdUnknown)
				// No parameters needed; will open a new background terminal
				return { cwd };
			},
			kill_persistent_terminal: (params: RawToolParamsObj) => {
				const { persistent_terminal_id: terminalIdUnknown } = params;
				const persistentTerminalId = validateProposedTerminalId(terminalIdUnknown);
				return { persistentTerminalId };
			},

			// --- Context Bridge ---
			remember: (params: RawToolParamsObj) => {
				const { file_path: filePathUnknown, symbol_name: symbolUnknown, note: noteUnknown } = params
				const filePath = validateStr('file_path', filePathUnknown)
				const symbolName = validateStr('symbol_name', symbolUnknown)
				const note = validateStr('note', noteUnknown)
				return { filePath, symbolName, note }
			},
			forget: (params: RawToolParamsObj) => {
				const { note_id: noteIdUnknown } = params
				const noteId = validateStr('note_id', noteIdUnknown)
				return { noteId }
			},
			list_notes: (params: RawToolParamsObj) => {
				const { file_path: filePathUnknown } = params
				const filePath = validateOptionalStr('file_path', filePathUnknown)
				return { filePath }
			},
			find_text: (params: RawToolParamsObj) => {
				const { query: queryUnknown, is_regex: isRegexUnknown, include_pattern: includeUnknown, page_number: pageNumberUnknown } = params
				const query = validateStr('query', queryUnknown)
				const isRegex = validateBoolean(isRegexUnknown, { default: false })
				const includePattern = validateOptionalStr('include_pattern', includeUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				return { query, isRegex, includePattern, pageNumber }
			},
			semantic_search: (params: RawToolParamsObj) => {
				const { query: queryUnknown, top_k: topKUnknown, include_file: includeFileUnknown, include_files: includeFilesUnknown } = params
				const query = validateStr('query', queryUnknown)
				const topKRaw = typeof topKUnknown === 'number' ? topKUnknown
					: typeof topKUnknown === 'string' && topKUnknown ? Number(topKUnknown)
					: null
				const topK = topKRaw === null || Number.isNaN(topKRaw) ? null : Math.max(1, Math.min(50, Math.floor(topKRaw)))
				const includeFile = validateOptionalStr('include_file', includeFileUnknown)
				// Accept both singular include_file and plural include_files.
				const includeFilesArr: string[] = [];
				if (includeFile) includeFilesArr.push(includeFile);
				if (Array.isArray(includeFilesUnknown)) {
					for (const f of includeFilesUnknown) {
						if (typeof f === 'string' && f) includeFilesArr.push(f);
					}
				}
				const includeFiles = includeFilesArr.length > 0 ? includeFilesArr : null;
				return { query, topK, includeFile, includeFiles }
			},
			get_file_context: (params: RawToolParamsObj) => {
				const filePath = validateStr('file_path', params.file_path)
				return { filePath }
			},
			get_file_dependencies: (params: RawToolParamsObj) => {
				const filePath = validateStr('file_path', params.file_path)
				return { filePath }
			},
			get_symbol_context: (params: RawToolParamsObj) => {
				const filePath = validateStr('file_path', params.file_path)
				const symbolName = validateStr('symbol_name', params.symbol_name)
				return { filePath, symbolName }
			},
			get_call_graph: (params: RawToolParamsObj) => {
				const filePath = validateStr('file_path', params.file_path)
				const symbolName = validateStr('symbol_name', params.symbol_name)
				const rawDir = typeof params.direction === 'string' ? params.direction : 'incoming'
				const direction: 'incoming' | 'outgoing' = rawDir === 'outgoing' ? 'outgoing' : 'incoming'
				const rawDepth = validateNumber(params.depth, { default: 2 }) ?? 2
				const depth = Math.min(Math.max(1, Math.floor(rawDepth)), 4)
				return { filePath, symbolName, direction, depth }
			},
			pack_context: (params: RawToolParamsObj) => {
				const filePath = validateStr('file_path', params.file_path)
				const symbolName = validateStr('symbol_name', params.symbol_name)
				const rawTask = typeof params.task === 'string' ? params.task : 'understand'
				const task: PackContextTask =
					rawTask === 'refactor' ? 'refactor'
					: rawTask === 'debug' ? 'debug'
					: rawTask === 'extend' ? 'extend'
					: 'understand'
				const maxTokens = validateNumber(params.max_tokens, { default: 3000 }) ?? 3000
				return { filePath, symbolName, task, maxTokens }
			},
		get_project_briefing: (params: RawToolParamsObj) => {
			const includeNotes = validateBoolean(params.include_notes, { default: true })
			return { includeNotes }
		},

		// --- Web & Git & Browser ---
		web_search: (params: RawToolParamsObj) => {
			const query = validateStr('query', params.query)
			const maxResults = validateNumber(params.max_results, { default: 5 }) ?? 5
			return { query, maxResults }
		},
		git_status: (_params: RawToolParamsObj) => {
			return {}
		},
		git_commit: (params: RawToolParamsObj) => {
			const message = validateStr('message', params.message)
			return { message }
		},
		git_diff: (params: RawToolParamsObj) => {
			const staged = validateBoolean(params.staged, { default: false })
			return { staged }
		},
		git_log: (params: RawToolParamsObj) => {
			const count = validateNumber(params.count, { default: 10 }) ?? 10
			return { count }
		},
		git_branch: (_params: RawToolParamsObj) => {
			return {}
		},
		browser_screenshot: (params: RawToolParamsObj) => {
			const url = validateStr('url', params.url)
			return { url }
		},
		launch_subagent: (params: RawToolParamsObj) => {
			const description = validateStr('description', params.description)
			const prompt = validateStr('prompt', params.prompt)
			const readOnly = params.read_only === undefined ? true : !!params.read_only
			return { description, prompt, readOnly }
		},
		update_plan: (params: RawToolParamsObj) => {
			let todos: Array<{ id: string, content: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled' }>
			if (typeof params.todos === 'string') {
				todos = JSON.parse(params.todos)
			} else if (Array.isArray(params.todos)) {
				todos = params.todos as any
			} else {
				throw new Error('todos must be a JSON array')
			}
			const merge = params.merge === undefined ? false : !!params.merge
			return { todos, merge }
		},

	}


		// Lightweight telemetry wrapper for Context Bridge tools — emits one
		// structured log line per invocation with duration + outcome. No params
		// or result content (PII-safe). Logs `info` on success, `warn` on failure;
		// failure re-throws so the upstream tool-call error path is unchanged.
		const log = this.logService
		const cbTrace = <T>(name: string, run: () => Promise<T>): Promise<T> => {
			const t0 = performance.now()
			return run().then(
				result => {
					log.info(`[cb-tool] tool=${name} duration_ms=${Math.round(performance.now() - t0)} ok=true`)
					return result
				},
				err => {
					const cls = err instanceof Error ? err.constructor.name : 'unknown'
					log.warn(`[cb-tool] tool=${name} duration_ms=${Math.round(performance.now() - t0)} ok=false err=${cls}`)
					throw err
				},
			)
		}

		this.callTool = {
			read_file: async ({ uri, startLine, endLine, pageNumber }) => {
				await voidModelService.initializeModel(uri)
				const { model } = await voidModelService.getModelSafe(uri)
				if (model === null) { throw new Error(`No contents; File does not exist.`) }

				let contents: string
				if (startLine === null && endLine === null) {
					contents = model.getValue(EndOfLinePreference.LF)
				}
				else {
					const startLineNumber = startLine === null ? 1 : startLine
					const endLineNumber = endLine === null ? model.getLineCount() : endLine
					contents = model.getValueInRange({ startLineNumber, startColumn: 1, endLineNumber, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
				}

				const totalNumLines = model.getLineCount()

				const fromIdx = MAX_FILE_CHARS_PAGE * (pageNumber - 1)
				const toIdx = MAX_FILE_CHARS_PAGE * pageNumber - 1
				const fileContents = contents.slice(fromIdx, toIdx + 1) // paginate
				const hasNextPage = (contents.length - 1) - toIdx >= 1
				const totalFileLen = contents.length
				return { result: { fileContents, totalFileLen, hasNextPage, totalNumLines } }
			},

			ls_dir: async ({ uri, pageNumber }) => {
				const dirResult = await computeDirectoryTree1Deep(fileService, uri, pageNumber)
				return { result: dirResult }
			},

			get_dir_tree: async ({ uri }) => {
				const str = await this.directoryStrService.getDirectoryStrTool(uri)
				return { result: { str } }
			},

			search_pathnames_only: async ({ query: queryStr, includePattern, pageNumber }) => {

				const query = queryBuilder.file(workspaceContextService.getWorkspace().folders.map(f => f.uri), {
					filePattern: queryStr,
					includePattern: includePattern ?? undefined,
					sortByScore: true, // makes results 10x better
				})
				const data = await searchService.fileSearch(query, CancellationToken.None)

				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1)
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1
				const uris = data.results
					.slice(fromIdx, toIdx + 1) // paginate
					.map(({ resource, results }) => resource)

				const hasNextPage = (data.results.length - 1) - toIdx >= 1
				return { result: { uris, hasNextPage } }
			},

			search_for_files: async ({ query: queryStr, isRegex, searchInFolder, pageNumber }) => {
				const searchFolders = searchInFolder === null ?
					workspaceContextService.getWorkspace().folders.map(f => f.uri)
					: [searchInFolder]

				const query = queryBuilder.text({
					pattern: queryStr,
					isRegExp: isRegex,
				}, searchFolders)

				const data = await searchService.textSearch(query, CancellationToken.None)

				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1)
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1
				const uris = data.results
					.slice(fromIdx, toIdx + 1) // paginate
					.map(({ resource, results }) => resource)

				const hasNextPage = (data.results.length - 1) - toIdx >= 1
				return { result: { queryStr, uris, hasNextPage } }
			},
			search_in_file: async ({ uri, query, isRegex }) => {
				await voidModelService.initializeModel(uri);
				const { model } = await voidModelService.getModelSafe(uri);
				if (model === null) { throw new Error(`No contents; File does not exist.`); }
				const contents = model.getValue(EndOfLinePreference.LF);
				const contentOfLine = contents.split('\n');
				const totalLines = contentOfLine.length;
				const regex = isRegex ? new RegExp(query) : null;
				const lines: number[] = []
				for (let i = 0; i < totalLines; i++) {
					const line = contentOfLine[i];
					if ((isRegex && regex!.test(line)) || (!isRegex && line.includes(query))) {
						const matchLine = i + 1;
						lines.push(matchLine);
					}
				}
				return { result: { lines } };
			},

			read_lint_errors: async ({ uri }) => {
				await timeout(1000)
				const { lintErrors } = this._getLintErrors(uri)
				return { result: { lintErrors } }
			},

			// ---

			create_file_or_folder: async ({ uri, isFolder }) => {
				let alreadyExists = false;
				try {
					await fileService.resolve(uri);
					alreadyExists = true;
				} catch { /* does not exist */ }
				if (isFolder)
					await fileService.createFolder(uri)
				else {
					await fileService.createFile(uri)
				}
				return { result: { alreadyExists } }
			},

			delete_file_or_folder: async ({ uri, isRecursive }) => {
				await fileService.del(uri, { recursive: isRecursive })
				voidModelService.disposeModel(uri)
				return { result: {} }
			},

			rewrite_file: async ({ uri, newContent }) => {
				await voidModelService.initializeModel(uri)
				if (this.commandBarService.getStreamState(uri) === 'streaming') {
					throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
				}
				await editCodeService.callBeforeApplyOrEdit(uri)
				editCodeService.instantlyRewriteFile({ uri, newContent, clearEditorDiffUI: true })
				// at end, get lint errors
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000)
					const { lintErrors } = this._getLintErrors(uri)
					return { lintErrors }
				})
				return { result: lintErrorsPromise }
			},

			edit_file: async ({ uri, searchReplaceBlocks }) => {
				await voidModelService.initializeModel(uri)
				if (this.commandBarService.getStreamState(uri) === 'streaming') {
					throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
				}
				await editCodeService.callBeforeApplyOrEdit(uri)
				editCodeService.instantlyApplySearchReplaceBlocks({ uri, searchReplaceBlocks, clearEditorDiffUI: true })

				// at end, get lint errors
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000)
					const { lintErrors } = this._getLintErrors(uri)
					return { lintErrors }
				})

				return { result: lintErrorsPromise }
			},
			// ---
			run_command: async ({ command, cwd, terminalId }) => {
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'temporary', cwd, terminalId })
				return { result: resPromise, interruptTool: interrupt }
			},
			run_persistent_command: async ({ command, persistentTerminalId }) => {
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'persistent', persistentTerminalId })
				return { result: resPromise, interruptTool: interrupt }
			},
			open_persistent_terminal: async ({ cwd }) => {
				const persistentTerminalId = await this.terminalToolService.createPersistentTerminal({ cwd })
				return { result: { persistentTerminalId } }
			},
			kill_persistent_terminal: async ({ persistentTerminalId }) => {
				// Close the background terminal by sending exit
				await this.terminalToolService.killPersistentTerminal(persistentTerminalId)
				return { result: {} }
			},

			// --- Context Bridge ---
			remember: async ({ filePath, symbolName, note }) => cbTrace('remember', async () => {
				const saved = await this.contextBridgeService.addNote(filePath, symbolName, note)
				return { result: { note: saved } }
			}),
			forget: async ({ noteId }) => cbTrace('forget', async () => {
				const deleted = await this.contextBridgeService.deleteNote(noteId)
				return { result: { deleted } }
			}),
			list_notes: async ({ filePath }) => cbTrace('list_notes', async () => {
				const notes = await this.contextBridgeService.listNotes(filePath ?? undefined)
				return { result: { notes } }
			}),
			find_text: async ({ query: queryStr, isRegex, includePattern, pageNumber }) => cbTrace('find_text', async () => {
				const searchFolders = workspaceContextService.getWorkspace().folders.map(f => f.uri)
				const tQuery = queryBuilder.text({
					pattern: queryStr,
					isRegExp: isRegex,
				}, searchFolders, {
					includePattern: includePattern ?? undefined,
					previewOptions: { matchLines: 1, charsPerLine: 250 },
				})
				const data = await searchService.textSearch(tQuery, CancellationToken.None)

				// Flatten per-file matches into per-line hits.
				const flat: Array<{ uri: URI, lineNumber: number, previewText: string }> = []
				for (const fm of data.results) {
					for (const r of (fm.results ?? [])) {
						const match = r as { rangeLocations?: Array<{ source: { startLineNumber: number } }>, previewText?: string }
						if (!match.rangeLocations || !match.previewText) continue
						for (const loc of match.rangeLocations) {
							flat.push({
								uri: fm.resource,
								lineNumber: loc.source.startLineNumber + 1,
								previewText: match.previewText,
							})
						}
					}
				}

				const pageSize = MAX_CHILDREN_URIs_PAGE
				const fromIdx = pageSize * (pageNumber - 1)
				const toIdx = pageSize * pageNumber - 1
				const matches = flat.slice(fromIdx, toIdx + 1)
				const hasNextPage = (flat.length - 1) - toIdx >= 1
				return { result: { matches, hasNextPage } }
			}),
			semantic_search: async ({ query, topK, includeFile, includeFiles }) => cbTrace('semantic_search', async () => {
				const opts: { topK?: number; files?: string[] } = {}
				if (topK !== null) opts.topK = topK
				if (includeFiles) opts.files = includeFiles
				const hits = await this.semanticIndexService.retrieve(query, opts)
				const indexState = this.semanticIndexService.getStatus().state
				return { result: { hits, indexState } }
			}),
			get_file_context: async (params) => cbTrace('get_file_context', async () => {
				const result = await runGetFileContext(this.lspBridgeAdapter, fileService, params)
				return { result }
			}),
			get_file_dependencies: async (params) => cbTrace('get_file_dependencies', async () => {
				const result = await runGetFileDependencies(this.lspBridgeAdapter, fileService, workspaceContextService, params)
				return { result }
			}),
			get_symbol_context: async (params) => cbTrace('get_symbol_context', async () => {
				const result = await runGetSymbolContext(this.lspBridgeAdapter, this.contextBridgeService, params)
				return { result }
			}),
			get_call_graph: async (params) => cbTrace('get_call_graph', async () => {
				const result = await runGetCallGraph(this.lspBridgeAdapter, params)
				return { result }
			}),
			pack_context: async (params) => cbTrace('pack_context', async () => {
				const result = await runPackContext(this.lspBridgeAdapter, this.contextBridgeService, params)
				return { result }
			}),
		get_project_briefing: async (params) => cbTrace('get_project_briefing', async () => {
			const result = await runGetProjectBriefing(this.lspBridgeAdapter, fileService, workspaceContextService, this.contextBridgeService, params)
			return { result }
		}),

		// --- Web & Git & Browser ---
		web_search: async ({ query, maxResults }) => {
			const channel = this.mainProcessService.getChannel('void-channel-webSearch')
			const cap = Math.min(10, Math.max(1, maxResults ?? 5))
			const { results } = await channel.call<{ results: Array<{ title: string; url: string; snippet: string }> }>('search', { query, maxResults: cap })
			return { result: { results: results ?? [] } }
		},
		git_status: async () => {
			const { resPromise } = await this.terminalToolService.runCommand('git status --porcelain', { type: 'temporary', cwd: null, terminalId: generateUuid() })
			const res = await resPromise
			const status = res.result.trim() || '(clean working tree)'
			return { result: { status } }
		},
		git_commit: async ({ message }) => {
			const escaped = message.replace(/"/g, '\\"')
			const { resPromise } = await this.terminalToolService.runCommand(`git add -A && git commit -m "${escaped}"`, { type: 'temporary', cwd: null, terminalId: generateUuid() })
			const res = await resPromise
			return { result: { output: res.result.trim() } }
		},
		git_diff: async ({ staged }) => {
			const cmd = staged ? 'git diff --staged' : 'git diff'
			const { resPromise } = await this.terminalToolService.runCommand(`${cmd} | cat`, { type: 'temporary', cwd: null, terminalId: generateUuid() })
			const res = await resPromise
			return { result: { diff: res.result.trim() || '(no diff)' } }
		},
		git_log: async ({ count }) => {
			const { resPromise } = await this.terminalToolService.runCommand(`git log --oneline --no-decorate -n ${count}`, { type: 'temporary', cwd: null, terminalId: generateUuid() })
			const res = await resPromise
			return { result: { log: res.result.trim() || '(no commits)' } }
		},
		git_branch: async () => {
			const { resPromise: branchRes } = await this.terminalToolService.runCommand('git branch --show-current', { type: 'temporary', cwd: null, terminalId: generateUuid() })
			const br = await branchRes
			const { resPromise: allRes } = await this.terminalToolService.runCommand('git branch -a --no-color', { type: 'temporary', cwd: null, terminalId: generateUuid() })
			const all = await allRes
			return { result: { branch: br.result.trim(), branches: all.result.trim() } }
		},
		browser_screenshot: async ({ url }) => {
			const screenshotPath = `[browser_screenshot] Not implemented: Taking a screenshot of "${url}" requires Electron BrowserWindow integration. This feature needs access to Electron's BrowserWindow API to load the URL off-screen and capture the rendered page. To enable: (1) create a BrowserWindow with offscreen rendering, (2) loadURL, (3) call webContents.capturePage(), (4) save the NativeImage to disk.`
			return { result: { screenshotPath } }
		},
		update_plan: async ({ todos, merge }, ctx) => {
			const threadId = ctx?.threadId ?? '__default__'
			let currentTodos = this._todosByThread.get(threadId) ?? []
			if (merge) {
				for (const todo of todos) {
					const idx = currentTodos.findIndex(t => t.id === todo.id)
					if (idx >= 0) {
						currentTodos[idx] = { ...currentTodos[idx], ...todo }
					} else {
						currentTodos.push(todo)
					}
				}
			} else {
				currentTodos = [...todos]
			}
			this._todosByThread.set(threadId, currentTodos)
			return { result: { todos: currentTodos } }
		},
		launch_subagent: async ({ description, prompt, readOnly }, ctx) => {
			const parentThreadId = ctx?.threadId
			const parentToolId = ctx?.toolId
			if (!parentThreadId || !parentToolId || !this._subagentLauncher) {
				return { result: { subagentThreadId: '', result: 'Error: subagent launch requires a parent thread context and the subagent launcher must be registered.', status: 'error' as const } }
			}
			// Fire-and-forget: launch subagent in background, return immediately
			// so the parent agent can continue working while the subagent runs.
			const desc = description || 'Background task'
			const subagentPromise = this._subagentLauncher({
				parentThreadId,
				parentToolId,
				description: desc,
				prompt: prompt || '(no prompt)',
				readOnly: readOnly ?? true,
			})
			// Don't await — let the subagent run independently.
			// The subagent's result will be visible via the agent panel and subagentState.
			subagentPromise.then(res => {
				// Subagent completed — inject notification into parent thread
				console.log(`[subagent] ${desc} finished: ${res.status}`)
				if (this._notificationInjector && parentThreadId) {
					const truncatedResult = res.result.length > 4000
						? res.result.slice(0, 4000) + '\n\n...truncated (see agent panel for full output)'
						: res.result;
					this._notificationInjector(
						parentThreadId,
						`[Background subagent "${desc}" ${res.status}]\n${truncatedResult}`,
						'subagent'
					)
				}
			}).catch(err => {
				console.error(`[subagent] ${desc} error:`, err)
				if (this._notificationInjector && parentThreadId) {
					this._notificationInjector(
						parentThreadId,
						`[Background subagent "${desc}" failed]\nError: ${err instanceof Error ? err.message : String(err)}`,
						'subagent'
					)
				}
			})
			return { result: { subagentThreadId: `(launching)`, result: `Subagent "${desc}" launched in background. Continue with your main task — you will see results in the agent panel.`, status: 'completed' as const } }
		},
	}


		const nextPageStr = (hasNextPage: boolean) => hasNextPage ? '\n\n(more on next page...)' : ''

		const stringifyLintErrors = (lintErrors: LintErrorItem[]) => {
			return lintErrors
				.map((e, i) => `Error ${i + 1}:\nLines Affected: ${e.startLineNumber}-${e.endLineNumber}\nError message:${e.message}`)
				.join('\n\n')
				.substring(0, MAX_FILE_CHARS_PAGE)
		}

		// given to the LLM after the call for successful tool calls
		this.stringOfResult = {
			read_file: (params, result) => {
				return `${params.uri.fsPath}\n\`\`\`\n${result.fileContents}\n\`\`\`${nextPageStr(result.hasNextPage)}${result.hasNextPage ? `\nMore info because truncated: this file has ${result.totalNumLines} lines, or ${result.totalFileLen} characters.` : ''}`
			},
			ls_dir: (params, result) => {
				const dirTreeStr = stringifyDirectoryTree1Deep(params, result)
				return dirTreeStr // + nextPageStr(result.hasNextPage) // already handles num results remaining
			},
			get_dir_tree: (params, result) => {
				return result.str
			},
			search_pathnames_only: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage)
			},
			search_for_files: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage)
			},
			search_in_file: (params, result) => {
				const { model } = voidModelService.getModel(params.uri)
				if (!model) return '<Error getting string of result>'
				const lines = result.lines.map(n => {
					const lineContent = model.getValueInRange({ startLineNumber: n, startColumn: 1, endLineNumber: n, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
					return `Line ${n}:\n\`\`\`\n${lineContent}\n\`\`\``
				}).join('\n\n');
				return lines;
			},
			read_lint_errors: (params, result) => {
				return result.lintErrors ?
					stringifyLintErrors(result.lintErrors)
					: 'No lint errors found.'
			},
			// ---
			create_file_or_folder: (params, result) => {
				return result.alreadyExists
					? `URI ${params.uri.fsPath} already existed (no changes made).`
					: `URI ${params.uri.fsPath} successfully created.`
			},
			delete_file_or_folder: (params, result) => {
				return `URI ${params.uri.fsPath} successfully deleted.`
			},
			edit_file: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			rewrite_file: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			run_command: (params, result) => {
				const { resolveReason, result: result_, } = result
				// success
				if (resolveReason.type === 'done') {
					return `${result_}\n(exit code ${resolveReason.exitCode})`
				}
				// normal command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command ran, but was automatically killed by V3Code after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity and did not finish successfully. To try with more time, open a persistent terminal and run the command there.`
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},

			run_persistent_command: (params, result) => {
				const { resolveReason, result: result_, } = result
				const { persistentTerminalId } = params
				// success
				if (resolveReason.type === 'done') {
					return `${result_}\n(exit code ${resolveReason.exitCode})`
				}
				// bg command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command is running in terminal ${persistentTerminalId}. The given outputs are the results after ${MAX_TERMINAL_BG_COMMAND_TIME} seconds.`
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},

			open_persistent_terminal: (_params, result) => {
				const { persistentTerminalId } = result;
				return `Successfully created persistent terminal. persistentTerminalId="${persistentTerminalId}"`;
			},
			kill_persistent_terminal: (params, _result) => {
				return `Successfully closed terminal "${params.persistentTerminalId}".`;
			},

			// --- Context Bridge ---
			remember: (_params, result) => {
				const n = result.note
				return `Saved note ${n.id} for symbol "${n.symbolName}" in ${n.filePath}.`
			},
			forget: (params, result) => {
				return result.deleted
					? `Deleted note ${params.noteId}.`
					: `No note found with id ${params.noteId}.`
			},
			list_notes: (params, result) => {
				if (result.notes.length === 0) {
					return params.filePath
						? `No notes found for ${params.filePath}.`
						: `No notes saved in this workspace.`
				}
				return result.notes
					.map(n => `- [${n.id}] ${n.filePath} :: ${n.symbolName}\n  ${n.note}`)
					.join('\n')
			},
			find_text: (params, result) => {
				if (result.matches.length === 0) {
					return `No matches for "${params.query}".`
				}
				const lines = result.matches.map(m => `${m.uri.fsPath}:${m.lineNumber}: ${m.previewText.trim()}`).join('\n')
				return lines + nextPageStr(result.hasNextPage)
			},
			semantic_search: (params, result) => {
				if (result.hits.length === 0) {
					// Help the LLM (and through it, the user) understand WHY there were no hits.
					if (result.indexState === 'uninitialized') {
						return `The semantic index hasn't been initialized yet. Ask the user to run the "V3Code: Rebuild Codebase Index" command from the command palette (Ctrl/Cmd+Shift+P). After it finishes, retry semantic_search.`
					}
					if (result.indexState === 'walking' || result.indexState === 'chunking' || result.indexState === 'embedding') {
						return `The semantic index is still being built (state: ${result.indexState}). Wait for it to finish, then retry. Check the status bar for progress.`
					}
					if (result.indexState === 'error') {
						return `The semantic index is in an error state. Ask the user to check the V3Code logs and re-run "V3Code: Rebuild Codebase Index".`
					}
					if (result.indexState === 'idle' || result.indexState === 'ready') {
						return `No semantic matches for "${params.query}". The index is ${result.indexState} but returned 0 hits — either the corpus is empty (run "V3Code: Rebuild Codebase Index") or the query is genuinely unrelated to anything indexed. Try \`find_text\` or rephrase the query.`
					}
					return `No semantic matches for "${params.query}". (index state: ${result.indexState})`
				}
				const header = `Top ${result.hits.length} semantic matches (index: ${result.indexState}):\n`
				const body = result.hits.map((h, i) => {
					const c = h.chunk
					const signals = [
						h.signals.vec !== undefined ? `vec=${h.signals.vec.toFixed(2)}` : null,
						h.signals.fts !== undefined ? `fts=${h.signals.fts.toFixed(2)}` : null,
						h.signals.hyde !== undefined ? `hyde=${h.signals.hyde.toFixed(2)}` : null,
						h.signals.terms !== undefined ? `terms=${h.signals.terms.toFixed(2)}` : null,
					].filter(Boolean).join(' ')
					const loc = `${c.file}:${c.startLine}-${c.endLine}`
					const head = `${i + 1}. [${c.kind}] ${c.name || '<anon>'} — ${loc} (score=${h.score.toFixed(3)} ${signals})`
					const content = h.content.length > 800 ? h.content.slice(0, 800) + '\n…' : h.content
					return `${head}\n\`\`\`${c.language || ''}\n${content}\n\`\`\``
				}).join('\n\n')
				return header + body
			},
			get_file_context: (_params, result) => stringifyFileContext(result),
			get_file_dependencies: (_params, result) => stringifyFileDependencies(result),
			get_symbol_context: (_params, result) => stringifySymbolContext(result),
			get_call_graph: (_params, result) => stringifyCallGraph(result),
			pack_context: (_params, result) => stringifyPackContext(result),
		get_project_briefing: (_params, result) => stringifyProjectBriefing(result),

		// --- Web & Git & Browser ---
		web_search: (params, result) => {
			if (result.results.length === 0) return `No results found for "${params.query}".`
			return result.results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join('\n\n')
		},
		git_status: (_params, result) => result.status,
		git_commit: (_params, result) => result.output,
		git_diff: (_params, result) => result.diff,
		git_log: (_params, result) => result.log,
		git_branch: (_params, result) => `current: ${result.branch}\n${result.branches}`,
		browser_screenshot: (_params, result) => result.screenshotPath,
		launch_subagent: (_params, result) => `Subagent [${result.status}]: ${result.result}`,
		update_plan: (_params, result) => {
			const total = result.todos.length
			const done = result.todos.filter(t => t.status === 'completed').length
			const inProg = result.todos.filter(t => t.status === 'in_progress').length
			return `Plan updated: ${done}/${total} completed${inProg ? `, ${inProg} in progress` : ''}`
		},
	}



	}


	private static readonly _TS_ONLY_CODES = new Set([
		'1005', '1011', '1029', '1064', '1109', '1184', '1219', '1235', '1340',
		'2307', '2304', '2503', '2580', '2686', '2792', '7026', '7044', '8010', '8017',
		'17004', '17009',
	]);

	private _getLintErrors(uri: URI): { lintErrors: LintErrorItem[] | null } {
		const isJS = /\.(js|mjs|cjs|jsx)$/i.test(uri.fsPath);
		const lintErrors = this.markerService
			.read({ resource: uri })
			.filter(l => {
				if (l.severity !== MarkerSeverity.Error && l.severity !== MarkerSeverity.Warning) return false;
				if (isJS) {
					const code = typeof l.code === 'string' ? l.code : l.code?.value || '';
					if (l.source === 'ts' || l.source === 'typescript') {
						if (ToolsService._TS_ONLY_CODES.has(String(code))) return false;
						if (/can only be used in typescript/i.test(l.message)) return false;
						if (/decorators are not valid here/i.test(l.message)) return false;
					}
				}
				return true;
			})
			.slice(0, 100)
			.map(l => ({
				code: typeof l.code === 'string' ? l.code : l.code?.value || '',
				message: (l.severity === MarkerSeverity.Error ? '(error) ' : '(warning) ') + l.message,
				startLineNumber: l.startLineNumber,
				endLineNumber: l.endLineNumber,
			} satisfies LintErrorItem))

		if (!lintErrors.length) return { lintErrors: null }
		return { lintErrors, }
	}


}

registerSingleton(IToolsService, ToolsService, InstantiationType.Eager);
