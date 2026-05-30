---
name: node-backend
description: Node.js backend patterns and Express/Fastify conventions
globs:
  - "server.ts"
  - "server.js"
  - "app.ts"
  - "app.js"
  - "**/routes/**"
  - "**/controllers/**"
  - "**/middleware/**"
keywords:
  - node
  - express
  - fastify
  - server
  - backend
  - middleware
  - route
  - controller
alwaysApply: false
---

# Node.js Backend Skill

## Project Structure

```
src/
  index.ts          # Entry point — starts server
  app.ts            # Express/Fastify app setup
  routes/           # Route definitions
  controllers/      # Request handlers
  services/         # Business logic
  middleware/       # Auth, validation, error handling
  models/           # Data models / types
  utils/            # Shared utilities
  config/           # Environment config
```

## Middleware Pattern

```typescript
// Error handling middleware (must be last)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = statusCode === 500 ? 'Internal Server Error' : err.message;
  
  logger.error('Request error', { err, path: req.path, method: req.method });
  res.status(statusCode).json({ error: { message, code: err.code } });
});
```

## Request Validation

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['user', 'admin']).default('user'),
});

app.post('/users', async (req, res, next) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() });
  }
  // result.data is typed and validated
});
```

## Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
  });
  await database.disconnect();
  await cache.disconnect();
  process.exit(0);
});
```

## Environment Config

```typescript
const config = {
  port: parseInt(process.env.PORT || '3000'),
  database: {
    url: process.env.DATABASE_URL || 'postgres://localhost:5432/dev',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
} as const;

// Validate required vars at startup
const required = ['DATABASE_URL'] as const;
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}
```

## Common Mistakes

- Forgetting async error handling (unhandled promise rejections crash the process)
- Not setting request timeouts (slow clients hold connections forever)
- Blocking the event loop (CPU-heavy work should be in a worker thread)
- Not validating environment variables at startup
- Returning stack traces to clients in production
