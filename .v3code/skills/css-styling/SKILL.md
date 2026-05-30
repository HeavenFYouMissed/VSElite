---
name: css-styling
description: CSS, Tailwind, and styling patterns
globs:
  - "*.css"
  - "*.scss"
  - "*.less"
keywords:
  - CSS
  - style
  - tailwind
  - layout
  - flexbox
  - grid
  - responsive
  - animation
  - theme
  - dark mode
alwaysApply: false
---

# CSS & Styling Skill

## Layout Decision Tree

- **Single axis alignment** → Flexbox
- **Two-dimensional grid** → CSS Grid
- **Full page layout** → Grid for structure, Flex for components
- **Centering** → `display: grid; place-items: center;`

## Flexbox Cheatsheet

```css
.container {
  display: flex;
  flex-direction: row;       /* row | column */
  justify-content: center;   /* main axis: start | center | end | space-between | space-around */
  align-items: center;       /* cross axis: start | center | end | stretch */
  gap: 1rem;                 /* spacing between items */
  flex-wrap: wrap;           /* allow wrapping */
}

.item {
  flex: 1;                   /* grow to fill space */
  flex: 0 0 auto;           /* don't grow, don't shrink */
}
```

## Responsive Design

- Mobile-first: write base styles for mobile, add breakpoints for larger
- Use relative units: rem, em, %, vh/vw (not px for font sizes)
- Common breakpoints: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- Test at actual device sizes, not just breakpoint boundaries

## Tailwind Patterns

### Conditional classes
```tsx
<div className={cn(
  'base-classes',
  isActive && 'active-classes',
  variant === 'primary' ? 'primary-classes' : 'secondary-classes'
)} />
```

### Custom design tokens via CSS variables
```css
:root {
  --color-primary: #10b981;
  --radius-md: 0.5rem;
  --shadow-card: 0 2px 8px rgba(0,0,0,0.1);
}
```

## Performance

- Avoid `*` selectors in production
- Minimize reflows: batch DOM reads, then writes
- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid `box-shadow` and `filter` animations (expensive)
- Use `will-change` sparingly and only on elements that will animate

## Dark Mode

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a1a;
    --fg: #e5e5e5;
  }
}
```

Or with a class-based toggle:
```css
.dark { --bg: #1a1a1a; --fg: #e5e5e5; }
.light { --bg: #ffffff; --fg: #1a1a1a; }
```
