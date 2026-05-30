---
name: websockets
description: WebSocket implementation and real-time communication patterns
keywords:
  - websocket
  - real-time
  - socket
  - ws
  - live
  - streaming
  - event
  - push
  - SSE
  - server-sent events
alwaysApply: false
---

# WebSocket & Real-Time Skill

## When to Use What

| Technology | Use When |
|-----------|----------|
| WebSocket | Bidirectional real-time (chat, gaming, collab editing) |
| Server-Sent Events (SSE) | Server → client only (notifications, feeds, progress) |
| HTTP Polling | Simple, low-frequency updates, wide compatibility |
| Long Polling | Pseudo-real-time when WS isn't available |

## WebSocket Server (Node.js with ws)

```typescript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws, req) => {
  const clientId = crypto.randomUUID();
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    handleMessage(clientId, message);
  });
  
  ws.on('close', () => {
    cleanup(clientId);
  });
  
  ws.on('error', (err) => {
    console.error(`Client ${clientId} error:`, err);
  });
  
  // Send welcome
  ws.send(JSON.stringify({ type: 'connected', clientId }));
});
```

## Message Protocol Design

```typescript
// Use a discriminated union for message types
type ClientMessage =
  | { type: 'chat'; content: string; channelId: string }
  | { type: 'typing'; channelId: string }
  | { type: 'subscribe'; channelId: string }
  | { type: 'ping' }

type ServerMessage =
  | { type: 'chat'; from: string; content: string; timestamp: number }
  | { type: 'typing'; userId: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' }
```

## Heartbeat / Keep-Alive

```typescript
// Server-side ping every 30s
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30_000);

ws.on('pong', () => { ws.isAlive = true; });
```

## Reconnection (Client-Side)

```typescript
function createReconnectingWS(url: string) {
  let ws: WebSocket;
  let retries = 0;
  
  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => { retries = 0; };
    ws.onclose = () => {
      const delay = Math.min(1000 * 2 ** retries, 30000);
      retries++;
      setTimeout(connect, delay);
    };
  }
  
  connect();
  return { send: (data: string) => ws.send(data) };
}
```

## Server-Sent Events (SSE)

```typescript
// Server
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  sendEvent({ type: 'connected' });
  req.on('close', () => { /* cleanup */ });
});

// Client
const source = new EventSource('/events');
source.onmessage = (event) => {
  const data = JSON.parse(event.data);
};
```
