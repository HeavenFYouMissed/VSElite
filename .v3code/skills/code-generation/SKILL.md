---
name: code-generation
description: AI-assisted code generation patterns and principles
keywords:
  - generate
  - create
  - implement
  - write
  - build
  - scaffold
  - boilerplate
alwaysApply: false
---

# Code Generation Skill

## Generation Principles

1. **Match existing patterns** — look at the codebase first, follow its style
2. **Generate minimal viable code** — don't over-engineer on first pass
3. **Type everything** — never generate `any` types
4. **Include error handling** — happy path alone isn't production code
5. **No placeholder code** — never generate `// TODO: implement this`

## Before Generating

1. Check if similar code already exists (use `find_text` / `semantic_search`)
2. Understand the existing patterns (naming, file structure, imports)
3. Check what dependencies are available (don't add new ones without asking)
4. Verify the target directory structure exists

## Code Quality Standards

### Functions
- Single responsibility (does one thing)
- Clear name describing what it does (verb + noun)
- Type-safe parameters and return type
- Handle edge cases (null, empty, invalid input)

### Components (React)
- Props interface defined and exported
- Reasonable defaults for optional props
- Accessible (proper HTML elements, ARIA when needed)
- Handle loading/error/empty states

### Services
- Interface defined separately from implementation
- Dependency injection via constructor
- Error handling with typed errors
- Disposable pattern (cleanup resources)

## Template: New Service

```typescript
export interface IMyService {
  doThing(input: Input): Promise<Output>;
}

export class MyService implements IMyService {
  constructor(
    private readonly dependency: IDependency,
  ) {}

  async doThing(input: Input): Promise<Output> {
    // validate
    if (!input.required) throw new ValidationError('required field missing');
    
    // execute
    const result = await this.dependency.call(input);
    
    // transform and return
    return this.mapToOutput(result);
  }

  private mapToOutput(raw: RawData): Output {
    return { /* ... */ };
  }
}
```

## Anti-Patterns in Generation

- Generating commented-out alternative implementations
- Adding "helpful" console.logs
- Over-abstracting on first pass (don't create factory-of-factory patterns)
- Generating test files without running them
- Adding dependencies not already in the project without asking
