/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/


// register inline diffs
import './editCodeService.js'

// register Sidebar pane, state, actions (keybinds, menus) (Ctrl+L)
import './sidebarActions.js'
import './sidebarPane.js'

// register Agent panel mode + editor input (Ctrl+Shift+A toggles chat <-> agent main-editor split)
import './voidChatEditorInput.js'
import './agentPanelService.js'
import './agentPanelActions.js'

// register VIBE/DEV mode toggle (fullscreen agent panel powered by zen mode)
import './vibeModeService.js'
import './vibeModeActions.js'

// register quick edit (Ctrl+K)
import './quickEditActions.js'


// register Autocomplete
import './autocompleteService.js'

// register Context services
// import './contextGatheringService.js'
// import './contextUserChangesService.js'

// settings pane
import './voidSettingsPane.js'

// register css
import './media/void.css'

// update (frontend part, also see platform/)
import './voidUpdateActions.js'

import './convertToLLMMessageWorkbenchContrib.js'

// tools
import './toolsService.js'
import './terminalToolService.js'

// register Thread History
import './chatThreadService.js'

// ping
import './metricsPollService.js'

// helper services
import './helperServices/consistentItemService.js'

// register selection helper
import './voidSelectionHelperWidget.js'

// register tooltip service
import './tooltipService.js'

// register onboarding service
import './voidOnboardingService.js'

// auto-register Context Bridge MCP server on startup
import './contextBridgeStartup.js'

// register Context Bridge native service (symbol-attached notes)
import '../common/contextBridge/contextBridgeService.js'

// register LSP Bridge Adapter (in-process VS Code language feature wrapper used by CB tools)
import './contextBridge/lspBridgeAdapter.js'

// register Semantic Index (codebase indexing + retrieval)
// The renderer-side impl walks the workspace via IFileService, hashes via Web Crypto,
// and stores chunks in-memory. Lexical retrieval is wired so the meter has real progress
// and the agent's semantic_search gets non-empty results. The full sqlite + embeddings
// pipeline lands when the IPC boundary to a node-host service is built.
import '../common/semanticIndex/semanticIndexConfiguration.js'
import './semanticIndexBrowserImpl.js'
import './semanticIndexActions.js'
import './semanticIndexStatusBar.js'

// register misc service
import './miscWokrbenchContrib.js'

// register file service (for explorer context menu)
import './fileService.js'

// register source control management
import './voidSCMService.js'

// ---------- common (unclear if these actually need to be imported, because they're already imported wherever they're used) ----------

// llmMessage
import '../common/sendLLMMessageService.js'

// voidSettings
import '../common/voidSettingsService.js'

// refreshModel
import '../common/refreshModelService.js'

// metrics
import '../common/metricsService.js'

// updates
import '../common/voidUpdateService.js'

// model service
import '../common/voidModelService.js'
