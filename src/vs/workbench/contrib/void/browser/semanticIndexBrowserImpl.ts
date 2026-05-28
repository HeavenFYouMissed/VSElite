/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Renderer-side semantic index implementation.
 *
 * Why this exists:
 *   The "full" SemanticIndexService in common/semanticIndex/ statically imports
 *   Node builtins (path/fs/os/crypto/@vscode/sqlite3) which the renderer's
 *   ESM loader cannot resolve. Until that service is moved behind a node-side
 *   IPC boundary, the renderer needs an indexer that actually does work — not
 *   a no-op — so the UI meter has something to display and the agent's
 *   semantic_search tool gets non-empty results.
 *
 * What this does:
 *   - Walks every workspace folder via IFileService.
 *   - Loads and respects `.gitignore` files discovered during the walk.
 *   - Skips noisy paths (node_modules, .git, dist, out, build, .v3code, etc.)
 *     and oversized / binary files.
 *   - Chunks each file with a sliding line window (80 lines, 10-line overlap)
 *     so retrieval has structure-aware units even without tree-sitter here.
 *   - Hashes each chunk with the Web Crypto API (no Node `crypto` import).
 *   - Stores chunks in memory (Map). Survives until window reload — acceptable
 *     for v1; sqlite-backed persistence lands when the IPC boundary does.
 *   - retrieve() runs a token-overlap scoring pass and returns top-K hits.
 *   - Watches IFileService for changes and incrementally re-indexes touched
 *     files so the index stays current without manual rebuilds.
 *   - Emits onDidChangeStatus on a throttled interval so the meter renders
 *     smooth progress (files/sec, ETA, current file) without thrashing.
 *   - Reads v3code.semanticIndex.* configuration so settings actually do
 *     something (enabled toggle, auto-rebuild, custom exclude patterns).
 */

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService, IFileStat } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Chunk, ChunkKind, Hit, IndexStatus, ISemanticIndexService } from '../common/semanticIndex/semanticIndexTypes.js';

interface IndexedChunk extends Chunk {
	content: string;
	tokens: Set<string>;
}

interface GitignoreRule {
	re: RegExp;
	negate: boolean;
	dirOnly: boolean;
}

interface GitignoreLayer {
	dir: string;
	rules: GitignoreRule[];
}

const SKIP_DIRS = new Set([
	'node_modules', '.git', '.hg', '.svn', 'dist', 'out', 'build',
	'.next', '.turbo', '.cache', '.parcel-cache', 'coverage',
	'.v3code', '.vscode-test', '__pycache__', 'venv', '.venv', 'target',
	'.gradle', '.idea', '.vs', 'bin', 'obj', '.terraform'
]);

const BINARY_EXTS = new Set([
	'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg', 'pdf',
	'zip', 'gz', 'tar', 'rar', '7z', 'jar', 'war', 'class', 'exe', 'dll',
	'so', 'dylib', 'wasm', 'bin', 'iso', 'dmg', 'msi', 'pyc', 'pyo',
	'mp3', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'ogg', 'wav', 'flac',
	'woff', 'woff2', 'ttf', 'otf', 'eot', 'lock', 'sqlite', 'db'
]);

const MAX_FILE_BYTES = 1_000_000;
const WINDOW_LINES = 80;
const WINDOW_OVERLAP = 10;
const STATUS_EMIT_MS = 250;
const INCREMENTAL_DEBOUNCE_MS = 2_000;
const CONFIG_PREFIX = 'v3code.semanticIndex';

function compileGitignorePattern(raw: string): GitignoreRule | null {
	const trimmed = raw.trim();
	if (!trimmed || trimmed.startsWith('#')) return null;
	let pat = trimmed;
	const negate = pat.startsWith('!');
	if (negate) pat = pat.slice(1);
	const dirOnly = pat.endsWith('/');
	if (dirOnly) pat = pat.slice(0, -1);
	const rooted = pat.startsWith('/');
	if (rooted) pat = pat.slice(1);
	if (!pat) return null;
	let re = '';
	for (let i = 0; i < pat.length; i++) {
		const c = pat[i];
		if (c === '*') {
			if (pat[i + 1] === '*') { re += '.*'; i++; }
			else re += '[^/]*';
		} else if (c === '?') {
			re += '[^/]';
		} else if ('.+^$()|{}[]\\'.includes(c)) {
			re += '\\' + c;
		} else {
			re += c;
		}
	}
	const prefix = rooted ? '^' : '(^|/)';
	return { re: new RegExp(prefix + re + '($|/)'), negate, dirOnly };
}

function isIgnoredByLayer(relPath: string, isDir: boolean, layers: readonly GitignoreLayer[]): boolean {
	let ignored = false;
	for (const layer of layers) {
		for (const rule of layer.rules) {
			if (rule.dirOnly && !isDir) continue;
			if (rule.re.test(relPath)) ignored = !rule.negate;
		}
	}
	return ignored;
}

function langFromExt(ext: string): string {
	const map: Record<string, string> = {
		ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
		mjs: 'javascript', cjs: 'javascript', py: 'python', rs: 'rust', go: 'go',
		java: 'java', cs: 'csharp', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'c',
		hpp: 'cpp', rb: 'ruby', php: 'php', swift: 'swift', kt: 'kotlin', scala: 'scala',
		md: 'markdown', mdx: 'markdown', json: 'json', yml: 'yaml', yaml: 'yaml',
		toml: 'toml', xml: 'xml', html: 'html', css: 'css', scss: 'scss', sh: 'shellscript',
		bash: 'shellscript', zsh: 'shellscript', ps1: 'powershell', sql: 'sql'
	};
	return map[ext.toLowerCase()] ?? 'plaintext';
}

async function sha256Hex(input: string): Promise<string> {
	const bytes = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function tokenize(text: string): string[] {
	// Split CamelCase/PascalCase into sub-tokens, then extract identifiers.
	// "MyFunctionName" → ["my", "function", "name"]
	const parts: string[] = [];
	const re = /[A-Z]?[a-z0-9]+|[A-Z]+(?=[A-Z][a-z]|\d|$)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		const tok = m[0].toLowerCase();
		if (tok.length >= 2) parts.push(tok);
	}
	return parts;
}

const STOPWORDS = new Set([
	'the', 'is', 'are', 'was', 'were', 'a', 'an', 'and', 'or', 'but',
	'if', 'in', 'on', 'at', 'to', 'of', 'for', 'with', 'from', 'by',
	'as', 'be', 'it', 'its', 'this', 'that', 'these', 'those', 'not',
	'no', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would',
	'can', 'could', 'may', 'might', 'should', 'must', 'into', 'over',
	'under', 'about', 'such', 'like', 'just', 'also', 'then', 'than',
	'so', 'very', 'too', 'only', 'how', 'what', 'when', 'where', 'who',
	'which', 'why', 'we', 'you', 'they', 'he', 'she', 'me', 'my', 'our',
	'their', 'your', 'all', 'some', 'any', 'each', 'every', 'both',
]);

/** Whitelist of dot-prefixed filenames that should be indexed. */
const INDEXABLE_DOTFILES = new Set([
	'.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yaml', '.eslintrc.yml',
	'.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.yaml', '.prettierrc.yml',
	'.babelrc', '.babelrc.js', '.babelrc.json',
	'.env.example', '.env.local', '.env.development', '.env.production',
	'.editorconfig', '.gitattributes', '.gitignore',
	'.nvmrc', '.npmrc', '.node-version',
	'.dockerignore',
]);

export class SemanticIndexBrowserImpl extends Disposable implements ISemanticIndexService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeStatus = this._register(new Emitter<IndexStatus>());
	readonly onDidChangeStatus: Event<IndexStatus> = this._onDidChangeStatus.event;

	private _status: IndexStatus = {
		state: 'uninitialized',
		filesTotal: 0,
		filesIndexed: 0,
		chunksTotal: 0,
		modelId: 'lexical-v1'
	};

	private chunks = new Map<string, IndexedChunk>();
	/** file relPath → chunk ids, so we can drop stale chunks on incremental update. */
	private fileToChunks = new Map<string, Set<string>>();
	private rebuildInFlight: Promise<void> | null = null;
	private lastEmitAt = 0;
	private _pendingChanges = new Set<string>();
	private _incrementalTimer: ReturnType<typeof setTimeout> | null = null;
	private _initDone = false;
	/** Cached gitignore layers from the last walk, keyed by directory URI path. */
	private gitignoreCache = new Map<string, GitignoreLayer | null>();

	private get _sessionKey(): string {
		const folders = this.workspace.getWorkspace().folders;
		if (folders.length === 0) return 'v3code-index:no-workspace';
		return 'v3code-index:' + folders.map(f => f.uri.toString()).sort().join('|');
	}

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspace: IWorkspaceContextService,
		@IConfigurationService private readonly configService: IConfigurationService,
		@ILogService private readonly logService: ILogService,
	) {
		super();

		// File-watcher: keep the index live. Debounce bursts (save-all, branch
		// switch, rebase) into a single incremental update.
		this._register(this.fileService.onDidFilesChange(e => {
			if (!this._initDone || this._status.state === 'error') return;
			let touched = false;
			for (const r of e.rawAdded) { if (this._shouldWatch(r.fsPath)) { this._pendingChanges.add(r.fsPath); touched = true; } }
			for (const r of e.rawUpdated) { if (this._shouldWatch(r.fsPath)) { this._pendingChanges.add(r.fsPath); touched = true; } }
			for (const r of e.rawDeleted) {
				// Remove stale chunks immediately for deleted files (no debounce needed).
				const rel = this._absToRel(r.fsPath);
				if (rel) this._removeFileChunks(rel);
			}
			if (touched) this._scheduleIncremental();
		}));

		// Config changes: if the user flips enabled→true, auto-rebuild.
		this._register(this.configService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(CONFIG_PREFIX)) {
				if (this._readConfig().enabled && !this._initDone) {
					void this._initAndMaybeRebuild();
				}
			}
		}));

		// Eager init on next microtask so the workbench layout has settled.
		queueMicrotask(() => { void this._initAndMaybeRebuild(); });
	}

	private _readConfig() {
		const get = <T>(key: string, fallback: T): T => {
			const v = this.configService.getValue<T>(`${CONFIG_PREFIX}.${key}`);
			return v === undefined ? fallback : v;
		};
		return {
			enabled: get<boolean>('enabled', true),
			autoRebuildOnStartup: get<boolean>('autoRebuildOnStartup', false),
			excludes: get<string[]>('exclude', []),
			maxFileSizeKB: get<number>('maxFileSizeKB', 256),
		};
	}

	private async _initAndMaybeRebuild(): Promise<void> {
		if (this._initDone) return;
		this._initDone = true;
		const cfg = this._readConfig();
		if (!cfg.enabled) {
			this.setStatus({ state: 'idle' }, true);
			return;
		}
		// Restore chunks from the previous session so the index survives reloads.
		const restored = this._loadFromSession();
		if (restored) {
			this.logService.info(`[v3code-index] restored ${this.chunks.size} chunks from sessionStorage`);
		}
		if (cfg.autoRebuildOnStartup) {
			await this.rebuild();
		} else if (restored) {
			this.setStatus({ state: 'ready' }, true);
		} else {
			this.setStatus({ state: 'idle' }, true);
		}
	}

	private _shouldWatch(fsPath: string): boolean {
		if (!fsPath) return false;
		return this.workspace.getWorkspace().folders.some(f => fsPath.startsWith(f.uri.fsPath));
	}

	private _absToRel(fsPath: string): string | null {
		for (const folder of this.workspace.getWorkspace().folders) {
			const root = folder.uri.fsPath.endsWith('/') ? folder.uri.fsPath : folder.uri.fsPath + '/';
			if (fsPath.startsWith(root)) return fsPath.slice(root.length).replace(/\\/g, '/');
		}
		return null;
	}

	private _removeFileChunks(relPath: string): void {
		const ids = this.fileToChunks.get(relPath);
		if (ids) {
			for (const id of ids) this.chunks.delete(id);
			this.fileToChunks.delete(relPath);
			this.setStatus({ chunksTotal: this.chunks.size }, true);
		}
	}

	private _scheduleIncremental(): void {
		if (this._incrementalTimer) clearTimeout(this._incrementalTimer);
		this._incrementalTimer = setTimeout(() => {
			this._incrementalTimer = null;
			void this._doIncrementalUpdate();
		}, INCREMENTAL_DEBOUNCE_MS);
	}

	private async _doIncrementalUpdate(): Promise<void> {
		const paths = [...this._pendingChanges];
		this._pendingChanges.clear();
		for (const absPath of paths) {
			const rel = this._absToRel(absPath);
			if (!rel) continue;
			if (!this._shouldIndexPath(rel)) {
				this._removeFileChunks(rel);
				continue;
			}
			try {
				const uri = URI.file(absPath);
				const content = await this.readText(uri);
				if (content === null) {
					this._removeFileChunks(rel);
					continue;
				}
				this._removeFileChunks(rel);
				await this.chunkFile(rel, content);
			} catch {
				this._removeFileChunks(rel);
			}
		}
		this.setStatus({ chunksTotal: this.chunks.size, filesIndexed: this.fileToChunks.size }, true);
		this._saveToSession();
	}

	get status(): IndexStatus { return this._status; }
	getStatus(): IndexStatus { return this._status; }

	private setStatus(patch: Partial<IndexStatus>, force = false): void {
		this._status = { ...this._status, ...patch };
		const now = Date.now();
		if (force || now - this.lastEmitAt >= STATUS_EMIT_MS) {
			this.lastEmitAt = now;
			this._onDidChangeStatus.fire(this._status);
		}
	}

	async rebuild(): Promise<void> {
		if (this.rebuildInFlight) return this.rebuildInFlight;
		const cfg = this._readConfig();
		if (!cfg.enabled) {
			this.setStatus({ state: 'idle' }, true);
			return;
		}
		this.rebuildInFlight = this.doRebuild(cfg).finally(() => { this.rebuildInFlight = null; });
		return this.rebuildInFlight;
	}

	private async doRebuild(cfg: ReturnType<SemanticIndexBrowserImpl['_readConfig']>): Promise<void> {
		const folders = this.workspace.getWorkspace().folders;
		if (folders.length === 0) {
			this.setStatus({ state: 'error', lastError: 'No workspace folder open' }, true);
			return;
		}

		this.chunks.clear();
		this.fileToChunks.clear();
		this.gitignoreCache.clear();
		this.setStatus({
			state: 'walking', filesTotal: 0, filesIndexed: 0, chunksTotal: 0,
			lastError: undefined, currentFile: undefined, filesPerSecond: undefined,
			etaSeconds: undefined, bytesProcessed: 0
		}, true);

		// Build per-folder exclude set: configured excludes + hardcoded SKIP_DIRS.
		const userExcludes = new Set(cfg.excludes.map(s => s.toLowerCase()));
		const allSkipDirs = new Set([...SKIP_DIRS, ...userExcludes]);
		const maxBytes = (cfg.maxFileSizeKB || 256) * 1024;

		// Phase 1: walk to discover all files, loading gitignores along the way.
		const files: URI[] = [];
		for (const folder of folders) {
			try {
				await this.walk(folder.uri, files, allSkipDirs);
			} catch (err) {
				this.logService.warn('[v3code-index] walk failed for', folder.uri.toString(), err);
			}
		}
		this.setStatus({ filesTotal: files.length, state: 'chunking' }, true);

		// Phase 2: read + chunk + hash each file.
		const startMs = Date.now();
		let bytesProcessed = 0;
		for (let i = 0; i < files.length; i++) {
			const uri = files[i];
			const relPath = this.relativePath(uri);
			try {
				const content = await this.readText(uri, maxBytes);
				if (content === null) {
					// skipped
				} else {
					bytesProcessed += content.length;
					await this.chunkFile(relPath, content);
				}
			} catch (err) {
				this.logService.warn('[v3code-index] file failed', relPath, err);
			}

			const elapsedSec = Math.max(0.001, (Date.now() - startMs) / 1000);
			const filesPerSecond = (i + 1) / elapsedSec;
			const remaining = files.length - (i + 1);
			const etaSeconds = filesPerSecond > 0 ? remaining / filesPerSecond : undefined;

			this.setStatus({
				filesIndexed: i + 1,
				chunksTotal: this.chunks.size,
				currentFile: relPath,
				filesPerSecond,
				etaSeconds,
				bytesProcessed
			});
		}

		this.setStatus({
			state: 'ready',
			currentFile: undefined,
			filesPerSecond: undefined,
			etaSeconds: undefined,
			lastIndexedAt: Date.now()
		}, true);

		this._saveToSession();
	}

	private _saveToSession(): void {
		try {
			// Do NOT persist tokens — a 24k-chunk index can produce millions of
			// token strings, blowing past sessionStorage's quota. Tokens are
			// cheaply rebuilt from content on load.
			const serialized = JSON.stringify({
				filesIndexed: this.fileToChunks.size,
				chunksTotal: this.chunks.size,
				lastIndexedAt: this._status.lastIndexedAt,
				chunks: [...this.chunks.entries()].map(([id, c]) => ({
					id, file: c.file, startLine: c.startLine, endLine: c.endLine,
					kind: c.kind, name: c.name, language: c.language,
					contentHash: c.contentHash, content: c.content,
				})),
				fileToChunks: [...this.fileToChunks.entries()].map(([k, v]) => [k, [...v]]),
			});
			sessionStorage.setItem(this._sessionKey, serialized);
		} catch {
			// sessionStorage can fail if quota exceeded — non-fatal.
		}
	}

	private _loadFromSession(): boolean {
		try {
			const raw = sessionStorage.getItem(this._sessionKey);
			if (!raw) return false;
			const data = JSON.parse(raw);
			if (!data.chunks || !Array.isArray(data.chunks)) return false;
			this.chunks.clear();
			this.fileToChunks.clear();
			for (const entry of data.chunks) {
				const content: string = entry.content || '';
				this.chunks.set(entry.id, {
					id: entry.id, file: entry.file, startLine: entry.startLine,
					endLine: entry.endLine, kind: entry.kind, name: entry.name,
					language: entry.language, contentHash: entry.contentHash,
					content, tokens: new Set(tokenize(content)),
				});
			}
			if (Array.isArray(data.fileToChunks)) {
				for (const [k, v] of data.fileToChunks) {
					this.fileToChunks.set(k, new Set(v));
				}
			}
			this.setStatus({
				state: 'ready',
				filesIndexed: data.filesIndexed ?? this.fileToChunks.size,
				chunksTotal: data.chunksTotal ?? this.chunks.size,
				lastIndexedAt: data.lastIndexedAt,
			}, true);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Load and parse a .gitignore file at the given directory URI.
	 * Cached per dir for the duration of a walk.
	 */
	private async _loadGitignore(dirUri: URI): Promise<GitignoreLayer | null> {
		const cacheKey = dirUri.path;
		if (this.gitignoreCache.has(cacheKey)) return this.gitignoreCache.get(cacheKey)!;
		try {
			const gitignoreUri = URI.joinPath(dirUri, '.gitignore');
			const content = await this.fileService.readFile(gitignoreUri);
			const text = content.value.toString();
			const rules: GitignoreRule[] = [];
			for (const line of text.split(/\r?\n/)) {
				const rule = compileGitignorePattern(line);
				if (rule) rules.push(rule);
			}
			const layer: GitignoreLayer | null = rules.length ? { dir: dirUri.path, rules } : null;
			this.gitignoreCache.set(cacheKey, layer);
			return layer;
		} catch {
			this.gitignoreCache.set(cacheKey, null);
			return null;
		}
	}

	private async walk(uri: URI, out: URI[], skipDirs: Set<string>, parentLayers: GitignoreLayer[] = []): Promise<void> {
		let stat: IFileStat;
		try {
			stat = await this.fileService.resolve(uri, { resolveMetadata: false });
		} catch {
			return;
		}

		// Load gitignore at this level if we're a directory.
		let layers = parentLayers;
		if (stat.isDirectory) {
			const layer = await this._loadGitignore(uri);
			if (layer) layers = [...parentLayers, layer];
		}

		if (!stat.isDirectory) {
			const name = this.basename(uri);
			const relPath = this.relativePath(uri);
			if (layers.length > 0 && isIgnoredByLayer(name, false, layers)) return;
			if (this._shouldIndexPath(relPath)) out.push(uri);
			return;
		}
		for (const child of stat.children ?? []) {
			const name = this.basename(child.resource);
			if (child.isDirectory) {
				if (skipDirs.has(name.toLowerCase()) || (name.startsWith('.') && name !== '.gitignore')) {
					// Still check if a gitignore layer at this dir would un-ignore something —
					// .gitignore at the workspace root says `!.env.example` but we skip dot-files.
					// Only skip unconditionally for hardcoded skip dirs; for dot-dirs, still check layers.
					if (skipDirs.has(name.toLowerCase())) continue;
					if (layers.length > 0 && !isIgnoredByLayer(name + '/', true, layers)) {
						await this.walk(child.resource, out, skipDirs, layers);
					}
					continue;
				}
				if (layers.length > 0 && isIgnoredByLayer(name + '/', true, layers)) continue;
				await this.walk(child.resource, out, skipDirs, layers);
			} else {
				if (layers.length > 0 && isIgnoredByLayer(name, false, layers)) continue;
				if (this._shouldIndexPath(this.relativePath(child.resource))) out.push(child.resource);
			}
		}
	}

	private _shouldIndexPath(relPath: string): boolean {
		const name = relPath.split('/').pop() || relPath;
		// Allow known dot-prefixed config files (.eslintrc.js, .env.example, etc.)
		// while still skipping hidden dirs and unknown dotfiles.
		if (name.startsWith('.') && !INDEXABLE_DOTFILES.has(name)) return false;
		const dot = name.lastIndexOf('.');
		const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
		if (BINARY_EXTS.has(ext)) return false;
		return true;
	}

	private basename(uri: URI): string {
		const p = uri.path;
		const i = p.lastIndexOf('/');
		return i >= 0 ? p.slice(i + 1) : p;
	}

	private relativePath(uri: URI): string {
		const folder = this.workspace.getWorkspaceFolder(uri);
		if (!folder) return uri.path;
		const root = folder.uri.path.endsWith('/') ? folder.uri.path : folder.uri.path + '/';
		return uri.path.startsWith(root) ? uri.path.slice(root.length) : uri.path;
	}

	private async readText(uri: URI, maxBytes = MAX_FILE_BYTES): Promise<string | null> {
		try {
			const content = await this.fileService.readFile(uri);
			if (content.size > maxBytes) return null;
			const text = content.value.toString();
			if (text.slice(0, 4096).indexOf('\u0000') !== -1) return null;
			return text;
		} catch {
			return null;
		}
	}

	private async chunkFile(relPath: string, content: string): Promise<void> {
		const lines = content.split(/\r?\n/);
		const dot = relPath.lastIndexOf('.');
		const ext = dot >= 0 ? relPath.slice(dot + 1) : '';
		const language = langFromExt(ext);
		const kind: ChunkKind = 'block';

		const ids = new Set<string>();
		const step = WINDOW_LINES - WINDOW_OVERLAP;
		for (let start = 0; start < lines.length; start += step) {
			const end = Math.min(start + WINDOW_LINES, lines.length);
			const slice = lines.slice(start, end).join('\n');
			if (!slice.trim()) {
				if (end >= lines.length) break;
				continue;
			}
			const startLine = start + 1;
			const endLine = end;
			const id = await sha256Hex(`${relPath}:${startLine}:${endLine}`);
			const contentHash = await sha256Hex(slice);
			const tokens = new Set(tokenize(slice));
			const name = `${relPath}:${startLine}-${endLine}`;
			this.chunks.set(id, {
				id, file: relPath, startLine, endLine, kind, name,
				language, contentHash, content: slice, tokens
			});
			ids.add(id);
			if (end >= lines.length) break;
		}
		this.fileToChunks.set(relPath, ids);
	}

	async retrieve(prompt: string, opts?: { topK?: number; files?: string[] }): Promise<Hit[]> {
		const topK = opts?.topK ?? 30;
		const fileFilter = opts?.files ? new Set(opts.files) : null;
		const queryTokens = Array.from(new Set(tokenize(prompt)))
			.filter(t => !STOPWORDS.has(t));
		if (queryTokens.length === 0) return [];

		const scored: Array<{ chunk: IndexedChunk; score: number; overlap: number }> = [];
		for (const c of this.chunks.values()) {
			if (fileFilter && !fileFilter.has(c.file)) continue;
			let overlap = 0;
			for (const t of queryTokens) if (c.tokens.has(t)) overlap++;
			if (overlap === 0) continue;
			const score = overlap / queryTokens.length;
			scored.push({ chunk: c, score, overlap });
		}
		scored.sort((a, b) => b.score - a.score || b.overlap - a.overlap);
		return scored.slice(0, topK).map(s => ({
			chunk: {
				id: s.chunk.id, file: s.chunk.file, startLine: s.chunk.startLine, endLine: s.chunk.endLine,
				kind: s.chunk.kind, name: s.chunk.name, language: s.chunk.language, contentHash: s.chunk.contentHash
			},
			content: s.chunk.content,
			score: s.score,
			signals: { terms: s.overlap }
		}));
	}
}

registerSingleton(ISemanticIndexService, SemanticIndexBrowserImpl, InstantiationType.Delayed);
