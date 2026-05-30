---
name: electron-vscode
description: VS Code and Electron architecture patterns
globs:
  - "**/vs/**/*.ts"
  - "**/electron-main/**"
  - "*.contribution.ts"
keywords:
  - electron
  - vscode
  - extension
  - workbench
  - contribution
  - IPC
  - renderer
  - main process
  - service
alwaysApply: false
---

# Electron / VS Code Architecture Skill

## Process Model

- **Main Process** (Node.js) — file system, native APIs, child processes
- **Renderer Process** (Chromium) — UI, DOM, limited Node access
- **Extension Host** — isolated process for extensions
- **Communication**: IPC channels between processes

## Service Pattern

```typescript
// 1. Define interface + decorator
export const IMyService = createDecorator<IMyService>('myService');
export interface IMyService {
  readonly _serviceBrand: undefined;
  doThing(): Promise<string>;
}

// 2. Implement
class MyService extends Disposable implements IMyService {
  readonly _serviceBrand: undefined;
  
  constructor(
    @IFileService private readonly fileService: IFileService,
    @ILogService private readonly logService: ILogService,
  ) {
    super();
  }
  
  async doThing(): Promise<string> { /* ... */ }
}

// 3. Register singleton
registerSingleton(IMyService, MyService, InstantiationType.Delayed);
```

## Contribution Points

Register features via `*.contribution.ts`:
```typescript
import './myFeature.js'; // side-effect import registers the singleton
```

## IPC Communication

### Simple service (ProxyChannel pattern)
```typescript
// Main process registers
services.set(IMyMainService, new SyncDescriptor(MyMainService));

// Renderer consumes via proxy
const myService = ProxyChannel.toService<IMyMainService>(
  mainProcessService.getChannel('myChannel')
);
```

### Custom channel (streaming/events)
```typescript
class MyChannel implements IServerChannel<string> {
  listen<T>(ctx: string, event: string): Event<T> { /* ... */ }
  call(ctx: string, command: string, arg?: any): Promise<any> { /* ... */ }
}
```

## Critical Rules

- **Never import Node builtins in browser/ code** — crashes the renderer ESM loader
- **Dispose subscriptions** — use `this._register()` for auto-cleanup
- **Delayed instantiation** — use `InstantiationType.Delayed` unless eager start needed
- **File watches** — always dispose watchers, use debouncing
- **State persistence** — use `IStorageService` for persisted state

## Common Patterns

- **Emitter pattern**: `private readonly _onDidChange = new Emitter<T>()`
- **Disposable cleanup**: `this._register(emitter)` in constructor
- **URI-based file access**: Always use `URI` not raw `fsPath`
- **Configuration**: `IConfigurationService` for user/workspace settings
