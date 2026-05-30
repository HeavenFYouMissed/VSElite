# Integrated Browser — Port Map (your repo vs VS Code 1.122)

> Measured 2026-05-29 against vanilla `1.122.0`. Answers: what is the new browser, why the
> old one can't load Google, exactly what code makes it up, and how it comes into the fork.

## Why your current browser can't load Google/YouTube/etc.

Your repo ships only `extensions/simple-browser` — it renders pages with a literal
**`<iframe>`** (`extensions/simple-browser/preview-src/index.ts` → `document.querySelector('iframe')`).
Real sites send `X-Frame-Options: DENY` / frame-ancestors CSP, so the browser **refuses to
frame them**. That's a hard limitation of the iframe approach — not fixable in Simple Browser.

## What the new integrated browser is

A real **Electron `WebContentsView`** (a genuine Chromium tab) hosted in the **main process**
and driven over **CDP (Chrome DevTools Protocol)**, with an optional **Playwright** service.
Confirmed: `src/vs/platform/browserView/electron-main/browserView.ts` →
`import { WebContentsView, webContents } from 'electron'`. Because it's a real Chromium
WebContents (not an iframe), **it loads any site**, and supports emulation, DevTools,
screenshots, find-in-page, element selection, and breakpoint debugging.

> Requires Electron ≥30 for `WebContentsView`. Your 1.99.3 is on Electron ~34; the 1.122
> base is on Electron 37 — so you get the supported runtime as part of the upgrade.

## The code, by layer (all of it is **NEW** — 0 lines exist in your repo today)

| Layer | Path | Files | ~Lines | What it is |
|---|---|---|---|---|
| Engine | `src/vs/platform/browserView/` | 26 | **8,504** | Main-process `WebContentsView`, CDP proxy, Playwright service, emulator, session trust, inspector, preload |
| UI / editor | `src/vs/workbench/contrib/browserView/` | 34 | **9,919** | Browser editor, tabs, zoom, find, emulation toolbar, chat-capture, agent tools (click/hover/drag/type/screenshot/read/navigate/playwright) |
| Sessions glue | `src/vs/sessions/contrib/browserView/` | 2 | ~115 | Agents/sessions integration |
| **Mermaid** (1.121) | `extensions/mermaid-markdown-features/` | new built-in ext | **3,409** | Renders Mermaid in Markdown preview, notebook cells, and chat |

**Total integrated browser ≈ 18,500 lines + Mermaid 3,400.**

## The three features you named — confirmed present in 1.122

- **Device emulation** → `…/contrib/browserView/electron-browser/features/browserEditorEmulationFeatures.ts` (955 lines) + `…/platform/browserView/electron-main/browserViewEmulator.ts` (201). Context keys for `browserEmulationIsMobile`, `browserEmulationHasUserAgent`, toolbar visibility → screen sizes, mobile/touch, custom user-agents.
- **Element picker** → `onDidSelectElement: Event<IElementData>` in `…/contrib/browserView/common/browserView.ts`, handled in `browserEditorChatFeatures.ts` ("add element to chat"); plus tools `clickBrowserTool`, `hoverElementTool`, `dragElementTool`, `screenshotBrowserTool`, `readBrowserTool`.
- **Mermaid + HTML preview** → `extensions/mermaid-markdown-features/` (new built-in) and built-in HTML preview opens local HTML in the integrated browser.

## How it comes into the fork (important)

This is a **clean ADD, not a merge** — every file is in a *new folder* that doesn't exist in
your repo, so there's **zero merge conflict** for the browser itself. BUT it is **not
back-portable onto your old 1.99.3 base in isolation**: it depends on the new main-process
`WebContentsView` wiring (`platform/browserView`, `windowImpl.ts`), the CDP/Playwright
services, new preload scripts, and Electron 37. Trying to graft just `browserView/` onto
1.99.3 means dragging all that infra back too.

**Conclusion:** get the integrated browser (emulation + picker + Mermaid + HTML preview) by
doing the **full base upgrade to 1.122** — it rides in automatically and conflict-free. Do
**not** cherry-pick it onto the old base. After upgrading, the only fork-side work is:
wiring its commands/visibility into your branding/menus and deciding whether its agent tools
(click/screenshot/read) should feed *your* chat instead of the built-in one.
