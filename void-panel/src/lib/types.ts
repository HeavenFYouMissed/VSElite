// The stable RPC contract between V's UI (this app) and the workbench host
// (vCompanionPane.ts). This is the seam that survives the VS Code merge -- keep it stable.

export type RpcRequest = {
	type: 'rpc-request'
	id: string
	method: RpcMethod
	params: unknown
}

export type RpcResponse = {
	type: 'rpc-response'
	id: string
	ok: boolean
	result?: unknown
	error?: string
}

// Streaming events (for sendLLMMessage / addUserMessageAndStreamResponse)
export type RpcStream = {
	type: 'rpc-stream'
	id: string
	event: 'text' | 'tool' | 'final' | 'error' | 'abort'
	payload?: unknown
}

export type HostToPanel = RpcResponse | RpcStream | { type: 'init'; workspaceName?: string }
export type PanelToHost = RpcRequest | { type: 'ready' }

// Methods the host exposes (mirror the verified service signatures in V-SOURCE-OF-TRUTH §3)
export type RpcMethod =
	| 'callTool'                         // toolsService.callTool(toolName, params)
	| 'getProjectBriefing'               // convenience: callTool('get_project_briefing', {...})
	| 'vWorkspaceSummary'                // V's .v/ home: { available, fileCount, skills[], home }
	| 'vChat'                            // V's brain — streams text/tool/final/error/abort
	| 'vAbort'                           // stop V's current reply
	| 'vRunAgent'                        // V hands a task to the main coding agent
	| 'sendLLMMessage'                   // V's own Flash brain (streams)
	| 'abort'
	| 'addUserMessageAndStreamResponse'  // drive the coding agent (streams)
	| 'approveLatestToolRequest'
	| 'rejectLatestToolRequest'

export type ProjectBriefing = {
	workspaceRoot: string | null
	fileTree?: string
	recentCommits?: string[]
	warnings?: string[]
}
