---
name: git-workflow
description: Git operations, commit messages, and branch management
keywords:
  - git
  - commit
  - push
  - branch
  - merge
  - rebase
  - stash
  - diff
  - pull request
  - PR
alwaysApply: false
---

# Git Workflow Skill

## Commit Messages

Format: `<type>: <short description>`

Types:
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code restructure (no behavior change)
- `style` — formatting, whitespace
- `docs` — documentation only
- `test` — adding/fixing tests
- `chore` — build, deps, config

Rules:
- Keep subject line under 72 characters
- Use imperative mood ("add X" not "added X")
- Don't end with a period
- Body (optional) explains WHY, not WHAT

## Safety Rules

- NEVER force push to main/master
- NEVER commit secrets (.env, keys, tokens)
- NEVER amend commits that have been pushed
- ALWAYS check `git status` before committing
- ALWAYS review `git diff` before staging

## Branch Strategy

- `main` / `master` — production-ready code
- `feature/<name>` — new features
- `fix/<name>` — bug fixes
- `chore/<name>` — maintenance

## Common Operations

### Stage and commit
```bash
git add <specific files>
git commit -m "type: description"
```

### Create feature branch
```bash
git checkout -b feature/my-feature
```

### Check what changed
```bash
git status
git diff
git log --oneline -10
```

## When Asked to Commit
1. Run `git status` to see what's changed
2. Run `git diff` to review changes
3. Only stage files related to the current task
4. Write a clear, concise commit message
5. Never commit generated files, node_modules, or secrets
