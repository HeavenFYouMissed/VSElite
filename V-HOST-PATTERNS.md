# V — Host Implementation Patterns (current 1.99.3 base)

> Verified reference for the builder, extracted read-only from the current tree
> (2026-05-29). Hand-in-hand with `V-CURSOR-DIRECTIVE.md` + `V-SOURCE-OF-TRUTH.md`.
>
> **Provenance:** Line refs to `vCompanionPane.ts` are the **proposed/target**
> structure (that file is NEW — the builder creates it). Refs to **existing** VS
> Code files (`webview/browser/pre/index.html`, environment services, etc.) are
> verified against the tree — re-confirm exact symbol/import names at
> implementation time.
>
> **Correction this supersedes:** `V-SOURCE-OF-TRUTH.md §3` said "the webview API
> means CSP just works." More precise: the *workbench* CSP isn't relaxed, but the
> *webview's own* CSP (in the relay HTML) MUST include
> `frame-src http://localhost:5173 ws://localhost:5173` in dev, or the localhost
> iframe is blocked. See §3 below.

## Overview

The V companion is a **thin webview host** running as a bottom-panel tab (the
**`[v]`** tab next to Ports). All UI lives in the standalone Vite + React app at
`void-panel/` (served on `http://localhost:5173` in dev, `void-panel/dist` in
prod). The host layer is:

1. **vCompanionPane.ts** — ViewPane subclass that manages the webview + message relay.
2. Relay HTML (built inline in `setHtml`) — bridges iframe ↔ workbench host.
3. **void.contribution.ts** — one-line import to trigger registration.

---

## (1) Panel Registration — ViewContainer + View

**Import (side-effect) in** `src/vs/workbench/contrib/void/browser/void.contribution.ts`:

```typescript
import './vCompanionPane.js'
```

### registerViewContainer()

```typescript
const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const vContainer = viewContainerRegistry.registerViewContainer({
	id: V_VIEW_CONTAINER_ID,                        // 'workbench.view.vCompanion'
	title: nls.localize2('vCompanionContainer', 'V'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [V_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 100,                                     // sits after Ports — see ordering
	icon: Codicon.symbolMisc,
}, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: false });
```

**Verified panel tab ordering (left→right):** Problems `0` · Output `1` ·
Debug Console `2` · Terminal `3` · Ports `5` · **V `100`** (any value `> 5` puts
V right of Ports).

### registerViews()

```typescript
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: V_VIEW_ID,                                   // 'workbench.view.vCompanion.view'
	name: nls.localize2('vCompanionView', 'V'),
	ctorDescriptor: new SyncDescriptor(VCompanionViewPane),
	canToggleVisibility: false,
	canMoveView: true,
	weight: 100,
	order: 1,
}], vContainer);
```

---

## (2) ViewPane subclass — webview creation + lifecycle

```typescript
class VCompanionViewPane extends ViewPane {
	private readonly _webview = this._register(new MutableDisposable<IOverlayWebview>());
	private readonly _webviewDisposables = this._register(new DisposableStore());
	private _container?: HTMLElement;
	private _activated = false;

	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService hoverService: IHoverService,
		@IWebviewService private readonly webviewService: IWebviewService,            // REQUIRED
		@IEnvironmentService private readonly environmentService: IEnvironmentService, // REQUIRED
		// + custom services (toolsService, chatThreadService, llmMessageService, ...)
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._register(this.onDidChangeBodyVisibility(() => {
			if (this.isBodyVisible()) {
				this._activate();
				this._webview.value?.claim(this, getWindow(this.element), undefined);
				this._layoutWebview();
			} else {
				this._webview.value?.release(this);
			}
		}));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this._container = container;
		if (this.isBodyVisible()) {
			this._activate();
			this._webview.value?.claim(this, getWindow(this.element), undefined);
			this._layoutWebview();
		}
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this._layoutWebview(new Dimension(width, height));
	}

	override focus(): void { super.focus(); this._webview.value?.focus(); }

	private _activate(): void {
		if (this._activated) { return; }
		this._activated = true;

		const webview = this.webviewService.createWebviewOverlay({
			providedViewType: V_VIEW_ID,
			title: 'V',
			options: {
				purpose: WebviewContentPurpose.WebviewView,
				retainContextWhenHidden: true,     // keep DOM/state across tab switches
				enableFindWidget: false,
			},
			contentOptions: {
				allowScripts: true,                // REQUIRED for the relay script
				allowForms: true,
				localResourceRoots: this._localResourceRoots(),
			},
			extension: undefined,                  // not from an extension
		});
		this._webview.value = webview;
		this._webviewDisposables.add(toDisposable(() => this._webview.value?.release(this)));

		webview.onMessage(e => this._handleMessage(e.message));  // register BEFORE setHtml
		webview.setHtml(this._buildHtml());
	}

	private _isDev(): boolean {
		return !this.environmentService.isBuilt;   // isBuilt === false in dev (VSCODE_DEV)
	}

	private _distRoot(): URI {
		// appRoot: src/vs/platform/environment/common/environment.ts (INativeEnvironmentService)
		const appRoot = (this.environmentService as INativeEnvironmentService).appRoot;
		return URI.joinPath(URI.file(appRoot), 'void-panel', 'dist');
	}

	private _localResourceRoots(): URI[] {
		return this._isDev() ? [] : [this._distRoot()];
	}

	private _frameSrc(): string {
		if (this._isDev()) { return 'http://localhost:5173'; }
		return asWebviewUri(URI.joinPath(this._distRoot(), 'index.html')).toString();
	}

	private _buildHtml(): string {
		const frameSrc = this._frameSrc();
		const frameCsp = this._isDev()
			? 'http://localhost:5173 ws://localhost:5173'   // dev server + HMR WebSocket
			: webviewGenericCspSource;                       // prod: 'self' https://*.vscode-cdn.net
		return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy"
	content="default-src 'none'; frame-src ${frameCsp}; script-src 'unsafe-inline'; style-src 'unsafe-inline';" />
<style>
	html, body { margin: 0; padding: 0; height: 100%; background: #160a2b; overflow: hidden; }
	#vframe { width: 100%; height: 100%; border: 0; display: block; }
</style>
</head>
<body>
<iframe id="vframe" src="${frameSrc}" allow="clipboard-read; clipboard-write"></iframe>
<script>
	const vscode = acquireVsCodeApi();
	const frame = document.getElementById('vframe');
	window.addEventListener('message', function (e) {
		if (frame.contentWindow && e.source === frame.contentWindow) {
			vscode.postMessage(e.data);                       // app -> host
		} else if (frame.contentWindow) {
			frame.contentWindow.postMessage(e.data, '*');     // host -> app
		}
	});
</script>
</body>
</html>`;
	}

	private _post(message: unknown): void { this._webview.value?.postMessage(message); }

	private async _handleMessage(msg: any): Promise<void> {
		if (!msg || typeof msg !== 'object') { return; }
		// if (msg.type === 'ready') { this._post({ type: 'init', ... }); }
		// if (msg.type === 'rpc-request') { const result = await this._dispatch(msg.method, msg.params); this._post({ type: 'rpc-response', id: msg.id, result }); }
	}

	private _layoutWebview(dimension?: Dimension): void {
		if (this._container && this._webview.value) {
			this._webview.value.layoutWebviewOverElement(this._container, dimension);
		}
	}
}
```

**`IOverlayWebview` surface used:** `postMessage`, `onMessage`, `setHtml`,
`layoutWebviewOverElement`, `claim`, `release`, `focus`.

---

## (3) The CSP crux (read this)

Default webview CSP is `frame-src 'self'` (set in
`src/vs/workbench/contrib/webview/browser/pre/index.html`), which **blocks
`localhost:5173`.** You MUST override CSP in the relay HTML:

- **Dev:** `frame-src http://localhost:5173 ws://localhost:5173;` (the `ws://`
  entry is required for Vite HMR).
- **Prod:** `frame-src` = `webviewGenericCspSource` (`'self' https://*.vscode-cdn.net`).

**Do NOT use `contentOptions.portMapping`** — it only rewrites fetch/XHR via the
service worker; iframe CSP is enforced before networking, so it has no effect on
the iframe. Override CSP in the relay HTML instead.

---

## (4) Prod local-resource loading — `asWebviewUri()`

```typescript
import { asWebviewUri } from '../../webview/common/webview.js';
const distRoot = URI.joinPath(URI.file(appRoot), 'void-panel', 'dist');
const iframeUri = asWebviewUri(URI.joinPath(distRoot, 'index.html'));
// → https://file+.vscode-resource.vscode-cdn.net/.../void-panel/dist/index.html
```

Requires `localResourceRoots: [distRoot]`. The webview service worker intercepts
`vscode-resource` URLs and serves the local files.

---

## (5) Message flow

```
Workbench host (VCompanionViewPane)
   webview.onMessage(e => _handleMessage(e.message))
   webview.postMessage(msg)
            ↕  IOverlayWebview postMessage / onMessage
Relay HTML (setHtml, has acquireVsCodeApi())
   if e.source === frame.contentWindow  → vscode.postMessage(e.data)   // app → host
   else                                 → frame.contentWindow.postMessage(e.data,'*') // host → app
            ↕  iframe postMessage
V Vite app (void-panel) — http://localhost:5173 (dev) / dist (prod)
   const vscode = acquireVsCodeApi(); vscode.postMessage({type:'ready'})
   window.addEventListener('message', ...)
```

The V app's existing `messagePort.ts` should send `{type:'ready'}` on load and
validate `event.origin` (accept `http://localhost:5173` in dev, the
`vscode-resource`/`vscode-webview` origin in prod).

---

## (6) Show V on startup

```typescript
class VCompanionStartContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.startupVCompanion';
	constructor(@IViewsService viewsService: IViewsService) {
		viewsService.openView(V_VIEW_ID, true);
	}
}
registerWorkbenchContribution2(VCompanionStartContribution.ID, VCompanionStartContribution, WorkbenchPhase.AfterRestored);
```

---

## Gotchas

1. **CSP `frame-src` must be customized** in the relay HTML (§3). Default blocks localhost.
2. **`setHtml()` AFTER `onMessage()`** — else early `ready` messages are missed.
3. **`retainContextWhenHidden: true`** — or the panel loses state when the tab is hidden.
4. **`appRoot` cast** (`as INativeEnvironmentService`) is Electron-only — fine for V3Code.
5. **`localResourceRoots`** must include the whole `void-panel/dist` in prod or assets 404.
6. **`postMessage` is async** — don't assume synchronous delivery.
7. **The relay script is required** — a bare `<iframe>` alone does NOT bridge messages; you need `acquireVsCodeApi()` + the forwarding listener.

---

## Test checklist

- [ ] [v] tab appears next to Ports.
- [ ] Dev: iframe loads `localhost:5173` (no CSP error in webview devtools), HMR WebSocket connects.
- [ ] `ready` from app → host handler fires; host → app `init` arrives.
- [ ] RPC round-trip (`callTool('get_project_briefing')`) returns and renders the greeting.
- [ ] Hide/show the tab — state preserved.
- [ ] Prod: `asWebviewUri` dist load, no 404/CSP errors.
