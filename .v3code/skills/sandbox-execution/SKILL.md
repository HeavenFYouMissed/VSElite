---
name: sandbox-execution
description: Secure code execution, sandboxing, and code interpreters
keywords:
  - sandbox
  - execute
  - run code
  - interpreter
  - isolated
  - untrusted
  - eval
  - safe execution
alwaysApply: false
---

# Sandboxed Execution Skill

## When You Need a Sandbox

- Executing user-provided code
- Running untrusted scripts
- Building code playgrounds / REPLs
- CI/CD pipeline runners
- AI code generation → execution loops

## Isolation Strategies

| Method | Isolation Level | Speed | Complexity |
|--------|----------------|-------|------------|
| VM2/isolated-vm | Process-level | Fast | Low |
| Docker containers | OS-level | Medium | Medium |
| Firecracker/gVisor | Kernel-level | Medium | High |
| WebAssembly (WASI) | Memory-safe | Fast | Medium |
| Web Workers | Thread-level | Fast | Low |

## Docker-Based Sandbox

```typescript
import { execSync } from 'child_process';

async function runInSandbox(code: string, language: string): Promise<string> {
  const timeout = 10; // seconds
  const memoryLimit = '128m';
  
  const images: Record<string, string> = {
    python: 'python:3.12-slim',
    node: 'node:20-alpine',
    ruby: 'ruby:3.3-slim',
  };
  
  const image = images[language];
  if (!image) throw new Error(`Unsupported language: ${language}`);
  
  const result = execSync(
    `echo ${Buffer.from(code).toString('base64')} | docker run --rm -i ` +
    `--memory=${memoryLimit} --cpus=0.5 ` +
    `--network=none ` +  // no network access
    `--read-only ` +     // read-only filesystem
    `--timeout ${timeout} ` +
    `${image} sh -c "base64 -d | ${language}"`,
    { timeout: (timeout + 5) * 1000, encoding: 'utf-8' }
  );
  
  return result;
}
```

## Security Rules

1. **No network access** — `--network=none` in Docker
2. **Memory limits** — prevent OOM bombs
3. **CPU limits** — prevent crypto mining
4. **Time limits** — kill after N seconds
5. **Read-only filesystem** — prevent persistence
6. **No privileged mode** — never `--privileged`
7. **Resource cleanup** — always remove containers after execution
8. **Input sanitization** — validate code length, reject obvious attacks

## Web Worker Sandbox (Browser)

```typescript
function createSandbox() {
  const blob = new Blob([`
    self.onmessage = (e) => {
      try {
        const fn = new Function(e.data.code);
        const result = fn();
        self.postMessage({ success: true, result: String(result) });
      } catch (err) {
        self.postMessage({ success: false, error: err.message });
      }
    };
  `], { type: 'application/javascript' });
  
  const worker = new Worker(URL.createObjectURL(blob));
  
  return {
    run(code: string, timeoutMs = 5000): Promise<string> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          worker.terminate();
          reject(new Error('Execution timed out'));
        }, timeoutMs);
        
        worker.onmessage = (e) => {
          clearTimeout(timer);
          if (e.data.success) resolve(e.data.result);
          else reject(new Error(e.data.error));
        };
        
        worker.postMessage({ code });
      });
    },
    terminate() { worker.terminate(); },
  };
}
```

## Output Handling

- Capture stdout AND stderr separately
- Limit output size (truncate at 10KB)
- Strip ANSI escape codes for clean display
- Include exit code in response
- Return execution time for diagnostics
