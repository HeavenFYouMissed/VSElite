---
name: project-scaffolding
description: Creating new projects and boilerplate setup
keywords:
  - create
  - scaffold
  - boilerplate
  - starter
  - template
  - new project
  - init
  - setup
alwaysApply: false
---

# Project Scaffolding Skill

## Before Creating a New Project

1. Ask what the project does (one sentence)
2. Ask about target platform (web, mobile, CLI, library)
3. Ask about required features (auth, database, real-time, etc.)
4. Choose the simplest stack that meets requirements

## Recommended Stacks

### Full-Stack Web App
- **Next.js** — React, SSR, API routes, deployment-ready
- **SvelteKit** — Svelte, fast, excellent DX
- **Remix** — React, progressive enhancement

### API Only
- **Fastify** — Fast, schema validation built-in
- **Hono** — Ultra-light, works everywhere (CF Workers, Deno, Node)
- **Express** — Most ecosystem support, easy to find help

### CLI Tool
- **Commander.js** + **Inquirer** — prompts, flags, subcommands
- **Yargs** — complex CLI argument parsing

## Essential Files

Every project needs:
```
README.md           # What it does, how to run it
.gitignore          # node_modules, .env, dist, etc.
.env.example        # Document required env vars
package.json        # Dependencies + scripts
tsconfig.json       # TypeScript config (if TS)
```

## .gitignore Template

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
.turbo/
```

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "...",
    "build": "...",
    "start": "...",
    "test": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write ."
  }
}
```

## UI Defaults

When building a web UI from scratch:
- Use a neutral color palette (greys, near-blacks)
- System font stack for body, monospace for code
- Responsive from the start (mobile-first)
- Accessible by default (semantic HTML, proper contrast)
- Loading states for async operations
- Error states for all data fetching
