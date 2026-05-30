---
name: cloudflare-workers
description: Cloudflare Workers, KV, D1, R2, and edge computing
keywords:
  - cloudflare
  - workers
  - edge
  - KV
  - D1
  - R2
  - wrangler
  - pages
  - durable objects
  - AI
alwaysApply: false
---

# Cloudflare Workers Skill

## What Are Workers?

Cloudflare Workers run JavaScript/TypeScript at the edge (300+ data centers worldwide). Sub-millisecond cold starts, no server management.

## Basic Worker

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/hello') {
      return Response.json({ message: 'Hello from the edge!' });
    }
    
    return new Response('Not Found', { status: 404 });
  },
};
```

## Storage Options

| Storage | Use Case | Limits |
|---------|----------|--------|
| KV | Key-value, read-heavy, eventually consistent | 25MB values |
| D1 | SQLite database, full SQL | Serverless SQL |
| R2 | Object storage (S3-compatible) | No egress fees |
| Durable Objects | Stateful coordination, strong consistency | Per-object |

### KV (Key-Value)
```typescript
// Write
await env.MY_KV.put('user:123', JSON.stringify({ name: 'Alice' }), { expirationTtl: 3600 });

// Read
const data = await env.MY_KV.get('user:123', { type: 'json' });
```

### D1 (SQL)
```typescript
const { results } = await env.DB.prepare(
  'SELECT * FROM users WHERE id = ?'
).bind(userId).all();
```

### R2 (Object Storage)
```typescript
// Upload
await env.BUCKET.put('files/doc.pdf', fileBuffer, {
  httpMetadata: { contentType: 'application/pdf' },
});

// Download
const object = await env.BUCKET.get('files/doc.pdf');
const data = await object?.arrayBuffer();
```

## Wrangler CLI

```bash
npx wrangler init my-worker         # Create new project
npx wrangler dev                     # Local development
npx wrangler deploy                  # Deploy to production
npx wrangler d1 create my-db        # Create D1 database
npx wrangler kv namespace create KV  # Create KV namespace
npx wrangler tail                    # Live logs
```

## wrangler.toml

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "MY_KV"
id = "abc123"

[[d1_databases]]
binding = "DB"
database_name = "my-db"
database_id = "def456"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "my-bucket"
```

## Workers AI

```typescript
const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
  messages: [{ role: 'user', content: 'What is Cloudflare?' }],
});
```

## Durable Objects (Stateful)

```typescript
export class ChatRoom {
  state: DurableObjectState;
  sessions: WebSocket[] = [];
  
  constructor(state: DurableObjectState) {
    this.state = state;
  }
  
  async fetch(request: Request): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair());
    this.sessions.push(server);
    server.accept();
    
    server.addEventListener('message', (msg) => {
      this.broadcast(msg.data);
    });
    
    return new Response(null, { status: 101, webSocket: client });
  }
  
  broadcast(message: string) {
    this.sessions.forEach(ws => ws.send(message));
  }
}
```

## Best Practices

- Keep Workers small (< 1MB after bundling)
- Use `waitUntil()` for fire-and-forget work after response
- Set appropriate Cache-Control headers
- Use bindings (env) for all external resources
- Never hardcode secrets — use `wrangler secret put`
