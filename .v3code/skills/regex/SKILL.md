---
name: regex
description: Regular expression patterns and best practices
keywords:
  - regex
  - regexp
  - pattern
  - match
  - replace
  - capture
  - validate
  - parse
alwaysApply: false
---

# Regex Skill

## Common Patterns

### Email (basic validation)
```
/^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

### URL
```
/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/
```

### Phone (US)
```
/^\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/
```

### UUID
```
/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```

### Slug
```
/^[a-z0-9]+(?:-[a-z0-9]+)*$/
```

### ISO Date
```
/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/
```

## JavaScript Regex Features

### Named capture groups
```javascript
const match = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/.exec('2024-03-15');
// match.groups.year === '2024'
```

### Lookahead / Lookbehind
```javascript
// Positive lookahead: match "foo" only if followed by "bar"
/foo(?=bar)/

// Negative lookahead: match "foo" only if NOT followed by "bar"
/foo(?!bar)/

// Positive lookbehind: match "bar" only if preceded by "foo"
/(?<=foo)bar/
```

### Replace with function
```javascript
'hello world'.replace(/(\w+)/g, (match) => match.toUpperCase());
// 'HELLO WORLD'
```

## Performance Tips

- Avoid catastrophic backtracking (nested quantifiers like `(a+)+`)
- Use non-capturing groups `(?:...)` when you don't need the capture
- Anchor when possible (`^...$`) to fail fast
- For simple string operations, prefer `.includes()`, `.startsWith()`, `.endsWith()`
- Compile regex once (outside loops): `const re = /pattern/g;`

## When NOT to Use Regex

- Parsing HTML/XML (use a parser)
- Complex nested structures (use a proper parser/grammar)
- Simple string checks (use `.includes()`, `.startsWith()`)
- URL parsing (use `new URL()`)
- Path manipulation (use `path` module)
