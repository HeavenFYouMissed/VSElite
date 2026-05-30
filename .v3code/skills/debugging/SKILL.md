---
name: debugging
description: Systematic debugging approach for production issues
keywords:
  - debug
  - fix bug
  - error
  - crash
  - failing
  - broken
  - not working
  - undefined
  - null
  - exception
alwaysApply: false
---

# Debugging Skill

## Systematic Debugging Protocol

### Step 1: Reproduce
- Read the error message carefully — EVERY word matters
- Identify the exact file and line number
- Determine if the error is compile-time, runtime, or logical

### Step 2: Isolate
- Use `read_file` to examine the failing code
- Check the call stack / imports / dependencies
- Use `find_text` to search for related usages

### Step 3: Hypothesize
- Form exactly ONE hypothesis about the root cause
- State it explicitly before attempting a fix

### Step 4: Fix & Verify
- Make the smallest possible change to test your hypothesis
- Run `read_lint_errors` after the fix
- If the fix didn't work, REVERT and try a different hypothesis

### Step 5: Circuit Breaker
- After 3 failed attempts, STOP
- Revert all changes with `git checkout -- <file>`
- Report what you tried and why it failed
- Ask the user for more context

## Common Patterns

### Import errors
- Check file paths (relative vs absolute)
- Check file extensions (.js vs .ts)
- Check if the export actually exists in the source file

### Type errors
- Read the full error — TS errors tell you exactly what's wrong
- Check if you're passing the right number/type of arguments
- Check if an interface changed upstream

### Runtime undefined/null
- Trace the variable backwards from the error point
- Check optional chaining and null guards
- Verify async operations completed before access
