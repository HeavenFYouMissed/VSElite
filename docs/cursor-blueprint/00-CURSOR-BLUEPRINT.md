# Cursor IDE — Complete Blueprint for V3Code
## Extracted May 27, 2026 from Cursor's workbench CSS

---

## 1. Architecture Comparison: Trae vs Cursor

| Feature | Trae | Cursor |
|---|---|---|
| Design tokens | 113 (iCube) | 1,381 (Cursor) |
| CSS classes | 2,212 | 8,574 |
| Chat UI | ChatViewPane | **Composer** (7 modes) |
| Agent system | CustomAgent | **Meta-Agent** + **SubAgent** |
| Sidebar style | Standard VS Code | **Glass morphism** (vibrancy) |
| Brand color | Blue/Teal | **Magenta** |
| Color system | 6 accent colors | 8 color families (bg + icon + text pairs) |
| Inline chat | InlineChatViewPane | Inline with progress frames |
| Todo system | Basic todo list | **Composer todo** with backgrounds |
| Modes | Chat/Agent toggle | 7 composer modes |

---

## 2. Cursor Design Token System (1,381 tokens)

### Brand Colors (Magenta-based)
```
--cursor-magenta                        Primary brand
--cursor-bg-magenta-primary             Brand background
--cursor-bg-magenta-secondary           Brand background (hover)
--cursor-text-magenta-primary           Brand text
--cursor-text-magenta-secondary         Brand text (secondary)
--cursor-icon-magenta-primary           Brand icons
--cursor-icon-magenta-secondary         Brand icons (secondary)
--cursor-stroke-magenta-primary         Brand borders
--cursor-stroke-magenta-secondary       Brand borders (hover)
```

### Full Color System (8 color families)
```
--cursor-blue / --cursor-bg-blue-primary / --cursor-bg-blue-secondary
--cursor-cyan / --cursor-bg-cyan-primary / --cursor-bg-cyan-secondary
--cursor-green / --cursor-bg-green-primary / --cursor-bg-green-secondary
--cursor-magenta / --cursor-bg-magenta-primary / --cursor-bg-magenta-secondary
--cursor-orange / --cursor-bg-orange-primary / --cursor-bg-orange-secondary
--cursor-purple / --cursor-bg-purple-primary / --cursor-bg-purple-secondary
--cursor-red / --cursor-bg-red-primary / --cursor-bg-red-secondary
--cursor-yellow / --cursor-bg-yellow-primary / --cursor-bg-yellow-secondary
```

### Background Hierarchy
```
--cursor-bg-primary          Main surface
--cursor-bg-secondary        Elevated surface
--cursor-bg-tertiary         Further elevated
--cursor-bg-quaternary       Even higher
--cursor-bg-quinary          Highest surface
--cursor-bg-chrome           Window chrome/titlebar
--cursor-bg-editor           Editor area
--cursor-bg-sidebar          Sidebar/panel
--cursor-bg-input            Input fields
--cursor-bg-card             Card components
--cursor-bg-active           Active state
--cursor-bg-focused          Focused state
--cursor-bg-elevated         Elevated/floating
--cursor-bg-accent           Accent background
```

### Typography System
```
--cursor-font-family            System font
--cursor-font-family-sans       Sans-serif
--cursor-font-family-mono       Monospace
--cursor-font-size-base         Base size
--cursor-font-size-sm           Small
--cursor-font-size-lg           Large
--cursor-font-weight-normal     400
--cursor-font-weight-medium     500
--cursor-font-weight-semibold   600
--cursor-font-weight-bold       700
```

### Shadows
```
--cursor-box-shadow-sm
--cursor-box-shadow-base
--cursor-box-shadow-soft
--cursor-box-shadow-lg
--cursor-box-shadow-xl
```

---

## 3. Composer Modes (7 modes!)

Cursor's "Composer" is their main AI interaction panel. It has **7 distinct modes**:

### Mode Tokens
```
--composer-mode-background-background    (Background mode)
--composer-mode-background-text

--composer-mode-chat-background          (Chat mode)
--composer-mode-chat-text

--composer-mode-debug-background          (Debug mode)
--composer-mode-debug-border
--composer-mode-debug-icon
--composer-mode-debug-text

--composer-mode-multitask-background      (Multitask mode)
--composer-mode-multitask-text

--composer-mode-plan-background           (Plan mode)
--composer-mode-plan-border
--composer-mode-plan-icon
--composer-mode-plan-text

--composer-mode-spec-background           (Spec mode)
--composer-mode-spec-border
--composer-mode-spec-icon
--composer-mode-spec-text
```

### Composer Layout
```
--composer-max-width
--composer-messages-padding-inline
--composer-human-message-content-padding
--composer-pane-background
--composer-pending-action-color
--composer-pending-action-review-mode-color
--composer-tab-label-max-width
--composer-pair-container-gap
--composer-todo-summary-mix-base
--cursor-composer-todo-background
```

---

## 4. Agent System (3 tiers)

### Tier 1: Agent Panel
```
--agent
--agent-mode
--agent-panel-followup-bottom-bleed-mask-height
--agent-panel-followup-overlay-height
--agent-panel-open-files-callout-shortcut-width
--agent-panel-open-files-callout-text-width
```

### Tier 2: Meta-Agent (Agent that manages agents)
```
--meta-agent-overlay-height
--meta-agent-thread-stack-bottom-inset
--meta-agent-thread-stack-gap
--meta-agent-thread-stack-height
--meta-agent-thread-stack-horizontal-inset
--meta-agent-thread-stack-top-inset
--meta-agent-thread-transition-delay      ← Thread transitions!
```

### Tier 3: Agent Feedback
```
--agent-panel-meta-agent-chat-notification-bubble-max-width
--agent-panel-meta-agent-chat-vibometer-feedback-background  ← Vibometer!
--agent-panel-meta-agent-status-font-size
--agent-panel-meta-agent-status-line-height
--agent-prompt-model-picker-max-width
--agent-sidebar-cell-hover-actions-width
```

---

## 5. Glass Morphism Sidebar

Cursor's sidebar uses macOS-style glass/vibrancy effects:

```
--glass-sidebar-surface-background
--glass-sidebar-agent-status-dot-size
--glass-sidebar-status-affordance-opacity
--glass-vibrancy-on-sidebar-surface-background
--glass-vibrancy-off-sidebar-surface-background
--glass-vibrancy-on-surface-background
--glass-vibrancy-on-chat-surface-background
--glass-vibrancy-on-editor-surface-background
--glass-vibrancy-off-chat-surface-background
--glass-vibrancy-off-editor-surface-background
--glass-surface-background
--glass-chat-surface-background
--glass-chat-bubble-background
--glass-chat-bubble-opaque-background
--glass-editor-surface-background
--glass-agent-panel-inactive-tile-filter
--glass-subagent-breadcrumb-border-bottom
--glass-window-border-color
```

---

## 6. Subagent System

```
--subagent
--subagent-model-picker-height
--glass-subagent-breadcrumb-border-bottom
--agent-sidebar-cell-hover-actions-width
```

---

## 7. Inline Chat System

```
--inline
--inline-agent-tabs
--inline-chat-frame-progress
--inline-header-actions
--ai-input-editor-padding
```

---

## 8. What V3Code Should Steal from Cursor

### Phase 1: Color System
- [ ] 8-color family system (bg + text + icon + stroke pairs)
- [ ] Proper background hierarchy (primary through quinary)
- [ ] Typography tokens (font families, sizes, weights)
- [ ] Shadow system (sm → xl)

### Phase 2: Composer Modes
- [ ] Mode-specific theming (each mode has bg + text + border + icon)
- [ ] Mode: Chat, Debug, Plan, Spec, Multitask, Background
- [ ] Pending action system with review mode colors

### Phase 3: Agent System
- [ ] Agent panel with followup overlay
- [ ] Meta-agent thread stack (agents managing agents)
- [ ] Vibometer feedback system
- [ ] Agent status dots in sidebar

### Phase 4: Glass Panel (macOS)
- [ ] Glass morphism sidebar (transparent + blur)
- [ ] Vibrancy on/off modes
- [ ] Glass chat bubbles
- [ ] Window border colors

### Phase 5: Inline Chat
- [ ] Inline agent tabs
- [ ] Chat frame progress indicators
- [ ] Inline header actions

---

## 9. Files Reference

Extracted data in `docs/cursor-blueprint/`:
- `01-css-vars.txt` — 1,381 CSS custom properties
- `02-classnames.txt` — 8,574 unique CSS class names
- `03-cursor-patterns.txt` — Cursor-specific UI patterns

Source files:
- `D:\curse\workbench.desktop.main.css` (2MB)
- `D:\curse\main.js` (56KB)
- `D:\curse\workbench.js` (20KB)
