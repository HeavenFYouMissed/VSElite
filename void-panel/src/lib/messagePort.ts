import type { HostToPanel, PanelToHost, RpcMethod, RpcResponse, RpcStream } from './types'

// postMessage bridge to the workbench host. Validates origin (dev localhost vs prod
// vscode-resource), does request/response correlation, and exposes streaming.
//
// The host injects a MessagePort or simply uses window.parent.postMessage; we support the
// simple parent-postMessage path here (the host's webview HTML relays to the extension host).

const DEV_ORIGIN = 'http://localhost:5173'

function originAllowed(origin: string): boolean {
	if (origin === DEV_ORIGIN) return true
	// VS Code webview prod origins: vscode-webview:// or vscode-resource (scheme varies by version)
	if (origin.startsWith('vscode-webview://')) return true
	if (origin.startsWith('vscode-resource:')) return true
	if (origin === 'null') return true // some webview sandboxes report null
	return false
}

type StreamHandlers = {
	onText?: (text: string) => void
	onFinal?: (payload: unknown) => void
	onError?: (err: string) => void
	onAbort?: () => void
}

export type AgentEvent = { kind: 'idle' | 'thinking' | 'tool' | 'awaiting'; detail?: string }

class VBridge {
	private seq = 0
	private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>()
	private streams = new Map<string, StreamHandlers>()
	private ready = false
	private onInitCbs: Array<(workspaceName?: string) => void> = []
	private agentCbs: Array<(e: AgentEvent) => void> = []

	constructor() {
		window.addEventListener('message', (e: MessageEvent) => {
			if (!originAllowed(e.origin)) return
			const msg = e.data as HostToPanel
			if (!msg || typeof msg !== 'object') return
			if (msg.type === 'init') {
				this.ready = true
				this.onInitCbs.forEach(cb => cb(msg.workspaceName))
				return
			}
			if ((msg as any).type === 'agentEvent') {
				this.agentCbs.forEach(cb => cb(msg as unknown as AgentEvent))
				return
			}
			if (msg.type === 'rpc-response') {
				const p = this.pending.get((msg as RpcResponse).id)
				if (!p) return
				this.pending.delete(msg.id)
				if (msg.ok) p.resolve(msg.result)
				else p.reject(new Error(msg.error || 'RPC error'))
				return
			}
			if (msg.type === 'rpc-stream') {
				const s = this.streams.get((msg as RpcStream).id)
				if (!s) return
				if (msg.event === 'text') s.onText?.(String(msg.payload ?? ''))
				else if (msg.event === 'final') { s.onFinal?.(msg.payload); this.streams.delete(msg.id) }
				else if (msg.event === 'error') { s.onError?.(String(msg.payload ?? 'error')); this.streams.delete(msg.id) }
				else if (msg.event === 'abort') { s.onAbort?.(); this.streams.delete(msg.id) }
			}
		})
		this.post({ type: 'ready' })
	}

	private post(m: PanelToHost) { window.parent.postMessage(m, '*') }

	onInit(cb: (workspaceName?: string) => void) {
		if (this.ready) cb()
		else this.onInitCbs.push(cb)
	}

	onAgentEvent(cb: (e: AgentEvent) => void) { this.agentCbs.push(cb) }

	call<T = unknown>(method: RpcMethod, params: unknown): Promise<T> {
		const id = `r${++this.seq}`
		return new Promise<T>((resolve, reject) => {
			this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
			this.post({ type: 'rpc-request', id, method, params })
		})
	}

	stream(method: RpcMethod, params: unknown, handlers: StreamHandlers): string {
		const id = `s${++this.seq}`
		this.streams.set(id, handlers)
		this.post({ type: 'rpc-request', id, method, params })
		return id
	}
}

export const bridge = new VBridge()
