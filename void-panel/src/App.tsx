import { useEffect, useRef, useState } from 'react'
import { VStage, type Choice } from './components/VStage'
import { VSidePanel, type Activity, type Skill } from './components/VSidePanel'
import { BuildingView, type BuildStep } from './components/BuildingView'
import { VSlashMenu, type SlashItem } from './components/VSlashMenu'
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

const SLASH_COMMANDS: SlashItem[] = [
	{ name: 'build', arg: 'thing', desc: 'V builds it (scene preview)', kind: 'command' },
	{ name: 'refactor', arg: 'prompt', desc: 'sharpen a prompt for the agent', kind: 'command' },
	{ name: 'skill', arg: 'task', desc: 'find or make a skill', kind: 'command' },
	{ name: 'watch', desc: 'keep an eye on the agent', kind: 'command' },
	{ name: 'clear', desc: 'clear the transcript', kind: 'command' },
	{ name: 'help', desc: 'list commands', kind: 'command' },
]

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
	const [slashIndex, setSlashIndex] = useState(0)

	const goHome = () => { setView('home'); setBuild(null) }

	// slash palette: open while typing the command token (before the first space)
	const slashItems: SlashItem[] = (() => {
		if (!input.startsWith('/') || input.includes(' ')) return []
		const q = input.slice(1).toLowerCase()
		const skillItems: SlashItem[] = skills.map(s => ({ name: s.name, desc: 'your skill', kind: 'skill' }))
		return [...SLASH_COMMANDS, ...skillItems].filter(i => i.name.toLowerCase().includes(q))
	})()
	const slashOpen = slashItems.length > 0
	useEffect(() => { setSlashIndex(0) }, [input])

	const pickSlash = (i: number) => {
		const it = slashItems[i]
		if (!it) return
		if (it.kind === 'skill') { setInput(`/skill ${it.name} `); return }
		if (it.arg) { setInput(`/${it.name} `); return } // wait for the argument
		runCommand(it.name, '')
		setInput('')
	}

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

	const askV = (text: string, displayText?: string) => {
		setMessages(m => [...m, { role: 'you', text: displayText ?? text }, { role: 'v', text: '' }])
		setStreaming(true)
		bridge.stream('vChat', { text }, {
			onText: full => setMessages(m => replaceLastV(m, full)),
			onFinal: payload => { setMessages(m => replaceLastV(m, String(payload ?? '').trim() || '…')); setStreaming(false) },
			onError: err => { setMessages(m => replaceLastV(m, `⚠ ${err}`)); setStreaming(false) },
			onAbort: () => setStreaming(false),
		})
	}

	// slash commands: some run locally, others reframe the message for V's brain
	const runCommand = (name: string, arg: string): boolean => {
		switch (name) {
			case 'clear':
				setMessages([{ role: 'sys', text: 'transcript cleared' }]); setChoices([]); return true
			case 'help':
				setMessages(m => [...m, { role: 'sys', text: 'commands: ' + SLASH_COMMANDS.map(c => '/' + c.name).join('  ') }]); return true
			case 'watch':
				setMessages(m => [...m, { role: 'v', text: "watching the agent — i'll log what it does and flag anything worth a skill or a fix." }]); return true
			case 'build':
				if (!arg) return false
				setMessages(m => [...m, { role: 'you', text: `/build ${arg}` }]); runBuildScene(arg); return true
			case 'refactor':
				if (!arg) return false
				askV(`refactor this into a sharp, detailed prompt i can send to the coding agent. return ONLY the rewritten prompt, no preamble:\n\n${arg}`, `/refactor ${arg}`); return true
			case 'skill':
				if (!arg) return false
				askV(`act as my skill concierge for this task: "${arg}". tell me if an existing skill fits, or sketch a new SKILL.md (name + description + steps). keep it tight.`, `/skill ${arg}`); return true
			default:
				return false
		}
	}

	const send = (text: string) => {
		const t = text.trim()
		if (!t || streaming) return
		const slash = t.match(/^\/(\w[\w-]*)\s*(.*)$/)
		if (slash) {
			const handled = runCommand(slash[1].toLowerCase(), slash[2].trim())
			if (handled) { setInput(''); setChoices([]); return }
			// a /skill-name shortcut → treat as skill concierge for that named skill
			if (skills.some(s => s.name === slash[1])) { setInput(''); setChoices([]); askV(`use my skill "${slash[1]}" — ${slash[2].trim() || 'apply it to what we\'re doing'}`, t); return }
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

			<div className="prompt-wrap">
				{slashOpen && <VSlashMenu items={slashItems} index={slashIndex} onPick={pickSlash} />}
				<div className="prompt">
					<span className="car">{'>'}</span>
					<input
						value={input}
						onChange={e => setInput(e.target.value)}
						onKeyDown={e => {
							if (slashOpen) {
								if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => (i + 1) % slashItems.length); return }
								if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex(i => (i - 1 + slashItems.length) % slashItems.length); return }
								if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickSlash(slashIndex); return }
								if (e.key === 'Escape') { e.preventDefault(); setInput(''); return }
							}
							if (e.key === 'Enter') send(input)
						}}
						placeholder="talk to V…  (/ for commands)"
						autoFocus
					/>
					<span className="cursor">▋</span>
				</div>
			</div>
		</div>
	)
}
