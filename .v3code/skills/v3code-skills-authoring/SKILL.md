---
name: v3code-skills-authoring
description: Creating custom skills for V3Code's auto-discovery system
keywords:
  - skill
  - SKILL.md
  - create skill
  - custom skill
  - frontmatter
  - trigger
alwaysApply: false
---

# V3Code Skills Authoring Skill

## What Are Skills?

Skills are reusable knowledge packages that get auto-loaded into the agent's context when relevant. They're triggered by:
- **Keywords** in the user's message
- **File globs** matching the active file
- **alwaysApply** flag for universal skills

## Skill Locations

| Location | Scope |
|----------|-------|
| `.v3code/skills/<name>/SKILL.md` | Workspace-level (project-specific) |
| `~/.v3code/skills/<name>/SKILL.md` | User-level (available in all projects) |

Workspace skills override user-level skills with the same name.

## Skill File Format

```markdown
---
name: my-skill
description: One-line description of what this skill provides
globs:
  - "*.tsx"
  - "src/components/**"
keywords:
  - react
  - component
  - hook
alwaysApply: false
---

# Skill Title

Your knowledge content here. This gets injected into the agent's prompt
when triggered.

## Section 1
...

## Section 2
...
```

## Frontmatter Fields

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `name` | string | No (defaults to folder name) | Unique skill identifier |
| `description` | string | Yes | Shown in skill listings |
| `globs` | string[] | No | File patterns that activate the skill |
| `keywords` | string[] | No | Words in user message that trigger loading |
| `alwaysApply` | boolean | No | If true, always loaded |

## Trigger Design

### Keywords
Choose words the user would naturally say:
```yaml
# Good — specific, natural language
keywords: ["deploy", "CI", "pipeline", "GitHub Actions"]

# Bad — too generic, would trigger on everything
keywords: ["code", "help", "make"]
```

### Globs
Match files where the skill is relevant:
```yaml
# Good — specific to the concern
globs: ["Dockerfile", "docker-compose.*", ".dockerignore"]

# Bad — too broad
globs: ["*"]
```

## Writing Effective Skill Content

1. **Lead with actionable guidance** — what to DO, not background info
2. **Include code examples** — concrete patterns the agent can follow
3. **Keep it under 4000 chars** — system truncates beyond this
4. **Structure with headers** — easy to scan
5. **Common mistakes section** — prevent known failure modes
6. **No redundancy** — don't repeat what other skills cover

## Testing Your Skill

1. Create the SKILL.md in the appropriate directory
2. Open a file matching your globs (or type a keyword)
3. Ask the agent something related — it should respond with skill-informed guidance
4. Check that irrelevant conversations DON'T trigger it

## Skill Priority Order

1. `alwaysApply: true` skills load first
2. Glob-matching skills load next (active file match)
3. Keyword-matching skills load last (user message match)
4. Total skills content capped at 16KB per turn
