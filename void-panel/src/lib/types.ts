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

export type CtxPush = { type: 'ctx'; used: number; max: number }

export type HostToPanel = RpcResponse | RpcStream | CtxPush | { type: 'init'; workspaceName?: string }
export type PanelToHost = RpcRequest | { type: 'ready' }

// Methods the host exposes (mirror the verified service signatures in V-SOURCE-OF-TRUTH §3)
export type RpcMethod =
	| 'callTool'
	| 'getProjectBriefing'
	| 'vWorkspaceSummary'
	| 'vListSkills'
	| 'vMountSkill'
	| 'vChat'
	| 'vAbort'
	| 'vRunAgent'
	| 'vRemember'
	| 'vRecall'
	| 'vMemorySummary'
	| 'vSetAutoPilot'
	| 'vSandboxStage'
	| 'vSandboxList'
	| 'vSandboxApprove'
	| 'vGitStatus'
	| 'vGitLog'
	| 'vGitBranch'
	| 'vGitDiff'

export type ProjectBriefing = {
	workspaceRoot: string | null
	fileTree?: string
	recentCommits?: string[]
	warnings?: string[]
}
