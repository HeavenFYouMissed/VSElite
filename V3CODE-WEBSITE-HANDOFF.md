# V3Code Website — Complete Handoff Document

> For the website creator. Everything needed to faithfully reproduce the V3Code onboarding experience on the web, plus all technical details about the high-tech AI coding environment.

---

## Part 1: The Welcome Page — ASCII Art & Animation

### 1.1 ASCII Art — Exact Text

This is the V3CODE ASCII art displayed on the welcome/onboarding screen. It uses box-drawing characters (Unicode):

```
██╗   ██╗██████╗  ██████╗ ██████╗ ██████╗ ███████╗
██║   ██║╚════██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝
██║   ██║ █████╔╝██║     ██║   ██║██║  ██║█████╗
╚██╗ ██╔╝ ╚═══██╗██║     ██║   ██║██║  ██║██╔══╝
 ╚████╔╝ ██████╔╝╚██████╗╚██████╔╝██████╔╝███████╗
  ╚═══╝  ╚═════╝  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
```

**Source:** `vselite/src/vs/workbench/contrib/void/browser/react/src2/void-onboarding/VoidOnboarding.tsx:17-22`

### 1.2 ASCII Art — Styling (CSS)

```css
.v3code-ascii {
  font-family: monospace;                    /* monospace font */
  font-size: clamp(12px, 1.8vw, 22px);       /* responsive: 12px → 22px */
  line-height: 1.05;                          /* tight line height */
  letter-spacing: 0.02em;                     /* slight breathing room */
  color: #E4E4ED;                             /* text-primary from palette */
  text-shadow:
    0 0 18px rgba(139, 92, 246, 0.85),        /* Amethyst glow — strong near */
    0 0 48px rgba(139, 92, 246, 0.45),        /* Amethyst glow — spread */
    0 0 2px rgba(127, 230, 80, 0.4);          /* Venom green — subtle rim */
  margin: 0;
  user-select: none;                           /* not selectable */
  white-space: pre;                            /* preserve ASCII spacing */
}
```

### 1.3 ASCII Art — Pulse/Blink Animation

The ASCII art itself does NOT pulse. The pulse/blink is on the **cursor block** (the `$ structural_intelligence . init()` line beneath the ASCII). It uses this keyframe:

```css
@keyframes v3code-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
```

Applied to a 2-character-wide inline block:
```css
.v3code-cursor {
  display: inline-block;
  width: 0.5rem;        /* ~2 chars wide */
  height: 1rem;
  background: #7FE650;  /* Venom green */
  animation: v3code-blink 1s steps(2) infinite;
  box-shadow: 0 0 8px rgba(127, 230, 80, 0.7);
}
```

### 1.4 The Line Beneath the ASCII (with cursor blink)

```html
<span style="color: #7FE650; text-shadow: 0 0 8px rgba(127,230,80,0.6)">$</span>
<span style="color: #A78BFA; text-shadow: 0 0 12px rgba(167,139,250,0.5)">structural_intelligence</span>
<span style="color: #5A5A6E">.</span>
<span style="color: #E4E4ED">init</span>
<span style="color: #5A5A6E">()</span>
<span class="v3code-cursor"></span>
```

### 1.5 The Third Line (architecture tagline)

```html
<span style="color: #5A5A6E; font-family: monospace; font-size: 0.75rem;
             text-transform: uppercase; letter-spacing: 0.4em;">
  [ ctx-bridge :: lsp :: graph :: pack ]
</span>
```

### 1.6 The "Initialize_" Button

```css
.v3code-init-button {
  font-family: monospace;
  font-size: 0.875rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.75rem 2rem;
  color: #E4E4ED;
  background: rgba(11, 13, 20, 0.75);
  border: 1px solid rgba(139, 92, 246, 0.5);
  box-shadow:
    0 0 24px rgba(139, 92, 246, 0.25),
    inset 0 0 24px rgba(139, 92, 246, 0.08);
  backdrop-filter: blur(6px);
  transition: all 0.2s ease;
}

.v3code-init-button:hover {
  border-color: #8B5CF6;
  color: #FFFFFF;
  box-shadow:
    0 0 32px rgba(139, 92, 246, 0.55),
    inset 0 0 24px rgba(139, 92, 246, 0.15);
}
```

Button text: `> Initialize_` (the `>` is Venom green `#7FE650`)

### 1.7 Fade-In Animation Timing

Elements appear in sequence with staggered delays:

| Element | Delay | Duration |
|---|---|---|
| ASCII art | 150ms | 2000ms |
| `$ structural_intelligence.init()` line | 650ms | 2000ms |
| `[ ctx-bridge :: lsp :: graph :: pack ]` | 1100ms | 2000ms |
| Initialize button | 1500ms | 2000ms |

Fade-in implementation: opacity 0→1 with CSS transition `opacity ${duration}ms ease-in-out`.

### 1.8 Background — V3CodeShader (GPU Atmosphere)

The background is NOT a static color — it's a live WebGL shader with three layers:

**Layer 1 — Solid base:** `#020207` (Abyss — deeper than black)

**Layer 2 — Swirl:** 
- Blend mode: 5 (soft light / overlay equivalent)
- Color A: `#3B1568` (deep amethyst)
- Color B: `#020207` (abyss)
- Color space: oklab
- Detail: 3.0
- Speed: 0.022 (very slow rotation)

**Layer 3 — Flow Field:**
- Detail: 1.4
- Evolution speed: 0.9
- Speed: 0.35
- Strength: 0.10 (subtle distortion)

Uses the `shaders/react` library (`Shader`, `FlowField`, `SolidColor`, `Swirl` components).

**For web reproduction without WebGL:** Use CSS approximation:

```css
.v3code-bg {
  background: #020207;
  position: relative;
  overflow: hidden;
}

.v3code-bg::before {
  content: '';
  position: absolute;
  inset: -25%;
  background:
    radial-gradient(circle at 30% 30%, rgba(59, 21, 104, 0.4), transparent 50%),
    radial-gradient(circle at 70% 60%, rgba(139, 92, 246, 0.2), transparent 50%);
  filter: blur(60px);
  animation: v3-shader-drift 40s linear infinite;
}

@keyframes v3-shader-drift {
  0%   { transform: rotate(0deg) scale(1); }
  50%  { transform: rotate(180deg) scale(1.15); }
  100% { transform: rotate(360deg) scale(1); }
}
```

### 1.9 Overlay Layers (on top of shader)

**Radial vignette:**
```css
background: radial-gradient(
  ellipse at center,
  transparent 0%,
  rgba(3, 4, 10, 0.55) 55%,
  rgba(0, 0, 0, 0.92) 100%
);
```

**Scanline effect:**
```css
background-image: repeating-linear-gradient(
  0deg,
  rgba(0, 0, 0, 0.55) 0px,
  rgba(0, 0, 0, 0.55) 1px,
  transparent 1px,
  transparent 3px
);
mix-blend-mode: overlay;
opacity: 0.4;
```

### 1.10 Corner Brackets (Terminal Frame)

Four absolutely positioned elements, always visible on every onboarding page:

| Position | Text | Color |
|---|---|---|
| Top-left | `┌─ v3code.sys ──` | `#5A5A6E` |
| Top-right | `── status: ready ─┐` | `#5A5A6E` |
| Bottom-left | `└─ build: 0x0001 ──` | `#5A5A6E` |
| Bottom-right | `── KandD/labs ─┘` | `#5A5A6E` |

Font: monospace, xs (0.75rem), z-index: 20, pointer-events: none.

### 1.11 Empty Editor Shader (not onboarding — the editor watermark background)

When no files are open, the empty editor shows this CSS background:

```css
.monaco-workbench .part.editor > .content .editor-group-container.empty::before {
  content: '';
  position: absolute;
  inset: -25%;
  pointer-events: none;
  z-index: 0;
  background-image:
    radial-gradient(circle at 30% 30%, rgba(167, 139, 250, 0.35), transparent 45%),
    radial-gradient(circle at 70% 60%, rgba(139, 92, 246, 0.30), transparent 50%),
    radial-gradient(circle at 50% 80%, rgba(159, 255, 61, 0.10), transparent 40%),
    conic-gradient(from 0deg at 50% 50%, rgba(91, 33, 182, 0.15), rgba(139, 92, 246, 0.25), rgba(91, 33, 182, 0.15));
  filter: blur(60px);
  animation: v3-shader-drift 40s linear infinite, v3-shader-pulse 8s ease-in-out infinite;
}

@keyframes v3-shader-pulse {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}
```

Grid overlay on editor:
```css
.monaco-workbench .part.editor > .content .editor-group-container.empty::after {
  background-image:
    linear-gradient(rgba(139, 92, 246, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(139, 92, 246, 0.04) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse 60% 60% at 50% 50%, black 30%, transparent 80%);
}
```

---

## Part 2: V3Code Color Palette

### 2.1 Base (Layered Blacks)

| Name | Hex | Usage |
|---|---|---|
| Abyss | `#07080C` | Deepest background (editor canvas) |
| Void | `#0B0D14` | Panels, sidebars |
| Obsidian | `#10121A` | Secondary panels, chat background |
| Slate | `#161820` | Elevated surfaces (dropdowns, modals) |
| Ash | `#1C1E27` | Borders, dividers, input backgrounds |
| Smoke | `#252730` | Inactive tabs |

### 2.2 Primary Accent — Amethyst (Purple)

| Name | Hex | Usage |
|---|---|---|
| Amethyst | `#8B5CF6` | Primary brand, logo, AI chat accent |
| Amethyst Glow | `#A78BFA` | Hover states, lighter accents |
| Amethyst Deep | `#6D28D9` | Pressed states |
| Amethyst Muted | `#7C3AED20` | Selection backgrounds (20% opacity) |
| Amethyst Wash | `#8B5CF610` | Subtle surface tints (10% opacity) |

### 2.3 Secondary Accent — Venom (Green)

| Name | Hex | Usage |
|---|---|---|
| Venom | `#7FE650` | Secondary brand, terminal, success |
| Venom Bright | `#9FFF3D` | Cursor caret, "alive" indicators |
| Venom Muted | `#7FE65030` | Memory/sticky-note gutter icons (30%) |
| Venom Deep | `#4ADE20` | Terminal prompt accent |

### 2.4 Text Colors

| Name | Hex | Usage |
|---|---|---|
| Text Primary | `#E4E4ED` | Main text, code |
| Text Secondary | `#9898A6` | Comments, descriptions |
| Text Tertiary | `#5A5A6E` | Placeholders, disabled |
| Text Bright | `#FFFFFF` | Active tabs, focused input |

---

## Part 3: Brand Identity

### 3.1 Name & Domain

- **Product:** V3Code
- **Stylization:** Capital V, numeric 3, capital C
- **CLI/paths:** lowercase `v3code` — `v3code.exe`, `.v3code/`, `v3code-server`
- **Domain:** `v3code.dev`
- **Built by:** Daniel (KandD Labs)
- **License:** Closed-source premium fork of Void Editor (Apache 2.0 VS Code fork)

### 3.2 Taglines

- **Marketing:** *"VS Code with an AI that actually reads your codebase."*
- **Technical:** *"Structural code intelligence, wired in."*
- **Tagline:** *"The editor whose AI actually understands your code."*

### 3.3 The Wedge (Elevator Pitch)

V3Code ships with **Context Bridge** wired in as a native, always-on structural intelligence engine, plus a local embeddings index. It is NOT another open-source VS Code fork — it's a premium IDE for engineers who want their AI to actually understand their codebase. Your code never leaves your machine. The index is yours. The notes are yours.

---

## Part 4: Context Bridge — The Structural Intelligence Engine

### 4.1 What It Is

Context Bridge connects the Language Server Protocol (LSP) — the same code intelligence that powers go-to-definition, find-references, and call hierarchy in VS Code — directly into the AI agent's chat context. Every other AI editor (Copilot, Cursor, Trae) has LSP data and none of them pipe it to the agent. The agent works blind, using grep to rediscover what the language server already knows. Context Bridge closes that gap.

### 4.2 The 10 Built-in Tools

All tools are native built-ins compiled into the editor binary. NOT external MCP servers. NOT discoverable via `tools/list`. Always on, always works.

#### Structural Intelligence Tools (LSP-backed)

| Tool | What It Does |
|---|---|
| `get_symbol_context` | Everything about a symbol in ONE call: definition snippet, ALL callers, ALL callees, ALL references, type hierarchy (super/sub types), active diagnostics, AND any persistent notes. Replaces grep + manual tracing. |
| `get_file_context` | Structural picture of a whole file: every symbol defined (functions, classes, methods, types, exports), every import statement, all active diagnostics. Cheaper than reading the whole file. |
| `get_call_graph` | Multi-level caller/callee tree with cycle detection. "Who eventually calls this?" or "What does this eventually call?" Depth 1-4. |
| `get_file_dependencies` | Two-way dependency map: what this file imports + what other files import it. Use before moving/renaming. |
| `pack_context` | Task-typed context bundle packed into a token budget. Adapts composition: "understand" = definition + couple callers, "refactor" = ALL callers + references (impact-heavy), "debug" = definition + diagnostics + callers (root-cause), "extend" = definition + few callers (template-finding). |
| `get_project_briefing` | Fresh project state: file tree, recent git commits, AGENTS.md sections, all persistent notes. |

#### Memory & Search Tools

| Tool | What It Does |
|---|---|
| `remember` | Attach a persistent note to a symbol. Notes survive across sessions and auto-inject when the symbol is queried. Institutional memory. |
| `forget` | Delete a note. |
| `list_notes` | List all symbol-attached notes in the workspace. |
| `find_text` | Workspace text search with context. Not grep — LSP-aware ranking. |
| `semantic_search` | Semantic codebase search: local embeddings index + FTS5, merged by Reciprocal Rank Fusion across embedding, lexical, and HyDE channels. "How does auth work?" → finds relevant code even without matching keywords. |

### 4.3 The "Agent Doesn't Work Blind" Advantage

Without Context Bridge, an AI coding agent does this:
1. Gets a user question about code
2. Greps for function names
3. Reads files at random
4. Traces imports manually
5. Misses indirect callers
6. Has no memory of previous discoveries

With Context Bridge:
1. `get_symbol_context("handleAuth")` → sees definition + every caller + every callee + diagnostics + notes — in one call
2. `get_call_graph("handleAuth", depth=3)` → sees the full impact tree
3. `get_file_dependencies("auth.ts")` → sees everything that would break if you move it
4. `remember("handleAuth", "throws if session is null — caller MUST check")` → every future agent session sees this

**Cursor's own agent confirmed: "Those three things would eliminate 80% of the searching I do."** Context Bridge provides all three, plus 7 more.

---

## Part 5: Semantic Indexing — Local-First Embeddings

### 5.1 The Problem It Solves

GitHub Copilot has `@workspace` — a cloud-hosted semantic index. Cursor has it but charges $20/mo (partly for this). Void (the upstream fork) doesn't have it. V3Code ships it for free, running entirely on the user's machine.

### 5.2 Architecture

```
IndexerService (browser, workbench contribution)
  → indexer.worker.ts (Node worker thread)
    → Walk workspace (gitignore-respecting)
    → tree-sitter chunk per file → Chunk[]
    → SHA-256 each chunk → diff vs sqlite manifest
    → Embed only changed chunks (batched, 32 at a time)
    → UPSERT into .v3code/index.db

RetrieverService (browser)
  → queryExpand(prompt) → { original, codeTerms, hypotheticalCode }
  → Embed each → 3 vector queries (top-k=20 each)
  → FTS5 lexical query → top-k=20
  → RRF merge (k=60) → top-k=30 chunks
  → Hydrate text → return Hit[]
```

### 5.3 Key Design Decisions

| Decision | Value |
|---|---|
| **Vector store** | sqlite-vec — single `.v3code/index.db` per workspace |
| **Embedding model** | `Xenova/jina-embeddings-v2-base-code` (768d, ~150MB, via transformers.js) |
| **Fallback model** | `Xenova/all-MiniLM-L6-v2` (384d, ~80MB) for low-RAM (<4GB) |
| **Chunking** | tree-sitter semantic units (functions, classes, methods) — NOT fixed-size line windows |
| **Incremental indexing** | Merkle hashes (SHA-256 per chunk), only re-embed changed chunks |
| **Query expansion** | HyDE (Hypothetical Document Embeddings) — rewrites prompt into hypothetical code + terms |
| **HyDE model** | Qwen2.5-Coder-0.5B-Instruct GGUF (~400MB) via node-llama-cpp |
| **Retrieval fusion** | Reciprocal Rank Fusion (k=60) across vector + lexical + HyDE channels |
| **Privacy** | Everything runs local. No upload. No cloud. No auth. No billing. |

### 5.4 Languages Supported (v1)

TypeScript, JavaScript, TSX, JSX, Python, Go, Rust, Java, C#, C++, Ruby. Others fall back to file-level chunks.

---

## Part 6: What V3Code Beats Copilot/Cursor On

| Capability | Copilot | Cursor | Void (upstream) | **V3Code** |
|---|---|---|---|---|
| LSP-backed symbol context in agent | No | No | No | **Yes — Built-in** |
| Persistent symbol notes (cross-session) | No | No | No | **Yes** |
| Call graph traversal | No | No | No | **Yes** |
| MCP support | Half-baked | No | Yes | **Yes** |
| DeepSeek support | No | No | Yes | **Yes** |
| BYOK providers | Locked catalog | Locked + paid | 13+ | **13+** |
| Local embeddings (@workspace) | Yes (cloud) | Yes ($20/mo) | No | **Planned — free, local** |
| File dependency mapping | No | No | No | **Yes** |
| Task-typed context packing | No | No | No | **Yes** |
| Agent operating system prompt | Minimal | Excellent (20-section) | Good | **Battle-tested + LSP-aware** |

---

## Part 7: LLM Providers (13+)

Anthropic, OpenAI, DeepSeek (v4 Pro works out of box), OpenRouter, Gemini, Groq, xAI, Mistral, Azure, Ollama, vLLM, LM Studio, liteLLM, Vertex, openAI-compatible.

### Chat Modes
- **Normal:** No tools, conversational
- **Gather:** Read-only tools (search, read, list)
- **Agent:** Full tool access (edit, terminal, all Context Bridge tools)

---

## Part 8: Key Files Reference

| File | Purpose |
|---|---|
| `vselite/src/vs/workbench/contrib/void/browser/react/src2/void-onboarding/VoidOnboarding.tsx` | Welcome page UI, ASCII art, fade-in, button |
| `vselite/src/vs/workbench/contrib/void/browser/react/src/void-onboarding/V3CodeShader.tsx` | GPU WebGL background shader |
| `vselite/src/vs/workbench/contrib/void/browser/media/void.css` | Empty editor shader CSS, chat panel polish |
| `vselite/src/vs/workbench/contrib/void/common/prompt/prompts.ts` | V3Code Agent OS system prompt, all 21 tool definitions |
| `vselite/V3CODE-BRANDING.md` | Full color palette, brand guidelines |
| `vselite/V3CODE-PLAN.md` | Build plan, codebase map, competitive analysis |
| `vselite/SEMANTIC-INDEXING-SPEC.md` | Full semantic indexing architecture |
| `vselite/CONTEXT-BRIDGE-INTEGRATION.md` | How Context Bridge wires in |
| `vselite/AGENTS.md` | Project journal, current phase, tool catalog |
| `context-bridge/.github/copilot-instructions.md` | Full build spec with audit results |

---

## Part 9: CSS Summary for Website Reproduction

### 9.1 Key Animations

```css
/* Cursor blink */
@keyframes v3code-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

/* Shader drift (background rotation) */
@keyframes v3-shader-drift {
  0%   { transform: rotate(0deg) scale(1); }
  50%  { transform: rotate(180deg) scale(1.15); }
  100% { transform: rotate(360deg) scale(1); }
}

/* Shader pulse (breathing opacity) */
@keyframes v3-shader-pulse {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}
```

### 9.2 Complete Welcome Page HTML/CSS Template

```html
<div style="
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #020207;
  position: relative;
  overflow: hidden;
  font-family: monospace;
">
  <!-- Background shader (CSS approximation) -->
  <div style="
    position: absolute;
    inset: -25%;
    background:
      radial-gradient(circle at 30% 30%, rgba(59,21,104,0.4), transparent 50%),
      radial-gradient(circle at 70% 60%, rgba(139,92,246,0.2), transparent 50%);
    filter: blur(60px);
    animation: v3-shader-drift 40s linear infinite;
  "></div>

  <!-- Radial vignette -->
  <div style="
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 0%, rgba(3,4,10,0.55) 55%, rgba(0,0,0,0.92) 100%);
  "></div>

  <!-- Scanlines -->
  <div style="
    position: absolute;
    inset: 0;
    pointer-events: none;
    mix-blend-mode: overlay;
    opacity: 0.4;
    background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 1px, transparent 1px, transparent 3px);
  "></div>

  <!-- Corner brackets -->
  <div style="position:absolute;top:1.5rem;left:1.5rem;font-size:0.75rem;color:#5A5A6E;z-index:20;pointer-events:none;">┌─ v3code.sys ──</div>
  <div style="position:absolute;top:1.5rem;right:1.5rem;font-size:0.75rem;color:#5A5A6E;z-index:20;pointer-events:none;">── status: ready ─┐</div>
  <div style="position:absolute;bottom:1.5rem;left:1.5rem;font-size:0.75rem;color:#5A5A6E;z-index:20;pointer-events:none;">└─ build: 0x0001 ──</div>
  <div style="position:absolute;bottom:1.5rem;right:1.5rem;font-size:0.75rem;color:#5A5A6E;z-index:20;pointer-events:none;">── KandD/labs ─┘</div>

  <!-- Main content -->
  <div style="position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;gap:2rem;text-align:center;">

    <!-- ASCII Art -->
    <pre style="
      font-family: monospace;
      font-size: clamp(12px, 1.8vw, 22px);
      line-height: 1.05;
      letter-spacing: 0.02em;
      color: #E4E4ED;
      text-shadow: 0 0 18px rgba(139,92,246,0.85), 0 0 48px rgba(139,92,246,0.45), 0 0 2px rgba(127,230,80,0.4);
      margin: 0;
      user-select: none;
    ">██╗   ██╗██████╗  ██████╗ ██████╗ ██████╗ ███████╗
██║   ██║╚════██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝
██║   ██║ █████╔╝██║     ██║   ██║██║  ██║█████╗
╚██╗ ██╔╝ ╚═══██╗██║     ██║   ██║██║  ██║██╔══╝
 ╚████╔╝ ██████╔╝╚██████╗╚██████╔╝██████╔╝███████╗
  ╚═══╝  ╚═════╝  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝</pre>

    <!-- structural_intelligence.init() -->
    <div style="font-family:monospace;font-size:0.875rem;letter-spacing:0.1em;">
      <span style="color:#7FE650;text-shadow:0 0 8px rgba(127,230,80,0.6)">$</span>
      <span style="color:#A78BFA;text-shadow:0 0 12px rgba(167,139,250,0.5)">structural_intelligence</span>
      <span style="color:#5A5A6E">.</span>
      <span style="color:#E4E4ED">init</span>
      <span style="color:#5A5A6E">()</span>
      <span style="display:inline-block;width:0.5rem;height:1rem;background:#7FE650;animation:v3code-blink 1s steps(2) infinite;box-shadow:0 0 8px rgba(127,230,80,0.7);"></span>
    </div>

    <!-- Architecture tagline -->
    <div style="font-family:monospace;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.4em;color:#5A5A6E;">
      [ ctx-bridge :: lsp :: graph :: pack ]
    </div>

    <!-- Initialize button -->
    <button style="
      font-family: monospace;
      font-size: 0.875rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 0.75rem 2rem;
      color: #E4E4ED;
      background: rgba(11,13,20,0.75);
      border: 1px solid rgba(139,92,246,0.5);
      box-shadow: 0 0 24px rgba(139,92,246,0.25), inset 0 0 24px rgba(139,92,246,0.08);
      backdrop-filter: blur(6px);
      cursor: pointer;
      transition: all 0.2s ease;
    " onmouseover="this.style.borderColor='#8B5CF6';this.style.color='#FFFFFF';this.style.boxShadow='0 0 32px rgba(139,92,246,0.55), inset 0 0 24px rgba(139,92,246,0.15)'" onmouseout="this.style.borderColor='rgba(139,92,246,0.5)';this.style.color='#E4E4ED';this.style.boxShadow='0 0 24px rgba(139,92,246,0.25), inset 0 0 24px rgba(139,92,246,0.08)'">
      <span style="color:#7FE650">&gt;</span> Initialize_
    </button>

  </div>
</div>
```

---

## Part 10: What To Highlight On The Website

### Hero Section
- The ASCII art welcome screen (reproduced exactly per Part 1)
- Tagline: *"The editor whose AI actually understands your code."*
- Subtitle: *"Structural code intelligence, wired in."*

### "Why V3Code" Section
1. **AI that actually reads your codebase** — Context Bridge pipes real LSP symbol data (definitions, callers, callees, references, type hierarchies) directly into the AI agent. Not grep. Not guessing. Real structure.

2. **Your code never leaves your machine** — Local embeddings index via sqlite-vec. Semantic search that runs 100% on-device. No cloud upload. No auth. No billing.

3. **Persistent institutional memory** — `remember` attaches notes to symbols that survive across sessions. Every future AI session sees what you learned. The project doesn't forget.

4. **13+ LLM providers, BYOK** — DeepSeek, Anthropic, OpenAI, Gemini, Groq, Ollama, LM Studio... bring your own keys, use local models, no lock-in.

5. **10 structural intelligence tools** — `get_symbol_context`, `get_call_graph`, `pack_context`, `get_file_dependencies`, `semantic_search` — tools no other editor gives its AI agent.

### Comparison Table
Use the table from Part 6. The visual impact of four "No" columns vs all "Yes" for V3Code is powerful.

### Architecture Diagram
Show the three-layer architecture:
```
AI Agent ← Context Packer ← Graph/Cache ← LSP Bridge ← Language Servers
                ↑                              ↑
           .v3code/notes.json           .v3code/index.db
                                         (sqlite-vec + FTS5)
```

---

*Document compiled from the V3Code + Context Bridge source code, May 26, 2026.*
