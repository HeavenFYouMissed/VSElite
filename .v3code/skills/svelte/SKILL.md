---
name: svelte
description: Svelte 5 component patterns and runes
globs:
  - "*.svelte"
  - "*.svelte.ts"
  - "*.svelte.js"
keywords:
  - svelte
  - rune
  - $state
  - $derived
  - $effect
  - sveltekit
  - component
  - snippet
alwaysApply: false
---

# Svelte 5 Skill

## Runes (Svelte 5)

### $state — Reactive state
```svelte
<script>
  let count = $state(0);
  let user = $state({ name: 'Alice', age: 30 });
</script>

<button onclick={() => count++}>{count}</button>
```

### $derived — Computed values
```svelte
<script>
  let items = $state([1, 2, 3]);
  let total = $derived(items.reduce((a, b) => a + b, 0));
  let doubled = $derived(items.map(i => i * 2));
</script>
```

### $effect — Side effects
```svelte
<script>
  let query = $state('');
  
  $effect(() => {
    // Runs when `query` changes
    const controller = new AbortController();
    fetchResults(query, controller.signal);
    return () => controller.abort(); // cleanup
  });
</script>
```

### $props — Component props
```svelte
<script>
  let { name, age = 25, onclick } = $props();
</script>
```

## Component Patterns

### Snippet (replaces slots)
```svelte
{#snippet header(title)}
  <h2>{title}</h2>
{/snippet}

<Card {header}>
  <p>Content</p>
</Card>
```

### Event handling
```svelte
<button onclick={(e) => handleClick(e)}>Click</button>
<input oninput={(e) => search = e.currentTarget.value} />
```

### Conditional rendering
```svelte
{#if loading}
  <Spinner />
{:else if error}
  <Error message={error.message} />
{:else}
  <Content data={data} />
{/if}
```

### Loops
```svelte
{#each items as item (item.id)}
  <ListItem {item} />
{/each}
```

## SvelteKit

### Route structure
```
src/routes/
├── +layout.svelte      # Root layout
├── +page.svelte        # Home page
├── +page.server.ts     # Server load function
├── about/
│   └── +page.svelte    # /about
└── blog/[slug]/
    ├── +page.svelte    # /blog/:slug
    └── +page.server.ts # Load data
```

### Load function
```typescript
// +page.server.ts
export async function load({ params, fetch }) {
  const post = await fetch(`/api/posts/${params.slug}`);
  return { post: await post.json() };
}
```

## Migration from Svelte 4

- `export let prop` → `let { prop } = $props()`
- `$:` reactive → `$derived()` or `$effect()`
- `<slot>` → `{#snippet}` + `{@render}`
- `on:click` → `onclick`
- `createEventDispatcher` → callback props
