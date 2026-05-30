---
name: accessibility
description: Web accessibility (a11y) patterns and WCAG compliance
keywords:
  - accessibility
  - a11y
  - aria
  - screen reader
  - keyboard
  - focus
  - contrast
  - semantic
  - WCAG
alwaysApply: false
---

# Accessibility Skill

## Core Principles (POUR)

1. **Perceivable** — content can be perceived by all senses
2. **Operable** — UI can be operated by keyboard, mouse, touch, voice
3. **Understandable** — content and operation are clear
4. **Robust** — works across assistive technologies

## Semantic HTML First

```html
<!-- BAD: div soup -->
<div onclick="submit()">Submit</div>
<div class="heading">Title</div>

<!-- GOOD: semantic elements -->
<button type="submit">Submit</button>
<h1>Title</h1>
```

## ARIA Rules

1. Don't use ARIA if a native HTML element works
2. All interactive elements need accessible names
3. Every `role` has required states/properties
4. Never use `aria-hidden="true"` on focusable elements

### Common ARIA Patterns
```html
<!-- Button with icon only -->
<button aria-label="Close dialog">
  <svg>...</svg>
</button>

<!-- Live region for dynamic content -->
<div aria-live="polite" aria-atomic="true">
  3 items in cart
</div>

<!-- Dialog -->
<div role="dialog" aria-labelledby="title" aria-modal="true">
  <h2 id="title">Confirm Action</h2>
</div>
```

## Keyboard Navigation

- All interactive elements must be focusable (tab order)
- Custom components need keyboard handlers (Enter, Space, Escape, Arrow keys)
- Focus must be visible (never remove outline without replacement)
- Focus trap inside modals/dialogs
- Skip links for navigation

## Color & Contrast

- Normal text: minimum 4.5:1 contrast ratio
- Large text (18px+): minimum 3:1 contrast ratio
- Never use color alone to convey information
- Test with a color blindness simulator

## Testing Checklist

- [ ] Navigate entire page with keyboard only (no mouse)
- [ ] Screen reader reads content in logical order
- [ ] All images have alt text (or alt="" for decorative)
- [ ] Form inputs have associated labels
- [ ] Error messages are announced to screen readers
- [ ] Focus is managed during route changes
- [ ] Animations respect `prefers-reduced-motion`
