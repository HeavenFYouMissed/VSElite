---
name: performance
description: Performance optimization and profiling guidance
keywords:
  - performance
  - slow
  - optimize
  - fast
  - speed
  - memory
  - leak
  - profile
  - benchmark
  - bottleneck
  - lag
alwaysApply: false
---

# Performance Skill

## Optimization Protocol

1. **Measure first** — never optimize without data
2. **Identify the bottleneck** — optimize the slowest part, not everything
3. **One change at a time** — measure impact of each change
4. **Don't sacrifice readability** for marginal gains

## Common Performance Issues

### Frontend / React
- Unnecessary re-renders (missing memo/useMemo/useCallback)
- Large bundle size (lazy load, code split)
- Layout thrashing (batch DOM reads/writes)
- Unoptimized images (wrong format, no sizing)
- Memory leaks (uncleared intervals, event listeners, subscriptions)

### Backend / Node.js
- Synchronous file I/O in request handlers
- N+1 database queries
- Missing database indexes
- Unbound queries (no LIMIT)
- Large payloads without pagination
- Not using streams for large data

### General
- O(n²) or worse algorithms on large data
- Repeated computation (cache the result)
- Creating objects in hot loops (pre-allocate)
- String concatenation in loops (use array.join)

## Quick Wins

| Problem | Solution |
|---------|----------|
| Re-renders | React.memo + useMemo for expensive computations |
| Large lists | Virtual scrolling (react-window) |
| Slow startup | Lazy loading, code splitting |
| Memory leaks | Cleanup in useEffect return / dispose() |
| Repeated API calls | Debounce + cache |
| Large file reads | Streaming + pagination |

## Tools

- Browser: DevTools Performance tab, Lighthouse
- Node: --inspect + Chrome DevTools, clinic.js
- General: console.time/timeEnd for quick measurements
