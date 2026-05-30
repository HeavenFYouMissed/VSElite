---
name: error-handling
description: Robust error handling and resilience patterns
keywords:
  - error
  - exception
  - try catch
  - throw
  - resilience
  - retry
  - fallback
  - graceful
  - recovery
alwaysApply: false
---

# Error Handling Skill

## Principles

1. **Fail fast, recover gracefully** — detect errors early, handle them at the right level
2. **Never swallow errors silently** — at minimum, log them
3. **Use custom error classes** for different failure domains
4. **Errors are data** — include context (what failed, why, what was attempted)

## Custom Error Classes

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class ValidationError extends AppError {
  constructor(field: string, message: string) {
    super(message, 'VALIDATION_ERROR', 400, { field });
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404, { resource, id });
  }
}
```

## Async Error Handling

```typescript
// Pattern 1: try/catch with specific handling
async function fetchUser(id: string) {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    if (error instanceof NetworkError) throw new ServiceUnavailableError('User service');
    throw error; // unknown errors bubble up
  }
}

// Pattern 2: Result type (no exceptions)
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

async function safeFetch<T>(url: string): Promise<Result<T>> {
  try {
    const data = await fetch(url).then(r => r.json());
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
```

## Retry Pattern

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelay = 1000 } = {}
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}
```

## Anti-Patterns

- `catch (e) {}` — swallowing errors silently
- Catching errors too early (handle at the right layer)
- Using error codes instead of typed errors
- Logging the error AND re-throwing (causes duplicate logs)
- Using exceptions for control flow (use return values instead)
