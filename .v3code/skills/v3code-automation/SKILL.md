---
name: v3code-automation
description: Recurring prompts, automated loops, and event-driven agent tasks in V3Code
keywords:
  - loop
  - automate
  - recurring
  - schedule
  - watch
  - on save
  - on commit
  - hook
  - trigger
  - cron
  - interval
alwaysApply: false
---

# V3Code Automation Skill

## Concept: Agent Loops

A loop is a prompt or task that executes automatically on a schedule or trigger. This enables:
- Continuous code quality monitoring
- Auto-fixing lint errors on save
- Running tests after every edit
- Periodic codebase health checks
- Watching for TODOs and flagging them

## Loop Patterns

### Time-Based Loop
Execute a prompt every N minutes:
```
/loop 5m "Check for lint errors in recently modified files and fix them"
/loop 30m "Scan for TODO comments added today and summarize them"
/loop 1h "Run the test suite and report any new failures"
```

### Event-Based Hooks
Execute on specific triggers:
```yaml
# .v3code/hooks.json
{
  "hooks": [
    {
      "event": "file.save",
      "glob": "*.ts",
      "prompt": "Run lint check on the saved file. Fix any auto-fixable issues."
    },
    {
      "event": "git.pre-commit",
      "prompt": "Review staged changes. Flag any secrets, console.logs, or TODO comments."
    },
    {
      "event": "terminal.error",
      "prompt": "Analyze the terminal error and suggest a fix."
    },
    {
      "event": "build.fail",
      "prompt": "Read the build error, identify the root cause, and fix it."
    }
  ]
}
```

## Available Events

| Event | Fires When |
|-------|-----------|
| `file.save` | Any file is saved |
| `file.create` | New file is created |
| `file.delete` | File is deleted |
| `git.pre-commit` | Before a git commit |
| `git.post-commit` | After a git commit |
| `git.branch-switch` | Branch changes |
| `terminal.error` | Terminal command exits non-zero |
| `terminal.complete` | Long-running command finishes |
| `build.fail` | Build process fails |
| `build.success` | Build completes successfully |
| `test.fail` | Test suite has failures |
| `agent.idle` | Agent hasn't been used for N minutes |

## Best Practices

1. **Keep loop prompts focused** — one task per loop
2. **Set reasonable intervals** — don't loop every second
3. **Idempotent actions** — loops should be safe to repeat
4. **Exit conditions** — loops should know when to stop
5. **Resource-aware** — don't run expensive operations too frequently
6. **User notification** — always inform the user what the loop found/fixed

## Example: Auto-Fix Loop

```
/loop 2m "Check if there are any TypeScript errors in the workspace. If yes, fix the simplest one. If no errors, skip."
```

This creates a background agent that:
1. Runs `tsc --noEmit` every 2 minutes
2. If errors exist, fixes the easiest one
3. Reports what it fixed
4. Goes back to sleep

## Example: PR Watch Loop

```
/loop 10m "Check the CI status of my open PRs. If any are failing, diagnose the failure and suggest a fix."
```
