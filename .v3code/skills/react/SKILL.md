---
name: react
description: React component patterns and hooks best practices
globs:
  - "*.tsx"
  - "*.jsx"
keywords:
  - react
  - component
  - hook
  - useState
  - useEffect
  - useMemo
  - useCallback
  - useRef
  - context
  - provider
  - render
  - JSX
alwaysApply: false
---

# React Skill

## Component Patterns

### Functional Components Only
- Never write class components
- Use hooks for all state and side effects
- Keep components small (< 100 lines ideally)

### Props Pattern
```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ label, onClick, variant = 'primary', disabled }: ButtonProps) {
  return <button className={variant} onClick={onClick} disabled={disabled}>{label}</button>;
}
```

## Hooks Rules

1. Only call hooks at the top level (never in conditions/loops)
2. Only call hooks from React functions (components or custom hooks)
3. Custom hooks MUST start with `use`

## Performance

### When to memoize
- `useMemo` — expensive computations, object/array identity stability
- `useCallback` — functions passed as props to memoized children
- `React.memo` — components that re-render often with same props

### When NOT to memoize
- Simple computations (adding strings, basic math)
- Components that always get different props
- Values only used in the same component

## useEffect Patterns

```typescript
// Mount + cleanup
useEffect(() => {
  const sub = subscribe();
  return () => sub.unsubscribe(); // cleanup
}, []);

// Dependency tracking
useEffect(() => {
  fetchData(id);
}, [id]); // only re-runs when id changes
```

## Anti-Patterns

- Prop drilling past 3 levels (use context or state management)
- useEffect for derived state (just compute it during render)
- Setting state in useEffect that causes infinite loops
- Storing JSX in state (store data, derive JSX)
- Using index as key for dynamic lists
