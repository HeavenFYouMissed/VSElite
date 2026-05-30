---
name: v3code-settings
description: V3Code editor settings, configuration, and customization
keywords:
  - settings
  - config
  - theme
  - font
  - keybinding
  - preference
  - customize
  - format on save
  - auto save
alwaysApply: false
---

# V3Code Settings Skill

## Settings Location

V3Code settings are stored in:
- **User settings**: `~/.v3code/settings.json` (global)
- **Workspace settings**: `.v3code/settings.json` (per-project, overrides user)

## Common Settings

```json
{
  "editor.fontSize": 14,
  "editor.fontFamily": "'JetBrains Mono', 'Fira Code', monospace",
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.formatOnSave": true,
  "editor.wordWrap": "on",
  "editor.minimap.enabled": false,
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.indentation": true,
  "editor.renderWhitespace": "boundary",
  "editor.smoothScrolling": true,
  "files.autoSave": "onFocusChange",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "terminal.integrated.fontSize": 13,
  "workbench.colorTheme": "V3Code Dark",
  "workbench.iconTheme": "v3code-icons"
}
```

## AI/Agent Settings

```json
{
  "v3code.ai.defaultModel": "deepseek-v4-pro",
  "v3code.ai.defaultProvider": "deepseek",
  "v3code.ai.temperature": 0.7,
  "v3code.ai.maxTokens": 4096,
  "v3code.ai.contextWindow": 128000,
  "v3code.ai.globalInstructions": "Be concise. Follow project conventions.",
  "v3code.ai.disableSystemMessage": false,
  "v3code.semanticIndex.enabled": true,
  "v3code.semanticIndex.excludePatterns": ["node_modules/**", "dist/**"]
}
```

## Theme Customization

```json
{
  "workbench.colorCustomizations": {
    "editor.background": "#1a1a1a",
    "editor.foreground": "#e0e0e0",
    "sideBar.background": "#141414",
    "activityBar.background": "#0d0d0d",
    "statusBar.background": "#0d0d0d",
    "titleBar.activeBackground": "#0d0d0d"
  },
  "editor.tokenColorCustomizations": {
    "comments": "#6a6a6a",
    "strings": "#a8d4a8",
    "keywords": "#c9c9c9",
    "functions": "#e8e8e8"
  }
}
```

## Keybindings

```json
[
  { "key": "ctrl+shift+a", "command": "v3code.openAgentPanel" },
  { "key": "ctrl+l", "command": "v3code.focusChat" },
  { "key": "ctrl+shift+n", "command": "v3code.newChatThread" },
  { "key": "ctrl+enter", "command": "v3code.sendMessage" },
  { "key": "escape", "command": "v3code.cancelGeneration" }
]
```

## When Helping Users with Settings

1. Ask what they want to change (behavior, appearance, AI)
2. Suggest the specific setting key and value
3. Specify whether it should go in user or workspace settings
4. Note any settings that require a restart
