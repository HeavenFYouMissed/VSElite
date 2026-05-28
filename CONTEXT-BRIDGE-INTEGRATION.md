# Context Bridge → V3Code Integration Spec

**Status: Phase 1 shipped, Phase 2 planned.**

## Architecture: Hybrid MCP + built-in

After hitting rootDir/build issues with the vendoring approach, pivoted to hybrid:

```
V3Code launches
  ├→ contextBridgeStartup.ts auto-registers CB as MCP server
  │   └→ Writes to <userHome>/.v3code/mcp.json
  │
  ├→ MCPService (existing Void plumbing) spawns Context Bridge
  │   └→ 5 primitives available via MCP in agent's tool picker
  │
  └→ 4 composer tools registered as built-in tools (toolsService.ts)
      └→ NOT exposed via MCP — closed-source moat
```

## Phase 1 — SHIPPED

**5 structural primitives via MCP** (auto-connected on startup):

| Tool | Purpose |
|---|---|
| `get_symbol_context` | Symbol neighborhood: def, callers, callees, refs, diagnostics |
| `get_file_context` | Structural overview of a file |
| `get_call_graph` | Recursive call graph (in/out, depth 1-4) |
| `get_file_dependencies` | What imports this + what this imports |
| `find_text` | Grep with context across workspace |

Implementation: `browser/contextBridgeStartup.ts` — 80-line workbench contribution that writes Context Bridge into the user's MCP config on startup. Zero new compilation errors.

## Phase 2 — Planned

**4 composer tools as built-ins** (register in `toolsService.ts` + `toolsServiceTypes.ts` + `prompts.ts`):

| Tool | Purpose |
|---|---|
| `pack_context` | Selects right slice for task (understand/refactor/debug/extend) with token budget |
| `remember` | Attach persistent note to symbol (cross-session) |
| `forget` | Remove note from symbol |
| `list_notes` | List all notes in workspace |

These read/write `.context-bridge/notes.json` directly (no MCP wire). Their tool surface never appears in MCP `tools/list`.

## Files

| File | Purpose |
|---|---|
| `browser/contextBridgeStartup.ts` | Auto-register CB as MCP server on startup |
| `browser/void.contribution.ts` | Import line added for startup service |
| `toolsServiceTypes.ts` | Will add 4 composer tool types (Phase 2) |
| `toolsService.ts` | Will add 4 composer tool implementations (Phase 2) |
| `prompts.ts` | Will add 4 composer tool metadata (Phase 2) |
