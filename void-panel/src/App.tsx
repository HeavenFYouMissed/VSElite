import { useEffect, useRef, useState } from 'react'
import { VStage, type Choice } from './components/VStage'
import { VSidePanel, type Activity, type Skill } from './components/VSidePanel'
import { BuildingView, type BuildStep } from './components/BuildingView'
import { useProjectBriefing } from './hooks/useVoidBridge'
import { bridge, type AgentEvent } from './lib/messagePort'

type Role = 'v' | 'you' | 'sys'
type Msg = { role: Role; text: string }
type VView = 'home' | 'building'
type BuildState = { title: string; steps: BuildStep[]; pct: number }

const PFX: Record<Role, string> = { v: 'v', you: 'you', sys: '··' }

// tools that count as "building" (V shifts into the building scene); others are just activity
const BUILD_TOOLS = new Set(['create_file_or_folder', 'delete_file_or_folder', 'rewrite_file', 'edit_file', 'run_command', 'run_persistent_command', 'git_commit'])
const humanizeTool = (name: string): string => {
	const map: Record<string, string> = {
		edit_file: 'editing a file', rewrite_file: 'rewriting a file', create_file_or_folder: 'creating files',
		delete_file_or_folder: 'deleting files', run_command: 'running a command', run_persistent_command: 'running a command',
		read_file: 'reading a file', ls_dir: 'listing files', get_dir_tree: 'mapping the tree',
		search_for_files: 'searching', search_pathnames_only: 'searching', search_in_file: 'searching a file',
		git_commit: 'committing', read_lint_errors: 'checking lint',
	}
	return map[name] || name.replace(/_/g, ' ')
}

export function App() {
	const { briefing, connected } = useProjectBriefing()
	const [messages, setMessages] = useState<Msg[]>([
		{ role: 'sys', text: 'V companion · boot' },
		{ role: 'sys', text: 'context-bridge · linking…' },
	])
	const [choices, setChoices] = useState<Choice[]>([])
	const [input, setInput] = useState('')
	const [recent, setRecent] = useState<Activity[]>([])
	const [skills, setSkills] = useState<Skill[]>([])
	const [fileCount, setFileCount] = useState(0)
	const [streaming, setStreaming] = useState(false)
	const [view, setView] = useState<VView>('home')
	const [build, setBuild] = useState<BuildState | null>(null)
	const scrollRef = useRef<HTMLDivElement>(null)
	const greeted = useRef(false)
	const streamingRef = useRef(false)
	useEffect(() => { streamingRef.current = streaming }, [streaming])

	const goHome = () => { setView('home'); setBuild(null) }

	useEffect(() => {
		if (!connected || greeted.current) return
		greeted.current = true
		const root = briefing?.workspaceRoot?.split(/[\\/]/).filter(Boolean).pop() || 'this workspace'
		setMessages(m => [
			...m.filter(x => !(x.role === 'sys' && x.text.includes('linking'))),
			{ role: 'sys', text: 'context-bridge · online' },
			{ role: 'v', text: `hey — i'm V. i'm watching ${root}. i'll keep an eye on the agent and ping you when something's worth a skill, a fix, or a heads-up.` },
		])
		setChoices([{ label: 'watch the agent' }, { label: 'suggest a skill' }, { label: 'just chat' }])
		// Phase-1 placeholder activity until the agent-watch hook is wired.
		setRecent([
			{ when: 'now', what: 'linked context-bridge' },
			{ when: '1m', what: `opened ${root}` },
		])
		// Pull V's real workspace (.v/) — created on first run by the host.
		bridge.call<{ fileCount?: number; skills?: Skill[] }>('vWorkspaceSummary', {})
			.then(s => { setSkills(s?.skills ?? []); setFileCount(s?.fileCount ?? 0) })
			.catch(() => { /* standalone / no folder */ })
	}, [connected, briefing])

	useEffect(() => {
		const el = scrollRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [messages])

	// Agent-watching: react to what the coding agent is doing (recent activity + scene shift).
	useEffect(() => {
		bridge.onAgentEvent((e: AgentEvent) => {
			if (e.kind === 'idle') {
				// finish any building scene and return home (unless the user is mid-chat with V)
				setBuild(b => (b ? { ...b, steps: b.steps.map(s => ({ ...s, state: 'done' })), pct: 100 } : b))
				window.setTimeout(() => { if (!streamingRef.current) { setView(v => (v === 'building' ? 'home' : v)); setBuild(null) } }, 1300)
				return
			}
			if (e.kind === 'tool') {
				const label = humanizeTool(e.detail || '')
				setRecent(r => [{ when: 'now', what: `agent · ${label}` }, ...r].slice(0, 6))
				if (BUILD_TOOLS.has(e.detail || '') && !streamingRef.current) {
					setView('building')
					setBuild(b => {
						const prev = (b?.steps ?? []).map((s): BuildStep => ({ ...s, state: 'done' }))
						prev.push({ label, state: 'active' })
						return { title: 'the agent', steps: prev, pct: Math.min(92, prev.length * 16) }
					})
				}
			}
		})
	}, [])

	// Esc returns to the home scene (without losing the conversation)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && view !== 'home') goHome() }
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [view])

	const replaceLastV = (m: Msg[], text: string): Msg[] => {
		const copy = m.slice()
		for (let i = copy.length - 1; i >= 0; i--) {
			if (copy[i].role === 'v') { copy[i] = { role: 'v', text }; break }
		}
		return copy
	}

	// Scene system: V shifts into a dedicated "level" for major work, then returns home.
	// Driven manually for now (the /build preview); agent-watching will fire this for real.
	const runBuildScene = (title: string) => {
		const labels = ['reading the workspace', 'scaffolding files', 'wiring it together', 'checking it builds']
		setView('building')
		setBuild({ title, pct: 4, steps: labels.map((label, i) => ({ label, state: i === 0 ? 'active' : 'todo' })) })
		let i = 0
		const id = window.setInterval(() => {
			i++
			setBuild(b => {
				if (!b) return b
				const steps = b.steps.map((s, idx): BuildStep => ({ ...s, state: idx < i ? 'done' : idx === i ? 'active' : 'todo' }))
				const pct = Math.min(100, Math.round((i / labels.length) * 100))
				return { ...b, steps, pct }
			})
			if (i >= labels.length) {
				window.clearInterval(id)
				window.setTimeout(() => {
					setView('home')
					setBuild(null)
					setMessages(m => [...m, { role: 'v', text: `done — ${title} is wired up. back to base.` }])
				}, 1100)
			}
		}, 1300)
	}

	const send = (text: string) => {
		const t = text.trim()
		if (!t || streaming) return
		// /build preview — demonstrates V's level-shift (real trigger comes from agent-watching)
		const buildMatch = t.match(/^\/?build\s+(.+)/i)
		if (buildMatch) {
			setMessages(m => [...m, { role: 'you', text: t }])
			setInput('')
			setChoices([])
			runBuildScene(buildMatch[1])
			return
		}
		setMessages(m => [...m, { role: 'you', text: t }, { role: 'v', text: '' }])
		setInput('')
		setChoices([])
		setStreaming(true)
		bridge.stream('vChat', { text: t }, {
			onText: full => setMessages(m => replaceLastV(m, full)),
			onFinal: payload => { setMessages(m => replaceLastV(m, String(payload ?? '').trim() || '…')); setStreaming(false) },
			onError: err => { setMessages(m => replaceLastV(m, `⚠ ${err}`)); setStreaming(false) },
			onAbort: () => setStreaming(false),
		})
	}

	return (
		<div className="term">
			<div className="statusline">
				<span><span className="dot">●</span> V</span>
				<span className="muted">{connected ? 'context-bridge online' : 'standalone'}</span>
			</div>

			{view === 'building' && build ? (
				<BuildingView title={build.title} steps={build.steps} pct={build.pct} onBack={goHome} />
			) : (
			<div className="main">
				<div className="col-left">
					<div className="transcript" ref={scrollRef}>
						{messages.map((m, i) => (
							<div key={i} className="line">
								<span className={`pfx pfx-${m.role}`}>{PFX[m.role]}{m.role === 'sys' ? ' ' : '>'} </span>
								<span className={`msg msg-${m.role}`}>{m.text || (m.role === 'v' && streaming ? '▍' : '')}</span>
							</div>
						))}
					</div>
					<VStage busy={false} choices={choices} onChoose={send} />
				</div>

				<div className="col-right">
					<VSidePanel connected={connected} recent={recent} skills={skills} fileCount={fileCount} />
				</div>
			</div>
			)}

			<div className="prompt">
				<span className="car">{'>'}</span>
				<input
					value={input}
					onChange={e => setInput(e.target.value)}
					onKeyDown={e => { if (e.key === 'Enter') send(input) }}
					placeholder="talk to V…"
					autoFocus
				/>
				<span className="cursor">▋</span>
			</div>
		</div>
	)
}
