# V3Code Semantic Indexing — Build Spec & Handoff

**Owner:** DeepSeek (or whichever agent picks this up next)
**Reviewer:** Claude (Copilot Chat)
**Status:** SPEC LOCKED — ready to build
**Prereqs:** Phase B (native Context Bridge) should land first OR run in parallel — the retriever feeds the Context Packer, so the Packer needs to exist as a native module before retrieval results have a consumer. The schema work and indexer worker can ship before Packer is wired.

Read in order before touching code:
1. [V3CODE-PLAN.md](V3CODE-PLAN.md) — overall roadmap, Phase C context
2. [AGENTS.md](AGENTS.md) — operating rules, palette, naming conventions
3. [DEEPSEEK-HANDOFF.md](DEEPSEEK-HANDOFF.md) — hard rules
4. This doc — locked decisions for the indexer

---

## Mission

Ship a **local-first semantic index** for V3Code that gives the agent loop the missing half of code retrieval. Structural intelligence (LSP via Context Bridge) tells the agent *who calls what and why*. Semantic search tells it *which files match this user goal at all*. Together they replace what Cursor/Copilot get from hosted indexes — but ours stays on the user's machine.

This is the wedge: **"Your code never leaves your machine. The index is yours. The notes are yours. The agent gets full context without an upload."**

---

## Design decisions LOCKED (do not re-litigate)

1. **Local-first, BYOK-friendly, no hosted requirement.** v1 ships transformers.js + sqlite-vec, all on device. Zero recurring cost to us, zero data egress to anyone. BYOK users get this free. Paid V3Code plan users get the same engine + optional hosted upgrade tier (year-2, not now).
2. **Vector store: sqlite-vec.** Single `.v3code/index.db` per workspace. Same db hosts the notes table (Phase 3) and the FTS5 lexical table. One file, no separate server, no LanceDB dependency.
3. **Default embedding model: `Xenova/jina-embeddings-v2-base-code`** via transformers.js. 768 dims, ~150MB, code-optimized, runs in a Node worker thread. Fallback: `Xenova/all-MiniLM-L6-v2` (384d, ~80MB) for low-RAM machines (auto-detect by `os.totalmem() < 4GB`).
4. **Chunking: tree-sitter semantic units, not line windows.** One chunk = one top-level definition (function, class, method, interface, type alias, enum). File-level summary chunk per file. No fixed-size windows. Languages supported in v1: TS, JS, TSX, JSX, Python, Go, Rust, Java, C#, C++, Ruby. Anything else falls back to a single file-level chunk.
5. **Incremental indexing via Merkle hashes.** Each chunk's SHA-256 lives in the manifest. On file change, rehash chunks, only re-embed changed ones. First full index of a 10k-file repo target: ≤5 min on M-series Mac / decent Windows box.
6. **Query expansion = HyDE (Hypothetical Document Embeddings).** Before vector search, a cheap local LLM rewrites the user prompt into (a) likely code terms, (b) a hypothetical code snippet that would answer the question. We embed all three signals (original + expanded terms + hypothetical code) and merge results via RRF. Cached per `SHA(prompt)` for 24h.
7. **Hybrid retrieval = vector + FTS5 lexical, merged by RRF.** Reciprocal Rank Fusion with k=60. Lexical signal matters for code (exact identifier matches). Pure vector loses on `getUserById` vs `fetchUserData` — RRF fixes that.
8. **Query-expansion model: tiny bundled, with config to override.** Default ships **Qwen2.5-Coder-0.5B-Instruct** GGUF (~400MB) via node-llama-cpp. Runs in same worker as embeddings (separate model instance). User can flip a setting to "use my chat model instead" — saves disk, costs tokens.
9. **Status surface: status bar item** mirroring Copilot's pattern (`$(database) V3Code Index: 1,247 files indexed · ✓`). Click opens a quickpick: rebuild, status, exclude pattern, switch model.
10. **`.v3code/` is the persistence root.** Index db, notes db (consolidated here from `.context-bridge/notes.json` — migration on first launch), config. Add `.v3code/` to `.gitignore` auto-suggestion (Copilot does the same with `.copilot/`).
11. **NO upload service in v1.** No team workspaces. No remote index. No auth. No billing. All deferred to year-2 Pro/Teams SKUs. v1 is local-only.
12. **NO chunking of `node_modules`, `dist`, `build`, `.git`, lock files, generated code.** Honor `.gitignore` + `files.exclude` + a v3code-specific `v3code.semanticIndex.exclude` setting (default list ships excludes for the usual suspects).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  IndexerService (browser, workbench contribution)               │
│    - Owns the worker, queues files, debounces fs events         │
│    - Exposes: rebuild(), getStatus(), onDidChangeStatus         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ postMessage
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  indexer.worker.ts (Node worker thread)                         │
│    1. Walk workspace (gitignore-respecting, parallel)           │
│    2. tree-sitter chunk per file → Chunk[]                      │
│    3. SHA-256 each chunk → diff vs sqlite manifest              │
│    4. Embed only changed chunks (batched, 32 at a time)         │
│    5. UPSERT into sqlite-vec + FTS5 + chunks table              │
│    6. Emit progress messages                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ writes
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  .v3code/index.db (sqlite + sqlite-vec + FTS5)                  │
│    - chunks         (id, file, start, end, kind, name, hash)    │
│    - chunk_text     (id, content) — for snippet hydration       │
│    - chunk_vec      (id, embedding) — vec0 virtual table        │
│    - chunk_fts      (id, content) — fts5 virtual table          │
│    - notes          (Phase 3 / CB consolidation)                │
│    - manifest       (file, mtime, chunk_count, last_indexed)    │
└─────────────────────────────────────────────────────────────────┘
                            ▲
                            │ reads
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│  RetrieverService (browser)                                     │
│    1. queryExpand(prompt) → { original, terms, hyde }           │
│    2. Embed each → 3 vec queries (top-k=20 each)                │
│    3. fts5 query on terms → top-k=20                            │
│    4. RRF merge (k=60) → top-k=30 chunks                        │
│    5. Hydrate text from chunk_text → return Hit[]               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ consumed by
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ContextPackerService (Phase B — already specced separately)    │
│    Merges: LSP callers/callees + semantic hits + notes          │
│    Budgets tokens, returns packed context for the LLM           │
└─────────────────────────────────────────────────────────────────┘
```

---

## File-by-file plan

All paths relative to `vselite/src/vs/workbench/contrib/void/`.

### New files

#### `common/semanticIndex/semanticIndexTypes.ts`
Type contracts only. Pure types, no logic.
```ts
export type ChunkKind = 'function' | 'class' | 'method' | 'interface' | 'type' | 'enum' | 'file' | 'block';
export interface Chunk {
    id: string;          // sha256(file + start + end)
    file: string;        // workspace-relative
    startLine: number;
    endLine: number;
    kind: ChunkKind;
    name: string;        // symbol name or filename for kind:'file'
    language: string;
    contentHash: string; // sha256(content) — for incremental
}
export interface Hit {
    chunk: Chunk;
    content: string;     // hydrated from chunk_text
    score: number;       // post-RRF
    signals: { vec?: number; fts?: number; hyde?: number };
}
export interface QueryExpansion {
    original: string;
    codeTerms: string[];          // ["AuthService", "signIn", "session"]
    hypotheticalCode: string;     // a code snippet that would answer
    alternatives: string[];       // rephrased questions
}
export interface IndexStatus {
    state: 'idle' | 'walking' | 'chunking' | 'embedding' | 'ready' | 'error';
    filesTotal: number;
    filesIndexed: number;
    chunksTotal: number;
    lastError?: string;
}
```

#### `common/semanticIndex/semanticIndexService.ts` + `ISemanticIndexService` interface
Browser-side service. Wraps the worker, owns lifecycle, exposes events. Pattern: copy `agentPanelService.ts` structure (delayed singleton, `IInstantiationService`, `Event<T>` for status). Methods:
- `rebuild(): Promise<void>` — full re-walk
- `getStatus(): IndexStatus`
- `onDidChangeStatus: Event<IndexStatus>`
- `retrieve(prompt: string, opts?: { topK?: number; files?: string[] }): Promise<Hit[]>`
- `dispose()` — kills worker, closes db

#### `common/semanticIndex/indexer.worker.ts`
Node worker thread. Single entry point with a message-typed protocol:
- `{ type: 'init', dbPath, workspaceRoot, excludes }` → loads sqlite-vec + opens worker, replies `{ type: 'ready' }`
- `{ type: 'rebuild' }` → walks workspace, emits `{ type: 'progress', status: IndexStatus }` repeatedly
- `{ type: 'retrieve', prompt, topK }` → returns `{ type: 'hits', hits: Hit[] }`
- `{ type: 'fileChanged', file, op: 'add' | 'modify' | 'delete' }` → incremental
- `{ type: 'dispose' }` → flush, close db, exit

#### `common/semanticIndex/chunker.ts`
Tree-sitter wrapper. Pure function: `chunk(file: string, content: string, language: string): Chunk[]`. Uses `web-tree-sitter` (already in the VS Code core deps tree — verify before adding). Language-specific node-type rules in `chunker.languages.ts`.

#### `common/semanticIndex/chunker.languages.ts`
Per-language tree-sitter node-type → ChunkKind map. Example for TS:
```ts
'function_declaration' | 'arrow_function' → 'function'
'class_declaration' → 'class'
'method_definition' → 'method'
'interface_declaration' → 'interface'
'type_alias_declaration' → 'type'
'enum_declaration' → 'enum'
```
One small object per supported language. Easy to extend.

#### `common/semanticIndex/embedder.ts`
Wraps transformers.js. Singleton model loader (lazy). Methods:
- `embed(texts: string[]): Promise<Float32Array[]>` — batched
- `getDim(): number`
- `getModelId(): string`
Auto-selects model by `os.totalmem()` threshold.

#### `common/semanticIndex/queryExpander.ts`
HyDE expander. Methods:
- `expand(prompt: string): Promise<QueryExpansion>`
- Caches in `.v3code/query-cache.db` (sqlite, keyed by SHA(prompt), 24h TTL)
- Uses node-llama-cpp with bundled Qwen2.5-Coder-0.5B-Instruct GGUF, OR delegates to user's chat model if `v3code.semanticIndex.queryExpander = 'chat-model'`.

#### `common/semanticIndex/retriever.ts`
Pure logic. Takes the worker handle, runs the 4-channel query (orig + terms + hyde + fts), RRF merges, hydrates. Returns `Hit[]`. No I/O of its own — calls into the worker.

#### `common/semanticIndex/rrf.ts`
Tiny standalone utility: `function rrfMerge(rankings: Hit[][], k = 60): Hit[]`. ~30 LOC. Test heavily.

#### `browser/semanticIndexStatusBar.ts`
StatusBar item. Pattern: copy `voidSCMStatusBar.ts` if it exists, else any existing status-bar contrib in the void/ tree. Click → quickpick with rebuild/status/exclude/model options.

#### `browser/semanticIndexActions.ts`
Two actions:
- `v3code.semanticIndex.rebuild` (Command Palette: "V3Code: Rebuild Codebase Index")
- `v3code.semanticIndex.showStatus` (Command Palette: "V3Code: Show Index Status")

### Modified files

#### `browser/void.contribution.ts`
Add three imports near the existing service/contrib registrations:
```ts
import './semanticIndexStatusBar.js'
import './semanticIndexActions.js'
import '../common/semanticIndex/semanticIndexService.js'
```
Plus the `registerSingleton(ISemanticIndexService, SemanticIndexService, ...)` call following the existing `agentPanelService` pattern.

#### `common/prompt/prompts.ts`
The `V3CODE_AGENT_OS_PROMPT` already references semantic-search-style tools conceptually. Add ONE bullet to the Tool Hierarchy section: *"Use `semantic_search(query)` when you need to find code by goal/concept rather than by known symbol name. Prefer `get_symbol_context` when you already know the symbol — it's faster and more precise."*

#### `package.json` (vselite root)
Add deps:
- `sqlite-vec`
- `@xenova/transformers` (transformers.js)
- `web-tree-sitter`
- `tree-sitter-typescript`, `tree-sitter-javascript`, `tree-sitter-python`, `tree-sitter-go`, `tree-sitter-rust`, `tree-sitter-java`, `tree-sitter-c-sharp`, `tree-sitter-cpp`, `tree-sitter-ruby`
- `node-llama-cpp` (for query expander)
- `better-sqlite3` (sqlite-vec dependency — verify VS Code core doesn't already bundle one)

Verify each before adding — VS Code core may already have some via its existing ML/search extensions. Don't double-bundle.

### Settings (configurationRegistry)

Register under `v3code.semanticIndex.*`:
- `enabled: boolean` (default `true`)
- `autoRebuildOnStartup: boolean` (default `true`)
- `embedModel: 'auto' | 'jina-code' | 'minilm'` (default `'auto'`)
- `queryExpander: 'bundled-qwen' | 'chat-model' | 'off'` (default `'bundled-qwen'`)
- `exclude: string[]` (default `["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/*.lock", "**/*.min.js"]`)
- `maxFileSize: number` (KB, default 1024)
- `concurrency: number` (default `4`)

---

## SQLite schema (verbatim — DeepSeek copy this into a migration)

```sql
CREATE TABLE IF NOT EXISTS chunks (
    id           TEXT PRIMARY KEY,
    file         TEXT NOT NULL,
    start_line   INTEGER NOT NULL,
    end_line     INTEGER NOT NULL,
    kind         TEXT NOT NULL,
    name         TEXT NOT NULL,
    language     TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    indexed_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file);
CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(content_hash);

CREATE TABLE IF NOT EXISTS chunk_text (
    id      TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    FOREIGN KEY (id) REFERENCES chunks(id) ON DELETE CASCADE
);

-- sqlite-vec virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vec USING vec0(
    id      TEXT PRIMARY KEY,
    embedding FLOAT[768]
);

-- FTS5 lexical
CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
    id UNINDEXED,
    content,
    tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS manifest (
    file          TEXT PRIMARY KEY,
    mtime         INTEGER NOT NULL,
    chunk_count   INTEGER NOT NULL,
    last_indexed  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS query_cache (
    prompt_hash TEXT PRIMARY KEY,
    expansion   TEXT NOT NULL,  -- JSON
    created_at  INTEGER NOT NULL
);
```

Embedding dim is **model-dependent** — `chunk_vec` schema must be regenerated if user switches models. Detect on init: compare stored `model_id` (write to a `meta` kv table) vs current; mismatch → drop+rebuild `chunk_vec` only.

---

## RRF formula (do not deviate)

```
score(d) = Σ_q  1 / (k + rank_q(d))
```

Where `k = 60` (de-facto standard, Cormack et al. 2009), `q` ranges over the 4 ranked lists (original-embed, term-embed, hyde-embed, fts5), `rank_q(d)` is 1-indexed rank of doc `d` in list `q` (∞ if absent).

Then take top-K post-merge. Default K=30 chunks for retrieval, Context Packer trims further by token budget.

---

## Status bar UX

```
[ $(database) V3Code Index: 1,247 files · ✓ ]   ← idle/ready
[ $(sync~spin) V3Code Index: 412/1,247 ]        ← indexing
[ $(warning) V3Code Index: error ]              ← error (click for details)
```

Tooltip on hover: model name, last-indexed timestamp, db path, total chunks. Click: quickpick.

Use the existing VS Code `IStatusbarService`. Priority: just left of the GitHub/Account status item.

---

## Acceptance criteria

1. **Cold-start index** of a 5k-file mixed TS/JS workspace completes in ≤3 min on a 2024-class M-series Mac, ≤5 min on a 2024-class Windows laptop.
2. **Incremental** on save: changed file re-indexes in ≤300ms (single-file p95).
3. **Retrieval** for a typical prompt returns top-30 chunks in ≤200ms p95 after warm cache.
4. **Query expansion** first call ≤800ms (model load + inference), subsequent ≤80ms (cached or warm).
5. **Status bar** updates in real time during indexing. No UI freezes.
6. **`get_errors` clean** across all new and modified files.
7. **Workspace exclude rules** honored: `node_modules`, `.git`, `dist`, `build`, lock files, anything in `.gitignore`, anything in `files.exclude`, anything in `v3code.semanticIndex.exclude` — none of these appear in chunks.
8. **Model switch** triggers a full rebuild (one-way migration — dropping the vec table is cheap).
9. **`.v3code/` directory** is created on first launch with correct perms. Path is platform-correct (workspace root + `.v3code/`).
10. **Disposal** clean: closing the window terminates the worker, closes the db, no orphaned processes.

---

## NOT this sprint (do not build)

- **Hosted upload service** — year-2 Pro tier
- **Team / shared index** — year-2 Teams SKU
- **Cross-workspace search** — out of scope, single workspace only
- **PDF / docx / markdown semantic indexing** — code-only v1
- **Re-ranker model** (cross-encoder rerank pass) — RRF is good enough for v1
- **Notebook (.ipynb) handling** — defer
- **Symbol-graph PageRank (aider-style)** — defer, possibly never (we have LSP)
- **Auto-clustering / "topic" detection** — defer
- **Embedding visualization UI** — pretty but useless to ship

---

## Open questions — RESOLVED 2026-05-27 (Claude recon)

Resolved from `vselite/package.json` + `vselite/src/vs/editor/common/services/treeSitter*`:

1. **Sqlite driver — RESOLVED.** VS Code already bundles `@vscode/sqlite3@5.1.8-vscode` ([package.json:91](package.json#L91)). **Use it.** No `better-sqlite3`, no double-bundle. It's async (callback/Promise), not sync — the worker pipeline must `await` queries. `sqlite-vec` extension loads via `db.loadExtension()` — verify the bundled build was compiled with `--enable-load-extension` (vendor patch may be needed if not — flag as B.1.5 task if it isn't).
2. **Tree-sitter — RESOLVED with caveat.** VS Code bundles `@vscode/tree-sitter-wasm@^0.1.4` ([package.json:93](package.json#L93)) AND ships a full `ITreeSitterParserService` ([src/vs/editor/common/services/treeSitterParserService.ts](src/vs/editor/common/services/treeSitterParserService.ts)) with WASM runtime. **WASM, decided.** Caveat: `TREESITTER_ALLOWED_SUPPORT = ['css', 'typescript', 'ini', 'regex']` — only those grammars are wired. For our 9 languages (TS/JS/Py/Go/Rust/Java/C#/C++/Ruby) we ship our own grammar .wasm files via the existing `getOrInitLanguage(languageId)` registration path. **Do NOT** add a second tree-sitter runtime — reuse the loader. Grammar wasms live in `vselite/src/vs/workbench/contrib/void/common/semanticIndex/grammars/*.wasm` (one per language, ~200KB each, ~1.8MB total).
3. **`@xenova/transformers` entry — DECIDED.** Worker runs in Node context (extension host / Node worker thread). Import the default `@xenova/transformers` package — it auto-detects Node via `process.versions.node` and uses ONNX Runtime Node bindings. Set `env.localModelPath` and `env.allowRemoteModels = false` after first-download to lock to local cache.
4. **`node-llama-cpp` — DECIDED: lazy-download on first use.** Native binaries (~50MB per platform) are too big for installer. Pattern: check `~/.v3code/llama/<platform>/llama.node` on first HyDE call → if missing, fetch the platform-specific tarball from a versioned URL, verify SHA256, extract, then load. Progress UI surfaces in status bar. Mirrors Copilot's model-download pattern.
5. **Model files (550MB) — DECIDED: lazy-download with progress UI.** First index build triggers `download jina-embeddings-v2-base-code (~150MB) + Qwen2.5-Coder-0.5B-Instruct GGUF Q4_K_M (~400MB)` from HuggingFace mirror. Cached at `~/.v3code/models/`. Resumable. SHA256-verified. Settings toggle `v3code.semanticIndex.modelDownloadHost` lets enterprise users self-host. The 550MB inflation is unacceptable in the installer — premium users get a one-time wait, not a fatter download.
6. **Node version — RESOLVED.** Electron 34.3.2 ([package.json:186](package.json#L186)) bundles Node 20.x. transformers.js (≥18) and node-llama-cpp (prefers 20+) both happy. ✅

**One new follow-up:** verify `@vscode/sqlite3` was built with `--enable-load-extension`. If not, vendor-patch it or fall back to `better-sqlite3` (then we DO double-bundle but it's the smallest acceptable cost). Check during B.1.5 / Phase C step 1 (schema scaffold). Don't block on it now — assume YES until proven otherwise.

---

## Build order (recommended)

1. **Schema + migration** — get the sqlite + vec + fts tables stood up, write 5 unit tests for upsert/query/delete.
2. **Chunker** — tree-sitter wrapper, language map, ~100 unit tests on small code samples per language.
3. **Embedder** — transformers.js worker init, batch embed, snapshot test on a known string.
4. **Indexer worker pipeline** — walk → chunk → hash → embed → upsert. Integration test on a 50-file fixture.
5. **Retriever** — vec query + fts query + RRF merge. Test against fixture w/ known-right answers.
6. **Query expander** — HyDE call + cache. Snapshot test.
7. **Service + worker wiring** — `SemanticIndexService` browser-side, message protocol, lifecycle.
8. **Status bar + actions** — UI surface.
9. **Settings registration + exclude logic.**
10. **End-to-end smoke test** — index V3Code itself, run 20 queries, eyeball relevance.
11. **Wire into Context Packer** — once Phase B's Packer exists, `Hit[]` becomes an input signal.

---

## What "done" looks like

- User opens a workspace → status bar shows index building, finishes in a few minutes.
- User asks the agent: *"how does the agent panel toggle work?"*
- Agent receives semantic-search results pre-pended to context: top hits include `agentPanelService.ts`, `voidChatEditorInput.ts`, `agentPanelActions.ts` — all relevant, all without the user typing a single `@`-mention.
- Agent answers using those files. No hallucinated paths. No "where is this defined" tool spam.
- Status bar shows `✓ 1,247 files indexed`.
- `.v3code/index.db` exists, ~50-200MB depending on repo size.
- User can open Cursor in the same repo — Cursor has NOTHING extra. Ours just shipped without an upload.

That's the moat.
