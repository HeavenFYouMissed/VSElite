---
name: file-operations
description: File system operations, reading, writing, and path handling
keywords:
  - file
  - read file
  - write file
  - path
  - directory
  - fs
  - stream
  - upload
  - download
alwaysApply: false
---

# File Operations Skill

## Path Handling (Node.js)

```typescript
import path from 'path';

// ALWAYS use path.join or path.resolve — never concatenate with '/'
const filePath = path.join(__dirname, '..', 'data', 'config.json');

// Resolve to absolute path
const absolute = path.resolve('relative/path');

// Parse components
const { dir, base, name, ext } = path.parse('/foo/bar/baz.txt');
// dir: '/foo/bar', base: 'baz.txt', name: 'baz', ext: '.txt'
```

## Safe File Reading

```typescript
import { readFile, stat } from 'fs/promises';

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    // Check it exists and is a file (not a symlink to /etc/passwd)
    const info = await stat(filePath);
    if (!info.isFile()) return null;
    if (info.size > 10_000_000) throw new Error('File too large');
    
    return await readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
```

## Streaming Large Files

```typescript
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

// Copy large file without loading into memory
await pipeline(
  createReadStream('input.log'),
  createWriteStream('output.log')
);

// Process line by line
import { createInterface } from 'readline';

const rl = createInterface({ input: createReadStream('large.csv') });
for await (const line of rl) {
  processLine(line);
}
```

## Temporary Files

```typescript
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'myapp-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
```

## Security Rules

- NEVER use user input directly in file paths
- Validate paths are within expected base directory:
```typescript
function isPathSafe(basePath: string, userPath: string): boolean {
  const resolved = path.resolve(basePath, userPath);
  return resolved.startsWith(path.resolve(basePath));
}
```
- Check file type by content (magic bytes), not just extension
- Set file permissions appropriately (0o644 for files, 0o755 for dirs)
- Use `O_EXCL` flag when creating files that must be new

## File Watching

```typescript
import { watch } from 'fs/promises';

const watcher = watch('./src', { recursive: true });
for await (const event of watcher) {
  if (event.filename?.endsWith('.ts')) {
    console.log(`Changed: ${event.filename}`);
  }
}
```
