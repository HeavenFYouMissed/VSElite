---
name: v3code-rules-authoring
description: Creating workspace rules and agent guidance files for V3Code
keywords:
  - rule
  - rules
  - .v3coderules
  - mdc
  - workspace rule
  - agent rule
  - guidance
  - always apply
alwaysApply: false
---

# V3Code Rules Authoring Skill

## What Are Workspace Rules?

Rules are instructions that get injected into the agent's prompt based on context. They tell the agent how to behave for specific files, patterns, or always.

## Rule Locations

| Location | Scope |
|----------|-------|
| `.v3coderules` | Root-level, always applies (like .cursorrules) |
| `.v3code/rules/*.mdc` | Individual rules with glob matching |
| `AGENTS.md` | Project-wide agent instructions |

## Rule File Format (.mdc)

```markdown
---
description: Brief description of what this rule covers
globs: ["*.tsx", "src/components/**"]
alwaysApply: false
---

# Rule Title

Your instructions here. These will be injected into the agent's prompt
when the user is working on files that match the globs above.

- Be specific and actionable
- Use imperative voice ("Do X", "Never Y")
- Include examples when helpful
```

## Frontmatter Fields

| Field | Type | Purpose |
|-------|------|---------|
| `description` | string | Human-readable summary |
| `globs` | string[] | File patterns that trigger this rule |
| `alwaysApply` | boolean | If true, always injected regardless of active file |

## Glob Pattern Examples

```yaml
globs: ["*.ts", "*.tsx"]           # All TypeScript files
globs: ["src/api/**"]              # Anything under src/api/
globs: ["*.test.ts", "*.spec.ts"]  # Test files only
globs: ["Dockerfile", "*.yml"]     # Docker and CI configs
globs: ["**/*.css", "**/*.scss"]   # All style files
```

## Best Practices

1. **One concern per rule** — don't put everything in one file
2. **Use globs to scope** — don't load database rules when editing CSS
3. **Keep rules concise** — max 4000 chars per rule (system enforced)
4. **Be specific** — "Use Tailwind utility classes" not "Style things properly"
5. **Include examples** — show correct patterns, not just prohibitions
6. **Test incrementally** — add one rule, verify it loads, then add more

## Example Rules

### API conventions
```markdown
---
globs: ["src/api/**", "**/routes/**"]
---
- All endpoints return { data, error, meta } envelope
- Use Zod for request validation
- Log all 5xx errors with request context
```

### Component patterns
```markdown
---
globs: ["src/components/**/*.tsx"]
---
- Use the `cn()` utility for conditional classes
- Props interfaces are always exported
- Components are default-exported
```

### Security (always apply)
```markdown
---
alwaysApply: true
---
- Never hardcode secrets in source code
- Never commit .env files
- Always validate user input before using in queries
```
