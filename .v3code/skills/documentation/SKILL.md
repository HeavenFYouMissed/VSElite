---
name: documentation
description: Writing clear documentation and code comments
keywords:
  - document
  - readme
  - comment
  - jsdoc
  - explain
  - API docs
  - changelog
alwaysApply: false
---

# Documentation Skill

## When to Document

- Public APIs (functions, classes, interfaces exported for others)
- Complex algorithms where intent isn't obvious from the code
- Configuration files and environment variables
- Setup/installation steps
- Architecture decisions (ADRs)

## When NOT to Document

- Obvious code (never comment `// increment counter` above `counter++`)
- Implementation details that change frequently
- Narrating what the code does line-by-line

## Comment Style

### Good Comments
```typescript
// Retry up to 3 times with exponential backoff because the
// upstream API has intermittent 503s during deploys
async function fetchWithRetry(url: string) { ... }

// Trade-off: using a Map here instead of an object because
// we need O(1) deletion by key during cleanup sweeps
const sessions = new Map<string, Session>();
```

### Bad Comments
```typescript
// Get the user
const user = getUser();

// Check if user exists
if (user) { ... }

// Return the result
return result;
```

## README Structure

1. **What** — one sentence describing the project
2. **Quick Start** — get running in <5 steps
3. **Configuration** — env vars, settings files
4. **Development** — how to build, test, contribute
5. **Architecture** — high-level overview (optional, for complex projects)

## JSDoc / TSDoc

```typescript
/**
 * Resolves workspace rules matching the active file context.
 * 
 * @param activeFilePath - The currently focused file, or undefined if none
 * @param openFilePaths - All open editor file paths
 * @returns Formatted rules string for prompt injection, or empty string
 */
```
