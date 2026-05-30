---
name: json-data
description: JSON manipulation, parsing, and data transformation
keywords:
  - JSON
  - parse
  - stringify
  - transform
  - map
  - filter
  - reduce
  - data
  - transform
  - flatten
alwaysApply: false
---

# JSON & Data Transformation Skill

## Safe JSON Parsing

```typescript
function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// With validation
function parseAndValidate<T>(json: string, schema: z.ZodSchema<T>): T | null {
  try {
    const data = JSON.parse(json);
    const result = schema.safeParse(data);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
```

## Common Transformations

### Group by key
```typescript
function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  return items.reduce((groups, item) => {
    const value = String(item[key]);
    (groups[value] ??= []).push(item);
    return groups;
  }, {} as Record<string, T[]>);
}
```

### Deep pick / omit
```typescript
function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) delete (result as any)[key];
  return result as Omit<T, K>;
}
```

### Flatten nested arrays
```typescript
function flatten<T>(nested: T[][]): T[] {
  return nested.reduce((flat, arr) => [...flat, ...arr], []);
}
// Or: nested.flat() in modern JS
```

### Unique by key
```typescript
function uniqueBy<T>(items: T[], key: keyof T): T[] {
  const seen = new Set();
  return items.filter(item => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
```

## Array Method Chaining

```typescript
const result = users
  .filter(u => u.isActive)
  .map(u => ({ name: u.name, email: u.email }))
  .sort((a, b) => a.name.localeCompare(b.name))
  .slice(0, 10);
```

## Performance Tips

- Use `Map` over objects for frequent add/delete operations
- Use `Set` for uniqueness checks (O(1) vs O(n) for array.includes)
- Avoid deep cloning large objects — use structural sharing
- `JSON.parse(JSON.stringify(obj))` is a valid deep clone for JSON-safe objects
- For very large arrays, consider generators/iterators to avoid memory spikes
