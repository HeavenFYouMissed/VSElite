---
name: refactoring
description: Safe refactoring patterns and techniques
keywords:
  - refactor
  - rename
  - extract
  - move
  - restructure
  - clean up
  - simplify
  - reorganize
alwaysApply: false
---

# Refactoring Skill

## Golden Rules

1. **Never refactor and add features simultaneously** — do one or the other
2. **Preserve behavior** — refactoring must not change what the code does
3. **Small steps** — each edit should be independently verifiable
4. **Re-read after each edit** — line numbers shift, content changes

## Safe Refactoring Sequence

1. Read the target file completely
2. Identify the scope of the refactor
3. Make ONE change at a time
4. Re-read the file after each change (edit_file shifts lines!)
5. Verify no lint errors after each step
6. Run tests if available

## Common Refactoring Patterns

### Extract Function
- When: block of code does one clear thing, appears 2+ times
- Move the block to a named function, pass minimal params
- Replace original blocks with function calls

### Rename Symbol
- Use `find_text` to find ALL occurrences first
- Rename in definition AND all usages
- Check imports/exports

### Move to New File
- Create the new file with the extracted code
- Update imports in all files that referenced the old location
- Remove from the old file
- Check for circular dependencies

### Inline / Remove Abstraction
- When: a function/class adds indirection without value
- Replace calls with the inline body
- Remove the now-unused function

## Anti-Patterns to Avoid
- Renaming variables just for style preference (unless asked)
- Reformatting code that isn't related to your task
- Splitting files that are a reasonable size (< 300 lines)
- Creating abstractions "for the future"
