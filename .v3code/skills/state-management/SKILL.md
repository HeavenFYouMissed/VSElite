---
name: state-management
description: Application state management patterns
keywords:
  - state
  - store
  - redux
  - zustand
  - context
  - global state
  - local state
  - derived state
  - subscription
alwaysApply: false
---

# State Management Skill

## Decision Framework

### Use Local State (useState) when:
- State is used by only one component
- State doesn't need to persist across navigations
- State is simple (boolean, string, number)

### Use Context when:
- State needs to be accessed by a subtree of components
- State changes infrequently (theme, auth, locale)
- You want to avoid prop drilling 2-3 levels

### Use External Store (Zustand/Redux) when:
- State is shared across many unrelated components
- State updates are frequent and complex
- You need middleware (logging, persistence, devtools)
- State logic is testable independent of UI

## Zustand Pattern (Recommended)

```typescript
import { create } from 'zustand';

interface TodoStore {
  todos: Todo[];
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
}

const useTodoStore = create<TodoStore>((set) => ({
  todos: [],
  addTodo: (text) => set((state) => ({
    todos: [...state.todos, { id: crypto.randomUUID(), text, done: false }]
  })),
  toggleTodo: (id) => set((state) => ({
    todos: state.todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
  })),
  removeTodo: (id) => set((state) => ({
    todos: state.todos.filter(t => t.id !== id)
  })),
}));
```

## State Design Rules

1. **Derive, don't store** — if you can compute it from other state, don't store it
2. **Normalize nested data** — flat structures update more efficiently
3. **Single source of truth** — each piece of data lives in exactly one place
4. **Immutable updates** — never mutate state directly

## Anti-Patterns

- Storing derived state (filteredList when you have list + filter)
- Putting everything in global state (most state is local)
- Deeply nested state (hard to update immutably)
- Syncing state between stores (creates race conditions)
- Using useEffect to "sync" state (compute during render instead)

## Server State

For data from APIs, use a specialized library:
- **TanStack Query** (React Query) — caching, refetching, pagination
- **SWR** — simpler, similar concept
- Don't put API responses in Redux/Zustand — that's what these libs solve
