---
name: data-validation
description: Input validation, schema design, and data integrity
keywords:
  - validate
  - validation
  - schema
  - zod
  - joi
  - yup
  - sanitize
  - input
  - form
alwaysApply: false
---

# Data Validation Skill

## Zod (Recommended for TypeScript)

### Basic schemas
```typescript
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(13).max(120).optional(),
  role: z.enum(['user', 'admin', 'moderator']).default('user'),
  tags: z.array(z.string()).max(10).default([]),
});

type User = z.infer<typeof UserSchema>;
```

### Validation with error handling
```typescript
function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): 
  { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: result.error };
}
```

### Advanced patterns
```typescript
// Discriminated union
const EventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string() }),
]);

// Transform (coerce and clean)
const QuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()),
  search: z.string().trim().toLowerCase().optional(),
});

// Refinement (custom validation)
const PasswordSchema = z.string()
  .min(8)
  .refine(s => /[A-Z]/.test(s), 'Must contain uppercase')
  .refine(s => /[0-9]/.test(s), 'Must contain number');
```

## Validation Layers

1. **Client-side** — immediate feedback (UX only, never trust)
2. **API layer** — validate request shape and types
3. **Business logic** — validate domain rules
4. **Database** — constraints as last defense (NOT NULL, UNIQUE, FK)

## Sanitization

```typescript
// Strip HTML to prevent XSS
function sanitizeHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

// Trim and normalize whitespace
function normalizeString(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

// Validate file upload
function validateFile(file: { size: number; type: string; name: string }) {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (file.size > MAX_SIZE) throw new Error('File too large');
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Invalid file type');
  if (file.name.includes('..')) throw new Error('Invalid filename');
}
```

## Form Validation (React)

```typescript
// With react-hook-form + zod
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function CreateUserForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<User>({
    resolver: zodResolver(UserSchema),
  });
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
    </form>
  );
}
```
