---
name: split-to-prs
description: Breaking large changes into small, reviewable pull requests
keywords:
  - split
  - break up
  - small PR
  - stacked
  - reviewable
  - chunk
  - incremental
alwaysApply: false
---

# Split to PRs Skill

## When to Split

- Change touches more than 5 files across different concerns
- PR exceeds ~400 lines of meaningful changes
- Mix of refactoring + feature work
- Changes have natural dependency layers

## Splitting Strategy

### By Layer (Bottom-Up)
1. **PR 1: Types/Interfaces** — shared types, API contracts
2. **PR 2: Infrastructure** — services, utilities, helpers
3. **PR 3: Implementation** — core logic using the above
4. **PR 4: Integration** — wiring it all together, UI

### By Feature Slice (Vertical)
1. **PR 1: Minimal end-to-end** — simplest working version
2. **PR 2: Enhancement A** — add first secondary feature
3. **PR 3: Enhancement B** — add second secondary feature

### Refactor + Feature
1. **PR 1: Pure refactor** — no behavior change, just restructure
2. **PR 2: Feature** — build on the clean foundation

## Execution Steps

1. Identify logical boundaries in your changes
2. Create branches for each PR (stack off each other or off main)
3. Cherry-pick or move commits to appropriate branches
4. Each PR should compile and pass tests independently
5. Link PRs in descriptions ("Depends on #123")

## Git Commands for Splitting

```bash
# Create stacked branches
git checkout -b feature/types
# ... make type changes, commit, push ...

git checkout -b feature/service feature/types
# ... make service changes, commit, push ...

git checkout -b feature/ui feature/service
# ... make UI changes, commit, push ...
```

## Rules

- Each PR must be independently reviewable
- Each PR must pass CI on its own
- Don't create circular dependencies between PRs
- Base each stacked PR on its dependency (not main)
- Merge bottom-up: types → service → UI
