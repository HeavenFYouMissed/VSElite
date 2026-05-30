---
name: terminal-commands
description: Shell commands, CLI tools, and terminal productivity
keywords:
  - terminal
  - command
  - shell
  - bash
  - powershell
  - CLI
  - script
  - run
  - execute
alwaysApply: false
---

# Terminal Commands Skill

## Safe Command Execution Rules

1. **Never run destructive commands without confirmation** (rm -rf, DROP TABLE, force push)
2. **Always use full paths** when deleting or moving files
3. **Check working directory** before running relative commands
4. **Use --dry-run** when available (git clean -n, rsync --dry-run)
5. **Quote paths with spaces**: `cd "My Documents"` not `cd My Documents`

## Essential Commands

### File operations
```bash
ls -la                    # list with details
find . -name "*.ts"       # find files by pattern
grep -r "pattern" .       # search in files
wc -l file.txt            # count lines
du -sh .                  # directory size
```

### Process management
```bash
ps aux | grep node        # find processes
kill -15 <pid>            # graceful stop
kill -9 <pid>             # force kill (last resort)
lsof -i :3000            # what's using port 3000
```

### Network
```bash
curl -s https://api.example.com | jq '.'     # HTTP GET + format JSON
curl -X POST -H "Content-Type: application/json" -d '{"key":"val"}' url
netstat -tlnp             # listening ports
```

## PowerShell Equivalents

| Unix | PowerShell |
|------|-----------|
| `ls` | `Get-ChildItem` / `ls` |
| `grep` | `Select-String` / `sls` |
| `find` | `Get-ChildItem -Recurse -Filter` |
| `cat` | `Get-Content` / `gc` |
| `rm -rf` | `Remove-Item -Recurse -Force` |
| `mkdir -p` | `New-Item -ItemType Directory -Force` |
| `which` | `Get-Command` |
| `env` | `Get-ChildItem env:` |

## Chaining Commands

```bash
# AND: run second only if first succeeds
npm run build && npm run deploy

# OR: run second only if first fails
npm run build || echo "Build failed!"

# Pipe: output of first → input of second
cat file.json | jq '.name'

# Redirect: output to file
npm test > test-output.log 2>&1
```

## When Running Commands for the User

- Tell them what the command does before running it
- Use the least-destructive version first (ls before rm)
- Check exit codes — 0 means success, anything else is failure
- If a command might take long, warn the user
- For interactive commands (vim, less), use non-interactive alternatives
