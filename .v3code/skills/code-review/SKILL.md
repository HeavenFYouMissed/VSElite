---
name: code-review
description: Code review checklist for quality assurance
keywords:
  - review
  - check
  - audit
  - quality
  - best practice
  - clean code
alwaysApply: false
---

# Code Review Skill

## Pre-Review Checklist

Before approving any change (your own or the user's), verify:

### Correctness
- [ ] Does the code do what the user asked for?
- [ ] Are edge cases handled (empty arrays, null values, boundary conditions)?
- [ ] Are error paths handled gracefully?

### Style
- [ ] Consistent with the existing codebase patterns
- [ ] No unnecessary abstractions or over-engineering
- [ ] Variable names are descriptive and consistent
- [ ] No dead code, commented-out blocks, or TODO comments left behind

### Performance
- [ ] No unnecessary re-renders (React) or re-computations
- [ ] No N+1 queries or O(n²) loops on potentially large data
- [ ] Resources are cleaned up (event listeners, timers, subscriptions)

### Security
- [ ] No hardcoded secrets, tokens, or passwords
- [ ] User input is validated/sanitized
- [ ] File paths are not user-controllable without validation

### Scope
- [ ] Changes are minimal and focused on the task
- [ ] No unrelated refactoring mixed in
- [ ] Imports are used (no dangling imports)

## When Reviewing User Code
- Point out genuine issues, not style preferences
- Suggest improvements, don't demand them
- Explain WHY something is problematic, not just WHAT
