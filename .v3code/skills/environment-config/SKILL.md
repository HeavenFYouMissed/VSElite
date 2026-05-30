---
name: environment-config
description: Environment variables, configuration, and secrets management
keywords:
  - env
  - environment
  - config
  - secret
  - dotenv
  - variable
  - .env
  - configuration
alwaysApply: false
---

# Environment & Configuration Skill

## Principles

1. **Never hardcode** secrets, URLs, or environment-specific values
2. **Fail fast** — validate all required config at startup
3. **Provide defaults** for non-sensitive development values
4. **Document** every variable in `.env.example`

## Pattern: Typed Config Module

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
```

## .env.example

```bash
# Server
NODE_ENV=development
PORT=3000

# Database (required)
DATABASE_URL=postgres://user:password@localhost:5432/myapp

# Redis (optional - used for caching)
REDIS_URL=redis://localhost:6379

# Auth (required)
JWT_SECRET=your-secret-key-at-least-32-characters-long

# External APIs (optional)
API_KEY=
```

## Security Rules

- `.env` is ALWAYS in `.gitignore`
- Use separate `.env` files per environment (`.env.local`, `.env.production`)
- In production: use secrets management (Vault, AWS Secrets Manager, Azure Key Vault)
- Rotate secrets regularly
- Never log config values that contain secrets

## Per-Environment Config

```
.env                # Base defaults (committed, no secrets)
.env.local          # Local overrides (gitignored)
.env.development    # Dev-specific (gitignored)
.env.production     # Prod-specific (gitignored, or in CI secrets)
```

Load order: `.env` → `.env.{NODE_ENV}` → `.env.local` → actual env vars

## Feature Flags

```typescript
const features = {
  newDashboard: process.env.FF_NEW_DASHBOARD === 'true',
  betaSearch: process.env.FF_BETA_SEARCH === 'true',
  maxUploadSize: parseInt(process.env.MAX_UPLOAD_MB || '10') * 1024 * 1024,
};

// Usage
if (features.newDashboard) {
  renderNewDashboard();
}
```
