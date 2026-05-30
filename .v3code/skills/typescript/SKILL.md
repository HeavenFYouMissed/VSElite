---
name: typescript
description: TypeScript-specific patterns, types, and best practices
globs:
  - "*.ts"
  - "*.tsx"
keywords:
  - typescript
  - type
  - interface
  - generic
  - enum
  - union
  - intersection
  - type guard
  - utility type
alwaysApply: false
---

# TypeScript Skill

## Type Design Principles

1. **Prefer interfaces for objects** — they merge, extend, and have better error messages
2. **Use type aliases for unions, intersections, and computed types**
3. **Never use `any`** — use `unknown` if you truly don't know the type, then narrow
4. **Prefer discriminated unions over optional fields** for state machines

## Common Patterns

### Discriminated Unions (state machines)
```typescript
type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Data }
  | { status: 'error'; error: Error }
```

### Type Guards
```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}
```

### Utility Types
- `Partial<T>` — all fields optional
- `Required<T>` — all fields required
- `Pick<T, K>` — subset of fields
- `Omit<T, K>` — remove specific fields
- `Record<K, V>` — object with known key/value types
- `ReturnType<F>` — extract function return type
- `Parameters<F>` — extract function parameter tuple

### Const Assertions
```typescript
const ROUTES = ['home', 'about', 'contact'] as const;
type Route = typeof ROUTES[number]; // 'home' | 'about' | 'contact'
```

### Generic Constraints
```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

## Common Mistakes

- Using `object` type (too broad) — use `Record<string, unknown>` or a specific interface
- Using `Function` type — use specific signature `(arg: Type) => ReturnType`
- Forgetting `readonly` on arrays/objects that shouldn't mutate
- Over-using `as` type assertions — prefer type narrowing
- Exporting types that are only used internally
