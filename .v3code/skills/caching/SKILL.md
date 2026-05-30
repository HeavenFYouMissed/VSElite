---
name: caching
description: Caching strategies and implementation patterns
keywords:
  - cache
  - redis
  - memoize
  - CDN
  - invalidate
  - TTL
  - stale
  - warm
alwaysApply: false
---

# Caching Skill

## Cache Strategy Decision

| Pattern | Use When | Example |
|---------|----------|---------|
| Cache-aside | Read-heavy, tolerance for stale data | User profiles, product listings |
| Write-through | Consistency matters | Financial data, inventory |
| Write-behind | Write-heavy, can tolerate lag | Analytics, logs |
| Read-through | Simplify app code | ORM-level caching |

## Cache-Aside Pattern

```typescript
async function getUserById(id: string): Promise<User> {
  const cacheKey = `user:${id}`;
  
  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Cache miss — fetch from DB
  const user = await db.users.findById(id);
  if (!user) throw new NotFoundError('User', id);
  
  // Store in cache with TTL
  await redis.set(cacheKey, JSON.stringify(user), 'EX', 300); // 5 min
  
  return user;
}
```

## Invalidation Strategies

### Time-based (TTL)
- Simple, predictable
- Accepts staleness up to TTL duration
- Good for: public data, listings, config

### Event-based
- Invalidate on write/update/delete
- More complex but always fresh
- Good for: user-specific data, inventory

```typescript
async function updateUser(id: string, data: Partial<User>) {
  await db.users.update(id, data);
  await redis.del(`user:${id}`); // invalidate cache
}
```

### Versioned keys
```typescript
const version = await redis.get('users:version') || '1';
const cacheKey = `user:${id}:v${version}`;
// To invalidate all users: increment version
await redis.incr('users:version');
```

## In-Memory Caching (Application Level)

```typescript
class LRUCache<K, V> {
  private map = new Map<K, V>();
  
  constructor(private maxSize: number) {}
  
  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }
  
  set(key: K, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxSize) {
      // Delete oldest (first entry)
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
  }
}
```

## HTTP Caching Headers

```typescript
// Immutable assets (hashed filenames)
res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

// API responses (stale-while-revalidate)
res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

// Private/authenticated data
res.setHeader('Cache-Control', 'private, no-cache');

// Never cache
res.setHeader('Cache-Control', 'no-store');
```

## Common Mistakes

- Caching errors/empty results (cache poisoning)
- No TTL (stale data forever)
- Cache stampede (many requests on cache miss — use locking)
- Over-caching (caching things that change every request)
- Not measuring hit rate (if it's < 80%, reconsider strategy)
