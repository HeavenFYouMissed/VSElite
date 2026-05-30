---
name: logging
description: Logging, observability, and debugging in production
keywords:
  - log
  - logging
  - monitor
  - observability
  - trace
  - metric
  - alert
  - debug production
  - structured log
alwaysApply: false
---

# Logging & Observability Skill

## Structured Logging

### Always log as JSON in production
```typescript
logger.info('User created', {
  userId: user.id,
  email: user.email,
  source: 'registration',
  duration_ms: Date.now() - startTime,
});
```

### Log Levels
| Level | When to use |
|-------|-------------|
| `error` | Something broke, needs attention |
| `warn` | Degraded but functional, monitor it |
| `info` | Business events (user created, order placed) |
| `debug` | Developer troubleshooting (request details) |

### What to Log
- Request/response metadata (method, path, status, duration)
- Business events (user signup, payment processed)
- Errors with full context (stack, request data, user ID)
- External service calls (duration, success/failure)

### What NOT to Log
- Passwords, tokens, secrets
- Full request bodies in production (PII risk)
- Every loop iteration (overwhelms log storage)
- Redundant information (don't log what the framework already logs)

## Correlation IDs

Assign a unique ID to each request and pass it through all service calls:
```typescript
const requestId = crypto.randomUUID();
// Include in all logs, pass in headers to downstream services
logger.info('Processing request', { requestId, path: req.path });
```

## Health Checks

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDB(),
    redis: await checkRedis(),
    externalApi: await checkExternalApi(),
  };
  
  const healthy = Object.values(checks).every(c => c.status === 'ok');
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks });
});
```

## Metrics to Track

- Request rate (requests/second)
- Error rate (errors/total requests)
- Latency (p50, p95, p99)
- Saturation (CPU, memory, connections)
- Business metrics (signups, conversions, revenue)

## Alerting Rules

- Alert on symptoms (high error rate), not causes (CPU usage)
- Use percentile latency (p99 > 2s), not average
- Include runbook links in alert descriptions
- Avoid alert fatigue: only alert on actionable conditions
