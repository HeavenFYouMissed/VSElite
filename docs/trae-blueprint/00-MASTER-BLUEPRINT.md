# Trae Chat Module — Complete Blueprint for V3Code
## Extracted May 27, 2026 from `@byted-icube/ai-modules-chat@latest`

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  ai-modules-chat (13MB bundle, React 18 dev mode)       │
├─────────────────────────────────────────────────────────┤
│  Component Layer (React)                                │
│  ├── ChatViewPaneComponent          (main chat)         │
│  ├── CustomAgentPaneComponent       (agent panel)       │
│  ├── AgentExtensionPaneComponent    (extensions)         │
│  ├── AITaskPanelComponent           (todo/plan list)    │
│  ├── AIModelsSettingsComponent      (model picker)      │
│  ├── InlineChatViewPaneComponent    (inline chat)       │
│  ├── AIContextSettingsComponent     (context/rules)     │
│  └── ... 14 more components                             │
├─────────────────────────────────────────────────────────┤
│  UI Primitives (Radix UI + Custom)                      │
│  ├── Popover, Tooltip, Modal, Dialog                    │
│  ├── Checkbox, Switch, Slider, Dropdown                 │
│  ├── Button (primary/secondary/brand variants)          │
│  └── Input, TextArea, CodeEditor                        │
├─────────────────────────────────────────────────────────┤
│  State Management (Zustand)                             │
│  ├── Session store (messages, threads)                  │
│  ├── User profile store                                 │
│  ├── Config store (settings)                            │
│  └── Agent store (models, tools, agents)                │
├─────────────────────────────────────────────────────────┤
│  Styling (Tailwind + CSS Variables)                     │
│  ├── 113 iCube CSS custom properties                    │
│  ├── 2,212 unique Tailwind+CSS classes                  │
│  └── 29 custom Codicon icons                            │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Design Token System (113 CSS Variables)

### Background Colors
```
--vscode-icube--bg-bg-base-default       (main background)
--vscode-icube--bg-bg-base-secondary     (secondary surfaces)
--vscode-icube--bg-bg-base-tertiary      (tertiary surfaces)
--vscode-icube--bg-bg-brand              (brand accent bg)
--vscode-icube--bg-bg-brand-hover        (brand hover)
--vscode-icube--bg-bg-brand-disabled     (brand disabled)
--vscode-icube--bg-bg-invert             (inverted bg)
--vscode-icube--bg-bg-invert-hover       (inverted hover)
--vscode-icube--bg-bg-menu               (menu/dropdown bg)
--vscode-icube--bg-bg-overlay-l1         (overlay level 1)
--vscode-icube--bg-bg-overlay-l2         (overlay level 2)
--vscode-icube--bg-bg-overlay-l3         (overlay level 3)
--vscode-icube--bg-bg-overlay-l4         (overlay level 4)
--vscode-icube--bg-bg-tooltip            (tooltip bg)
```

### Text Colors
```
--vscode-icube--text-text-default        (primary text)
--vscode-icube--text-text-default-hover  (primary hover)
--vscode-icube--text-text-default-active (primary active)
--vscode-icube--text-text-secondary      (secondary text)
--vscode-icube--text-text-tertiary       (tertiary/muted)
--vscode-icube--text-text-disabled       (disabled text)
--vscode-icube--text-text-onaccent       (text on accent)
--vscode-icube--text-text-onbrand        (text on brand)
```

### Border Colors
```
--vscode-icube--border-border-contrast   (high contrast border)
--vscode-icube--border-border-neutral-l1 (subtle border)
--vscode-icube--border-border-neutral-l2 (medium border)
--vscode-icube--border-border-neutral-l3 (strong border)
```

### Status Colors
```
--vscode-icube--status-success-default   (green)
--vscode-icube--status-success-hover     (green hover)
--vscode-icube--status-error-default     (red)
--vscode-icube--status-warning-default   (yellow/amber)
--vscode-icube--status-alert-default     (alert)
--vscode-icube--status-primary-surface-l1 (info/primary)
```

### Accent Colors
```
--vscode-icube--accent-accent-amber
--vscode-icube--accent-accent-blue
--vscode-icube--accent-accent-lime
--vscode-icube--accent-accent-slate
--vscode-icube--accent-accent-teal
--vscode-icube--accent-accent-violet
```

### Elevation / Shadows
```
--vscode-icube-elevation-100-tooltip     (tooltip shadow)
--vscode-icube-elevation-200-menu-panel  (menu/dropdown shadow)
--vscode-icube-box-shadow2               (medium shadow)
--vscode-icube-box-shadow3               (heavy shadow)
--vscode-icube-colorWidgetShadow         (widget shadow)
```

### Button System
```
--vscode-icube-primaryButtonBackground
--vscode-icube-primaryButtonForeground
--vscode-icube-primaryButtonHoverBackground
--vscode-icube-primaryButtonHoverForeground
--vscode-icube-primaryButtonActivateBackground
--vscode-icube-primaryButtonActivateForeground
--vscode-icube-primaryButtonDisableBackground
--vscode-icube-primaryButtonDisableForeground
--vscode-icube-defaultButtonBackground
--vscode-icube-defaultButtonForeground
--vscode-icube-defaultButtonHoverBackground
--vscode-icube-defaultButtonHoverForeground
--vscode-icube-defaultButtonActivateBackground
--vscode-icube-defaultButtonActivateForeground
--vscode-icube-defaultButtonDisableBackground
--vscode-icube-defaultButtonDisableForeground
```

### Icon Colors
```
--vscode-icube--icon-icon-default
--vscode-icube--icon-icon-default-hover
--vscode-icube--icon-icon-secondary
--vscode-icube--icon-icon-secondary-hover
--vscode-icube--icon-icon-tertiary
--vscode-icube--icon-icon-brand
--vscode-icube--icon-icon-disabled
--vscode-icube--icon-icon-onaccent
```

---

## 3. Custom Icons (29 Codicons)

Trae extends VS Code's Codicon set with custom icons:

```
codicon-icube-ArrowUpRight      codicon-icube-assistant
codicon-icube-Check             codicon-icube-CloseSimple
codicon-icube-Copy              codicon-icube-Docset
codicon-icube-DocsetEnterprise  codicon-icube-folderOpened
codicon-icube-History           codicon-icube-LogoTrae
codicon-icube-McpFold           codicon-icube-McpUnFold
codicon-icube-PlusFilled        codicon-icube-Search
codicon-icube-SoloSwitch        codicon-icube-TextareaCopy
codicon-icube-TextareaZoomIn    codicon-icube-TextareaZoomUp
codicon-loading                 codicon-modifier-spin
codicon-arrow-down              codicon-arrow-up
codicon-chevron-right           codicon-close
codicon-error                   codicon-refresh
codicon-settings-gear           codicon-terminal
```

---

## 4. Key CSS Class Patterns (from 2,212 classes)

### Chat Message Layout
```
chat-markdown-code-block-outer    (code block wrapper)
user-chat-bubble                  (user message bubble)
user-chat-bubble-request-group    (grouped user requests)
thinking-stream-content           (streaming thinking animation)
thinking-markdown-code-block      (thinking code blocks)
thinking-markdown-link            (thinking links)
```

### Chat Welcome/Empty State
```
chat-welcome-view-title
chat-welcome-view-message
chat-welcome-view-disclaimer
chat-welcome-view-suggested-prompts
```

### Agent/Tool UI
```
todo-item                         (agent task item)
icube-checkbox-icon-wrapper       (custom checkbox)
icube-ai-custom-agent-avatar-modal  (agent avatar)
```

### Button System
```
icube-button                      (base button)
icube-button--primary             (primary variant)
icube-button--secondary           (secondary variant)
icube-button--brand               (brand variant)
icube-button--disabled            (disabled state)
icube-button--block               (full width)
icube-button--sm / --md / --lg    (size variants)
```

### Form Inputs
```
icube-input                       (text input)
icube-input--error                (error state)
icube-input--disabled             (disabled state)
icube-select                      (dropdown select)
icube-switch                      (toggle switch)
icube-slider                      (range slider)
```

### Layout Primitives
```
flex / inline-flex
flex-col / flex-row
flex-1 / flex-auto / flex-none
items-center / items-start / items-end
justify-between / justify-center / justify-end
gap-1 through gap-8
p-1 through p-8 (padding)
m-1 through m-8 (margin)
rounded-[4px] / rounded-[6px] / rounded-full
border / border-t / border-b / border-l / border-r
overflow-hidden / overflow-auto / overflow-scroll
min-h-0 / min-w-0
shrink-0 / grow
w-full / h-full
```

### Text Utilities
```
text-xs / text-sm / text-base / text-lg
font-medium / font-semibold / font-bold
leading-[18px] / leading-tight
truncate / text-ellipsis
text-text-default / text-text-secondary / text-text-tertiary
text-status-error / text-status-warning / text-status-success
```

---

## 5. Component Hierarchy

### ChatViewPaneComponent (main chat panel)
```
ChatViewPane
├── ChatHeader
│   ├── ModelDropdown (model selector)
│   ├── ModeSelector (Chat/Agent/Ask tabs)
│   └── ActionButtons (new chat, history, settings)
├── ChatMessageList
│   ├── WelcomeView (empty state)
│   │   ├── Title
│   │   ├── Message
│   │   └── SuggestedPrompts
│   ├── MessageBubble (per message)
│   │   ├── UserBubble
│   │   │   ├── RequestGroup (grouped messages)
│   │   │   └── Attachments (files, images)
│   │   └── AssistantBubble
│   │       ├── ThinkingStream (animated reasoning)
│   │       ├── MarkdownContent (rendered markdown)
│   │       ├── CodeBlock
│   │       │   ├── SyntaxHighlight
│   │       │   ├── CopyButton
│   │       │   └── ApplyButton (diff apply)
│   │       ├── ToolCallCard
│   │       │   ├── ToolIcon + Name
│   │       │   ├── ProgressIndicator (spinner)
│   │       │   └── ToolResult (expandable)
│   │       ├── TodoList (agent tasks)
│   │       │   ├── TodoItem (checkbox + label)
│   │       │   └── AcceptAll / RejectAll buttons
│   │       └── MessageActions
│   │           ├── Copy
│   │           ├── Retry
│   │           ├── Edit (fork)
│   │           └── Feedback (thumbs up/down)
│   └── ErrorDisplay (error boundary fallback)
├── ChatInput
│   ├── LexicalEditor (rich text input)
│   ├── AttachmentBar (files, images)
│   ├── ContextIndicator (files referenced)
│   ├── ModelSelector (inline)
│   ├── ModeTabs (Chat / Agent / Ask)
│   └── SendButton
└── Sidebar (settings/integrations)
    ├── IntegrationsPanel
    │   ├── SupabaseService
    │   ├── VercelDeployment
    │   ├── AIServices (OpenAI, Anthropic, etc.)
    │   └── PaymentService (Stripe)
    ├── MCPSettings
    ├── RulesSettings
    └── KnowledgeSettings
```

### AgentExtensionPaneComponent (integrations sidebar)
```
AgentExtensionPane
├── TabBar (Flow, Editor, Terminal, Supabase, Browser, etc.)
├── TabContent (per-tab content)
│   ├── FlowTab (agent workflow)
│   ├── EditorTab (code context)
│   ├── TerminalTab (terminal output)
│   ├── SupabaseTab (database integration)
│   │   ├── ProjectCard
│   │   └── ConnectButton
│   ├── BrowserTab (web preview)
│   ├── DiffViewTab (code changes)
│   └── MCPTab (MCP server config)
└── SettingsModal (full settings)
    ├── ModelsSettings
    ├── ContextSettings
    ├── RulesSettings
    └── SkillsSettings
```

---

## 6. State Management (Zustand Stores)

Key stores identified in the codebase:

```
Session Store (IT)
├── sessions: Session[]
├── currentSession: Session | null
├── switchToSession()
├── createNewSession()
├── loadSessionList()
└── setAgent()

Chat Store (x7)
├── currentSession
├── messages
├── streamingState
└── inputState

User Store (u)
├── userProfile
├── loggedIn
└── saasEntitlementInfo

Config Store (I7)
├── iCubeApp config
├── autoAccept settings
└── feature flags

Agent Store (OB)
├── builtInAgentList
├── customAgentList
├── dslAgentList
└── getData()

Model Store (TN)
├── modelList
├── selectedModel
└── getModelListByAgentType()

MCP Store (various)
├── servers
├── galleryItems
└── configurations
```

---

## 7. Key Interaction Patterns

### Streaming Chat
```
1. User sends message
2. ChatInput disabled, SendButton → StopButton
3. MessageList appends UserBubble
4. MessageList appends AssistantBubble (loading skeleton)
5. Text streams in via SSE/WebSocket
6. ThinkingStream shows animated "..." during reasoning
7. MarkdownContent renders progressively
8. Tool calls appear as ToolCallCards with spinner
9. TodoList updates as agent plans tasks
10. On completion: StopButton → SendButton
```

### Tool Execution Flow
```
1. Agent decides to use tool
2. ToolCallCard appears with:
   - Tool icon + name
   - "Running..." spinner
   - Auto-accept countdown (if enabled)
3. Tool executes
4. Result appears:
   - Success: green check + expandable output
   - Error: red X + error message
5. Auto-accept mode: skips confirmation
6. Manual mode: shows Accept/Reject buttons
```

### Code Apply Flow
```
1. Agent generates code diff
2. DiffView shows side-by-side changes
3. ApplyButton with status indicator:
   - "Apply" (ready)
   - Spinner (applying)
   - Check (applied)
   - X (failed)
4. AcceptAll/RejectAll for batch changes
```

---

## 8. What V3Code Should Extract

### Phase 1: Chat Polish (high impact, low effort)
- [ ] Streaming text animation (thinking indicator)
- [ ] Code block with copy button + syntax highlight
- [ ] Message actions bar (copy, retry, edit)
- [ ] Welcome/empty state with suggested prompts
- [ ] Model selector dropdown in header

### Phase 2: Agent Features (medium effort)
- [ ] Tool call cards with status indicators
- [ ] Todo/plan list with checkbox items
- [ ] Auto-accept toggle for tool calls
- [ ] Error display with expandable details

### Phase 3: Full Agent Panel (higher effort)
- [ ] Agent extension sidebar (integrations)
- [ ] Diff view for code changes
- [ ] Multi-tab layout (chat + terminal + browser)
- [ ] MCP settings configuration UI

### Design Token Migration
- [ ] Replace hardcoded colors with iCube-inspired CSS variables
- [ ] Create V3Code button system (primary/secondary/brand)
- [ ] Create V3Code input/select/switch components
- [ ] Adopt Tailwind utility classes for layout

---

## 9. Files Reference

Extracted data files in `docs/trae-blueprint/`:
- `01-classnames.txt` — 2,212 unique CSS class names
- `02-icube-css-vars.txt` — 113 iCube design tokens
- `03-icons.txt` — 29 custom icon references
- `04-html-elements.txt` — 62 HTML elements used
- `06-state-stores.txt` — State management patterns

Source file:
- `C:\Users\heave\AppData\Local\Programs\Trae\resources\app\node_modules\@byted-icube\ai-modules-chat\dist\index.mjs` (12.8MB)
