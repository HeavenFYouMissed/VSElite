---
name: migration-upgrade
description: Dependency upgrades, framework migrations, and breaking changes
keywords:
  - migrate
  - upgrade
  - breaking change
  - deprecation
  - version
  - compatibility
  - legacy
  - modernize
alwaysApply: false
---

# Migration & Upgrade Skill

## Upgrade Protocol

1. **Read the changelog** — especially BREAKING CHANGES section
2. **Check compatibility** — verify all deps work with new version
3. **Branch** — always upgrade on a feature branch
4. **Incremental** — upgrade one major version at a time (don't skip)
5. **Test** — run full test suite after each step
6. **Document** — note what changed for team awareness

## Safe Migration Steps

```bash
# 1. Create branch
git checkout -b chore/upgrade-next-15

# 2. Check current state
npm outdated

# 3. Upgrade package
npm install next@15

# 4. Fix breaking changes (read migration guide)
# ... code changes ...

# 5. Type check
npx tsc --noEmit

# 6. Test
npm test

# 7. Manual verification
npm run dev  # check UI works
```

## Common Migration Patterns

### Rename / Move Imports
```typescript
// Before (deprecated)
import { thing } from 'old/path';

// After
import { thing } from 'new/path';
```

Use find_text to locate all occurrences, then update systematically.

### API Shape Changes
```typescript
// Before
const result = await api.get(url, { timeout: 5000 });

// After (new options shape)
const result = await api.get(url, { signal: AbortSignal.timeout(5000) });
```

### Gradual Migration (Adapter Pattern)
```typescript
// Wrap old API in new interface during migration
function adaptOldApi(oldClient: OldClient): NewInterface {
  return {
    fetch: (url) => oldClient.get(url).then(r => r.data),
    // ... map all methods
  };
}
```

## Deprecation Handling

1. Find all usages of deprecated API
2. Understand what replaces it
3. Update all usages in one pass
4. Verify no remaining usages: `find_text("deprecatedMethod")`
5. Run tests

## Rollback Plan

- Keep the pre-upgrade branch reference
- If upgrade breaks production: `git revert <merge-commit>`
- For database migrations: ensure down/rollback scripts exist
- Feature flag new behavior if unsure about stability

## When NOT to Upgrade

- Pinned for stability in production with no issues
- Upgrade introduces major rework with no clear benefit
- Near a deadline (defer to next sprint)
- The new version has known regressions (check GitHub issues)
