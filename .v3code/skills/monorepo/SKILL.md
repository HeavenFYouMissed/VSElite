---
name: monorepo
description: Monorepo patterns, workspace management, and shared code
keywords:
  - monorepo
  - workspace
  - turborepo
  - nx
  - lerna
  - shared
  - packages
  - build order
alwaysApply: false
---

# Monorepo Skill

## When to Use a Monorepo

- Multiple packages that share code
- Frontend + backend in same repo
- Multiple apps with shared UI components
- Libraries with consistent versioning

## Structure

```
/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # Express backend
│   └── mobile/       # React Native
├── packages/
│   ├── shared/       # Shared types, utils
│   ├── ui/           # Shared components
│   └── config/       # Shared eslint/ts configs
├── package.json      # Root workspace config
└── turbo.json        # Build orchestration
```

## npm Workspaces

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

## Turborepo (Build Orchestration)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

## Internal Package Pattern

```json
// packages/shared/package.json
{
  "name": "@myapp/shared",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

```typescript
// apps/web/src/utils.ts
import { formatDate } from '@myapp/shared';
```

## Rules

1. **Shared packages export through index.ts** — single entry point
2. **No circular dependencies** between packages
3. **Build order matters** — dependencies build before dependents
4. **Consistent TypeScript config** — extend from shared base
5. **Test in isolation** — each package has its own test suite
6. **Version together or independently** — pick one strategy

## Common Commands

```bash
# Run in specific workspace
npm run dev -w apps/web

# Run in all workspaces
npm run build --workspaces

# Add dep to specific workspace
npm install zod -w packages/shared

# Turbo: run with caching
npx turbo run build
npx turbo run test --filter=apps/web
```
