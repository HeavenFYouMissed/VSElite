/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/


// register inline diffs
import './editCodeService.js'

// register Sidebar pane, state, actions (keybinds, menus) (Ctrl+L)
import './sidebarActions.js'
import './sidebarPane.js'

// Agent panel + VIBE mode disabled — see Sidebar.tsx for chat-only layout
// import './voidChatEditorInput.js'
// import './agentPanelService.js'
// import './agentPanelActions.js'
// import './vibeModeService.js'
// import './vibeModeActions.js'

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

// Context Bridge auto-registration as an EXTERNAL MCP server is intentionally DISABLED.
// All 10 context-bridge tools (get_symbol_context, get_file_context, get_call_graph,
// get_file_dependencies, pack_context, find_text, remember, forget, list_notes,
// get_project_briefing) are built into V3Code natively via toolsService.ts + lspBridgeAdapter,
// using VS Code's in-process language features (faster + no approval prompts). Running the
// external stdio MCP server too is redundant and makes the agent call the MCP copies, which
// trigger "Approve MCP tool" prompts. Re-enable only if you want the tools exposed to OTHER
// editors over MCP.
// import './contextBridgeStartup.js'

// register Context Bridge native service (symbol-attached notes)
import '../common/contextBridge/contextBridgeService.js'

// register LSP Bridge Adapter (in-process VS Code language feature wrapper used by CB tools)
import './contextBridge/lspBridgeAdapter.js'

// register Semantic Index (codebase indexing + retrieval)
// The renderer-side impl walks the workspace via IFileService, hashes via Web Crypto,
// and stores chunks in-memory. Lexical + optional embeddings (bge-small) retrieval is wired
// so the meter has real progress and the agent's semantic_search gets non-empty results.
import '../common/semanticIndex/semanticIndexConfiguration.js'
import './semanticIndexBrowserImpl.js'
import './semanticIndexActions.js'
import './semanticIndexStatusBar.js'

// register V3Code agentic feature services. These register their DI singletons so they
// are injectable. Full UI/agent-loop wiring is incremental; registration here makes the
// services live and available for consumers.
// NOTE: agentModeService (use existing ChatMode normal/gather/agent), rollbackService
// (use existing checkpoint system), and diffPreviewService (use existing editCodeService
// diff zones) were removed as redundant with capabilities V3Code already has.
import './autoContextService.js'        // auto-attach relevant files to a prompt
import './backgroundAgentService.js'    // background task state management
import './slashCommandService.js'       // /fix /explain /test /commit /refactor /doc
import './chatGhostTextService.js'      // chat-aware inline completion cache

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
