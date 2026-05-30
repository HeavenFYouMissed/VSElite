---
name: tailwind
description: Tailwind CSS utility-first patterns and configuration
globs:
  - "*.tsx"
  - "*.jsx"
  - "tailwind.config.*"
keywords:
  - tailwind
  - utility
  - class
  - responsive
  - dark mode
  - custom
  - theme
  - plugin
alwaysApply: false
---

# Tailwind CSS Skill

## Core Concepts

- Utility-first: compose styles from small atomic classes
- Responsive: `sm:`, `md:`, `lg:`, `xl:`, `2xl:` prefixes (mobile-first)
- States: `hover:`, `focus:`, `active:`, `disabled:`, `group-hover:`
- Dark mode: `dark:` prefix

## Common Patterns

### Flex layout
```html
<div class="flex items-center justify-between gap-4">
  <span class="text-sm font-medium">Label</span>
  <button class="px-3 py-1.5 rounded-md bg-neutral-800 text-white text-sm">Action</button>
</div>
```

### Grid layout
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <div class="p-4 rounded-lg border border-neutral-200">Card</div>
</div>
```

### Responsive sidebar
```html
<aside class="hidden md:flex md:w-64 flex-col border-r">...</aside>
<main class="flex-1 min-w-0">...</main>
```

## Custom Design Tokens

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          500: '#22c55e',
          900: '#14532d',
        },
      },
      spacing: {
        '18': '4.5rem',
      },
      fontSize: {
        'xxs': '0.625rem',
      },
    },
  },
};
```

## Conditional Classes

```typescript
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Usage
<div className={cn(
  'px-4 py-2 rounded-md text-sm',
  isActive ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-700',
  disabled && 'opacity-50 cursor-not-allowed'
)} />
```

## Component Variants Pattern

```typescript
const buttonVariants = {
  primary: 'bg-green-600 text-white hover:bg-green-700',
  secondary: 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300',
  ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100',
};

const buttonSizes = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};
```

## Performance

- Use `@apply` sparingly (defeats the purpose of utility-first)
- Purge unused classes in production (Tailwind v3+ does this by default)
- Group related classes logically: layout → spacing → typography → colors → effects
- Use design tokens in config instead of arbitrary values (`bg-[#1a1a1a]`)
