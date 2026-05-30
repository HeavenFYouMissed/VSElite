---
name: web-performance
description: Web performance profiling, Core Web Vitals, and optimization
keywords:
  - lighthouse
  - web vitals
  - FCP
  - LCP
  - CLS
  - TBT
  - speed
  - load time
  - bundle size
  - lazy load
  - core web vitals
alwaysApply: false
---

# Web Performance Skill

## Core Web Vitals

| Metric | What It Measures | Good | Needs Work | Poor |
|--------|-----------------|------|------------|------|
| LCP (Largest Contentful Paint) | Loading speed | < 2.5s | 2.5-4s | > 4s |
| FID/INP (Interaction to Next Paint) | Interactivity | < 200ms | 200-500ms | > 500ms |
| CLS (Cumulative Layout Shift) | Visual stability | < 0.1 | 0.1-0.25 | > 0.25 |

## Performance Budget

- **Bundle size**: < 200KB initial JS (gzipped)
- **Time to Interactive**: < 3.5s on 4G
- **First Contentful Paint**: < 1.8s
- **Total page weight**: < 1.5MB

## Quick Optimization Checklist

### Loading
- [ ] Code splitting (route-based lazy loading)
- [ ] Tree shaking (dead code elimination)
- [ ] Compress assets (gzip/brotli)
- [ ] Preload critical resources (`<link rel="preload">`)
- [ ] Defer non-critical JS (`defer` or dynamic import)
- [ ] Optimize images (WebP/AVIF, correct dimensions, lazy load)

### Rendering
- [ ] Minimize DOM nodes (< 1500 ideally)
- [ ] Avoid layout thrashing (batch reads then writes)
- [ ] Use CSS containment for complex components
- [ ] Virtualize long lists (only render visible items)
- [ ] Debounce/throttle expensive event handlers

### Caching
- [ ] Immutable assets have long Cache-Control (1 year)
- [ ] API responses use appropriate caching headers
- [ ] Service worker for offline/cache-first strategies
- [ ] CDN for static assets

## Bundle Analysis

```bash
# Next.js
npx @next/bundle-analyzer

# Webpack
npx webpack-bundle-analyzer stats.json

# Vite
npx vite-bundle-visualizer
```

## Image Optimization

```html
<!-- Responsive images -->
<img 
  src="hero.webp" 
  srcset="hero-400.webp 400w, hero-800.webp 800w, hero-1200.webp 1200w"
  sizes="(max-width: 768px) 100vw, 50vw"
  loading="lazy"
  decoding="async"
  width="800" height="400"
  alt="Description"
/>
```

## Measuring

```javascript
// Performance Observer
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.startTime.toFixed(0)}ms`);
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });

// Simple timing
performance.mark('start');
// ... work ...
performance.mark('end');
performance.measure('work', 'start', 'end');
```

## Common Bottlenecks

1. **Large JS bundles** → code split, tree shake, lazy load
2. **Unoptimized images** → compress, resize, lazy load, modern formats
3. **Render-blocking CSS** → inline critical CSS, defer rest
4. **Third-party scripts** → defer, use facades, audit necessity
5. **Layout shifts** → set dimensions on images/videos, reserve space
