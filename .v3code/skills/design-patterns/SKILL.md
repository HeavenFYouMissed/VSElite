---
name: design-patterns
description: Software design patterns and when to apply them
keywords:
  - pattern
  - singleton
  - factory
  - observer
  - strategy
  - adapter
  - decorator
  - command
  - SOLID
alwaysApply: false
---

# Design Patterns Skill

## When to Apply Patterns

- **Only when the problem clearly calls for it** — don't force patterns onto simple code
- **Name the problem first** — "I need to decouple X from Y" before picking a pattern
- **Start simple** — you can always refactor to a pattern later

## Creational Patterns

### Factory
When: You need to create objects without specifying the exact class
```typescript
interface Logger { log(msg: string): void; }

function createLogger(type: 'console' | 'file'): Logger {
  switch (type) {
    case 'console': return new ConsoleLogger();
    case 'file': return new FileLogger();
  }
}
```

### Builder
When: Object has many optional parameters
```typescript
const query = new QueryBuilder()
  .select('name', 'email')
  .from('users')
  .where('active', true)
  .limit(10)
  .build();
```

## Structural Patterns

### Adapter
When: Wrapping a third-party API to match your interface
```typescript
class StripeAdapter implements PaymentGateway {
  constructor(private stripe: Stripe) {}
  
  async charge(amount: number, currency: string): Promise<Receipt> {
    const result = await this.stripe.charges.create({ amount, currency });
    return { id: result.id, status: result.status };
  }
}
```

### Decorator
When: Adding behavior without modifying the original
```typescript
function withLogging<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: any[]) => {
    console.log(`Calling ${fn.name} with`, args);
    const result = fn(...args);
    console.log(`Result:`, result);
    return result;
  }) as T;
}
```

## Behavioral Patterns

### Observer / Event Emitter
When: Multiple consumers need to react to state changes
```typescript
class EventBus {
  private listeners = new Map<string, Set<Function>>();
  
  on(event: string, fn: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)!.delete(fn); // unsubscribe
  }
  
  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach(fn => fn(...args));
  }
}
```

### Strategy
When: Multiple algorithms for the same task, chosen at runtime
```typescript
interface SortStrategy<T> { sort(items: T[]): T[]; }

class QuickSort<T> implements SortStrategy<T> { ... }
class MergeSort<T> implements SortStrategy<T> { ... }

class Sorter<T> {
  constructor(private strategy: SortStrategy<T>) {}
  sort(items: T[]) { return this.strategy.sort(items); }
}
```

### Command
When: Encapsulating operations for undo/redo, queuing, or logging
```typescript
interface Command {
  execute(): void;
  undo(): void;
}

class InsertTextCommand implements Command {
  constructor(private doc: Document, private text: string, private position: number) {}
  execute() { this.doc.insert(this.position, this.text); }
  undo() { this.doc.delete(this.position, this.text.length); }
}
```

## SOLID Principles (Quick Reference)

- **S** — Single Responsibility: one reason to change
- **O** — Open/Closed: extend behavior without modifying
- **L** — Liskov Substitution: subtypes are substitutable
- **I** — Interface Segregation: small, focused interfaces
- **D** — Dependency Inversion: depend on abstractions
