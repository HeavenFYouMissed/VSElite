---
name: package-management
description: npm, dependency management, and monorepo patterns
keywords:
  - npm
  - package
  - dependency
  - install
  - update
  - version
  - monorepo
  - workspace
  - publish
  - lockfile
alwaysApply: false
---

# Package Management Skill

## npm Commands

| Command | Purpose |
|---------|---------|
| `npm ci` | Clean install from lockfile (CI/production) |
| `npm install` | Install + update lockfile |
| `npm install <pkg>` | Add dependency |
| `npm install -D <pkg>` | Add dev dependency |
| `npm outdated` | Show outdated packages |
| `npm audit` | Check for vulnerabilities |
| `npm audit fix` | Auto-fix vulnerabilities |
| `npm run <script>` | Run package.json script |

## Dependency Rules

1. **Use exact versions for critical deps** — avoid surprise breaks
2. **Use `^` (caret) for libraries** — allows compatible updates
3. **Never commit `node_modules`** — use lockfile
4. **Review what you install** — check download count, maintenance, size
5. **Audit regularly** — `npm audit` weekly or in CI

## Package.json Patterns

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "test:ci": "vitest run --coverage",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write ."
  },
  "engines": {
    "node": ">=20"
  }
}
```

## Updating Dependencies

1. Check what's outdated: `npm outdated`
2. Read changelogs for major updates
3. Update one major version at a time
4. Run tests after each update
5. Commit lockfile changes

## Monorepo (npm workspaces)

```json
{
  "workspaces": ["packages/*", "apps/*"]
}
```

Commands:
```bash
npm install -w packages/shared    # install in specific workspace
npm run build -w packages/shared  # run script in specific workspace
npm run build --workspaces        # run in all workspaces
```

## Common Issues

- **Phantom dependencies**: code imports something not in your package.json (works because a transitive dep installed it)
- **Version conflicts**: two packages need incompatible versions of the same dep
- **Lockfile conflicts**: merge conflicts in package-lock.json — delete and regenerate with `npm install`
