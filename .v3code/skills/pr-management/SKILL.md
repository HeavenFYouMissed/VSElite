---
name: pr-management
description: Pull request workflow, review, conflict resolution, and CI fixes
keywords:
  - PR
  - pull request
  - review
  - merge
  - conflict
  - CI
  - checks
  - approve
  - request changes
alwaysApply: false
---

# PR Management Skill

## PR Lifecycle

1. **Create** — small, focused, well-described
2. **Review** — address feedback promptly
3. **Update** — rebase/merge, fix CI
4. **Merge** — squash or merge commit

## Writing Good PR Descriptions

```markdown
## Summary
- What this PR does (1-3 bullets)

## Changes
- List of specific changes made

## Test Plan
- How to verify this works
- [ ] Manual test steps
- [ ] Automated tests pass

## Screenshots (if UI change)
Before | After
```

## Keeping PRs Small

- **One concern per PR** — don't mix refactoring with features
- **Max 400 lines** — anything larger is hard to review
- **Stack PRs** — if a feature is large, break into dependent PRs
- **Ship infrastructure first** — types/interfaces → implementation → integration

## Resolving Merge Conflicts

```bash
# Fetch latest and rebase
git fetch origin
git rebase origin/main

# If conflicts:
# 1. Fix each conflict file
# 2. git add <fixed files>
# 3. git rebase --continue
# 4. Repeat until clean

# If rebase is messy, merge instead:
git merge origin/main
```

## CI Fix Loop

When CI fails on a PR:
1. Read the failing check output carefully
2. Identify if it's a test failure, lint error, type error, or build error
3. Fix locally
4. Push the fix
5. Verify CI passes

Common CI failures:
- **Lint**: run `npm run lint -- --fix` locally first
- **Types**: `npx tsc --noEmit` before pushing
- **Tests**: run the failing test in isolation to debug
- **Build**: ensure all imports resolve and deps are declared

## Review Etiquette

When reviewing:
- Approve if changes are good, even with nits
- Use "suggestion" blocks for concrete improvements
- Distinguish blocking issues from nice-to-haves
- Don't bike-shed on style (that's what linters are for)
