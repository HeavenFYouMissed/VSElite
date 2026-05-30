---
name: async-patterns
description: Async/await, concurrency, and parallel execution patterns
keywords:
  - async
  - await
  - promise
  - concurrent
  - parallel
  - race
  - queue
  - throttle
  - debounce
  - stream
  - worker
alwaysApply: false
---

# Async Patterns Skill

## Promise Fundamentals

### Parallel execution (independent tasks)
```typescript
const [users, posts, comments] = await Promise.all([
  fetchUsers(),
  fetchPosts(),
  fetchComments(),
]);
```

### Parallel with error tolerance
```typescript
const results = await Promise.allSettled([
  fetchUsers(),
  fetchPosts(),
  fetchComments(),
]);

const successes = results.filter(r => r.status === 'fulfilled').map(r => r.value);
const failures = results.filter(r => r.status === 'rejected').map(r => r.reason);
```

### Race (first to resolve wins)
```typescript
const result = await Promise.race([
  fetchData(),
  timeout(5000), // rejects after 5s
]);
```

## Concurrency Control

### Limit parallel operations
```typescript
async function pMap<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency = 5): Promise<R[]> {
  const results: R[] = [];
  const executing = new Set<Promise<void>>();
  
  for (const item of items) {
    const p = fn(item).then(result => { results.push(result); });
    executing.add(p);
    p.finally(() => executing.delete(p));
    
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
  return results;
}
```

### Debounce (wait for silence)
```typescript
function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
```

### Throttle (max once per interval)
```typescript
function throttle<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}
```

## Cancellation

```typescript
const controller = new AbortController();

fetch(url, { signal: controller.signal })
  .then(res => res.json())
  .catch(err => {
    if (err.name === 'AbortError') return; // expected
    throw err;
  });

// Later:
controller.abort();
```

## Anti-Patterns

- `await` in a loop when operations are independent (use Promise.all)
- Forgetting error handling on fire-and-forget promises
- Creating promises that never resolve (memory leak)
- Mixing callbacks and promises (pick one)
- Not cleaning up timers/subscriptions on component unmount
