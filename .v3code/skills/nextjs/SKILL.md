---
name: nextjs
description: Next.js App Router patterns, SSR, and deployment
globs:
  - "**/app/**"
  - "next.config.*"
keywords:
  - next
  - nextjs
  - app router
  - server component
  - client component
  - SSR
  - SSG
  - ISR
  - middleware
  - vercel
alwaysApply: false
---

# Next.js Skill

## App Router Structure

```
app/
├── layout.tsx        # Root layout (wraps all pages)
├── page.tsx          # Home page (/)
├── loading.tsx       # Loading UI (Suspense boundary)
├── error.tsx         # Error boundary
├── not-found.tsx     # 404 page
├── dashboard/
│   ├── layout.tsx    # Dashboard layout
│   ├── page.tsx      # /dashboard
│   └── [id]/
│       └── page.tsx  # /dashboard/:id (dynamic)
└── api/
    └── users/
        └── route.ts  # API route: GET/POST /api/users
```

## Server vs Client Components

### Server Components (default)
- Can access database, file system, secrets
- Can't use hooks, event handlers, browser APIs
- Zero JS shipped to client

### Client Components (`'use client'`)
- Can use hooks (useState, useEffect, etc.)
- Can handle events (onClick, onChange, etc.)
- Adds to client bundle

**Rule**: Start with Server Components. Add `'use client'` only when you need interactivity.

## Data Fetching

```typescript
// Server Component (direct async)
async function UsersPage() {
  const users = await db.users.findMany(); // no useEffect needed
  return <UserList users={users} />;
}

// With caching
const getUser = cache(async (id: string) => {
  return db.users.findUnique({ where: { id } });
});
```

## Route Handlers (API)

```typescript
// app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const users = await db.users.findMany();
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();
  const user = await db.users.create({ data: body });
  return NextResponse.json(user, { status: 201 });
}
```

## Middleware

```typescript
// middleware.ts (root level)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (!request.cookies.get('token')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

## Common Patterns

- **Parallel routes**: `@modal/page.tsx` for modals
- **Intercepting routes**: `(.)photo/[id]` for modal → page transition
- **Route groups**: `(auth)/login`, `(auth)/signup` — shared layout, no URL segment
- **Server Actions**: `'use server'` functions for form mutations

## Performance

- Use `loading.tsx` for instant navigation feedback
- Prefer Server Components for data-heavy pages
- Use `dynamic = 'force-static'` for pages that can be pre-rendered
- Image optimization: `<Image>` component with proper width/height
