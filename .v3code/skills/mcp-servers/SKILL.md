---
name: mcp-servers
description: Building Model Context Protocol (MCP) servers and tools
keywords:
  - MCP
  - model context protocol
  - tool
  - server
  - resource
  - stdio
  - transport
alwaysApply: false
---

# MCP Server Building Skill

## What is MCP?

Model Context Protocol (MCP) defines how AI agents discover and use tools. An MCP server exposes:
- **Tools** — functions the agent can call (with parameters and return values)
- **Resources** — read-only data the agent can access
- **Prompts** — pre-defined prompt templates

## Server Structure

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'my-mcp-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
    resources: {},
  },
});

// Register tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'search_files',
      description: 'Search for files matching a pattern',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern to match' },
          directory: { type: 'string', description: 'Directory to search in' },
        },
        required: ['pattern'],
      },
    },
  ],
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'search_files':
      const results = await searchFiles(args.pattern, args.directory);
      return { content: [{ type: 'text', text: JSON.stringify(results) }] };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Tool Design Principles

1. **Clear names** — verb_noun format (search_files, create_user)
2. **Focused scope** — each tool does one thing
3. **Rich descriptions** — the LLM reads these to decide when to use the tool
4. **Typed schemas** — use JSON Schema with descriptions on every parameter
5. **Meaningful errors** — return error messages the LLM can act on
6. **Idempotent where possible** — same input → same result

## Resource Design

```typescript
server.setRequestHandler('resources/list', async () => ({
  resources: [
    {
      uri: 'config://app/settings',
      name: 'Application Settings',
      description: 'Current application configuration',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler('resources/read', async (request) => {
  const { uri } = request.params;
  if (uri === 'config://app/settings') {
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(config) }] };
  }
});
```

## Transport Options

- **stdio** — simplest, process-based, used for local tools
- **HTTP/SSE** — remote servers, web-hosted tools
- **WebSocket** — bidirectional streaming

## Testing

- Test tools independently (unit tests on the handler functions)
- Use the MCP Inspector for interactive testing
- Verify error handling (invalid params, missing required fields)
- Check that descriptions are clear enough for the LLM to use correctly
