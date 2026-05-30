---
name: azure-functions
description: Azure Functions serverless patterns and triggers
keywords:
  - azure function
  - serverless
  - trigger
  - binding
  - timer
  - queue
  - blob trigger
  - HTTP trigger
  - durable functions
alwaysApply: false
---

# Azure Functions Skill

## Function Structure (Node.js v4 Model)

```typescript
import { app, HttpRequest, HttpResponseInit } from '@azure/functions';

app.http('getUser', {
  methods: ['GET'],
  route: 'users/{id}',
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    const id = request.params.id;
    const user = await getUser(id);
    
    if (!user) return { status: 404, jsonBody: { error: 'Not found' } };
    return { jsonBody: user };
  },
});
```

## Common Triggers

### HTTP Trigger
```typescript
app.http('api', {
  methods: ['GET', 'POST'],
  route: 'items/{id?}',
  handler: async (req) => { /* ... */ },
});
```

### Timer Trigger (cron)
```typescript
app.timer('cleanup', {
  schedule: '0 */5 * * * *', // Every 5 minutes
  handler: async (timer) => {
    await cleanupExpiredSessions();
  },
});
```

### Queue Trigger
```typescript
app.storageQueue('processOrder', {
  queueName: 'orders',
  connection: 'AzureWebJobsStorage',
  handler: async (message: string) => {
    const order = JSON.parse(message);
    await processOrder(order);
  },
});
```

### Blob Trigger
```typescript
app.storageBlob('processUpload', {
  path: 'uploads/{name}',
  connection: 'AzureWebJobsStorage',
  handler: async (blob: Buffer, context) => {
    await processFile(blob, context.triggerMetadata.name);
  },
});
```

## Hosting Plans

| Plan | Cold Start | Scale | Price |
|------|-----------|-------|-------|
| Consumption | Yes (seconds) | 0→200 instances | Pay per execution |
| Flex Consumption | Minimal | 0→1000 instances | Pay per execution + reserved |
| Premium | No | 1→100 instances | Always-on instances |
| Dedicated (App Service) | No | Manual/auto | Fixed monthly |

## Durable Functions (Orchestration)

```typescript
import * as df from 'durable-functions';

// Orchestrator
df.app.orchestration('processOrderOrchestrator', function* (context) {
  const order = context.df.getInput();
  
  yield context.df.callActivity('validateOrder', order);
  yield context.df.callActivity('chargePayment', order);
  yield context.df.callActivity('shipOrder', order);
  yield context.df.callActivity('sendConfirmation', order);
});

// Activity
df.app.activity('validateOrder', { handler: async (order) => { /* ... */ } });
```

## Best Practices

- Keep functions small and focused (single responsibility)
- Use connection strings from App Settings, not hardcoded
- Set appropriate timeouts (default 5min on Consumption)
- Use managed identity for Azure resource access
- Log with `context.log` for Application Insights integration
- Handle idempotency (functions may retry on failure)

## Local Development

```bash
npm install -g azure-functions-core-tools@4
func init MyProject --typescript
func new --name MyFunction --template "HTTP trigger"
func start  # Run locally
```
