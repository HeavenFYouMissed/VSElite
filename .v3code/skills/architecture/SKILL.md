---
name: architecture
description: Software architecture patterns and system design
keywords:
  - architecture
  - design
  - pattern
  - structure
  - scalable
  - modular
  - microservice
  - monolith
  - API design
  - system design
  - DDD
alwaysApply: false
---

# Architecture Skill

## Design Principles

1. **Separation of Concerns** — each module does one thing well
2. **Dependency Inversion** — depend on abstractions, not implementations
3. **YAGNI** — don't build what you don't need yet
4. **KISS** — the simplest solution that works is usually the best
5. **DRY** — but only when the duplication is actual duplication, not coincidental

## When to Apply Architecture Thinking

- Creating a new service/module from scratch
- Restructuring existing code that has grown unwieldy
- Adding a feature that crosses multiple boundaries
- When the user explicitly asks about design/structure

## Common Patterns

### Service Layer
- Controllers handle HTTP (request/response)
- Services contain business logic
- Repositories handle data access
- Models define data shapes

### Event-Driven
- Producers emit events (don't know about consumers)
- Consumers react to events (decoupled)
- Good for: notifications, audit logs, side effects

### Plugin/Extension Architecture
- Core provides interfaces and extension points
- Plugins implement interfaces
- Registration via decorators or manifest files

## File Organization

```
src/
  features/         # grouped by domain
    auth/
      auth.service.ts
      auth.controller.ts
      auth.types.ts
    users/
      ...
  shared/           # cross-cutting concerns
    utils/
    middleware/
    types/
  infrastructure/   # external service adapters
    database/
    cache/
    messaging/
```

## Anti-Patterns

- God objects (one class that does everything)
- Circular dependencies
- Premature abstraction (abstracting before you have 2+ implementations)
- Deep inheritance hierarchies (prefer composition)
- Shared mutable state across modules
