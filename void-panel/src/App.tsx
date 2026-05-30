import { useEffect, useRef, useState, useCallback } from 'react'
import { VStage, type Choice } from './components/VStage'
import { VSidePanel, type Activity, type Skill } from './components/VSidePanel'
import { BuildingView, type BuildStep } from './components/BuildingView'
import { VSlashMenu, type SlashItem } from './components/VSlashMenu'
import { VSkillsView, type CatalogSkill } from './components/VSkillsView'
import { VGitView } from './components/VGitView'
import { VQuestions, type VQuestion } from './components/VQuestions'
import { useProjectBriefing } from './hooks/useVoidBridge'
import { bridge, type AgentEvent } from './lib/messagePort'

// ─── Voice system ────────────────────────────────────────────────────────────
function useVoice() {
	const [enabled, setEnabled] = useState(() => localStorage.getItem('v.voice') === 'on')
	const speakingRef = useRef(false)

	const toggle = useCallback((on?: boolean) => {
		const next = on ?? !enabled
		setEnabled(next)
		localStorage.setItem('v.voice', next ? 'on' : 'off')
		if (!next) stop()
	}, [enabled])

	const chooseVoice = useCallback(async (): Promise<SpeechSynthesisVoice | null> => {
		if (!('speechSynthesis' in window)) return null
		let voices = speechSynthesis.getVoices()
		if (!voices.length) {
			await new Promise<void>(r => { speechSynthesis.onvoiceschanged = () => r(); setTimeout(r, 2000) })
			voices = speechSynthesis.getVoices()
		}
		return voices.find(v => /Google UK English Male/i.test(v.name)) ||
			voices.find(v => /Daniel/i.test(v.name)) ||
			voices.find(v => /Microsoft Mark/i.test(v.name)) ||
			voices.find(v => /Microsoft David/i.test(v.name)) ||
			voices.find(v => /Alex/i.test(v.name)) ||
			voices.find(v => /Google US English/i.test(v.name)) ||
			voices.find(v => /^en[-_]/i.test(v.lang) && /male/i.test(v.name)) ||
			voices.find(v => /^en[-_]/i.test(v.lang)) ||
			voices[0] || null
	}, [])

	const speak = useCallback(async (text: string) => {
		if (!enabled || !('speechSynthesis' in window)) return
		const clean = text.replace(/[·•▸╱#*`\[\]]/g, '').replace(/\n+/g, '. ').trim()
		if (!clean || clean.length < 3) return
		const utter = new SpeechSynthesisUtterance(clean)
		const voice = await chooseVoice()
		if (voice) { utter.voice = voice; utter.lang = voice.lang || 'en-US' }
		else { utter.lang = 'en-US' }
		utter.pitch = 0.95
		utter.rate = 1.05
		utter.volume = 0.85
		utter.onstart = () => { speakingRef.current = true }
		utter.onend = () => { speakingRef.current = false }
		utter.onerror = () => { speakingRef.current = false }
		speechSynthesis.cancel()
		speechSynthesis.speak(utter)
	}, [enabled, chooseVoice])

	const stop = useCallback(() => {
		if ('speechSynthesis' in window) speechSynthesis.cancel()
		speakingRef.current = false
	}, [])

	return { enabled, toggle, speak, stop, speakingRef }
}
// ─────────────────────────────────────────────────────────────────────────────

type Role = 'v' | 'you' | 'sys'
type Msg = { role: Role; text: string }
type VView = 'home' | 'building' | 'skills' | 'git'
type BuildState = { title: string; steps: BuildStep[]; pct: number }
type MemInfo = { profileLines?: number; journalEntries?: number; projectId?: string }
type SandboxFile = { path: string; bytes: number }

const PFX: Record<Role, string> = { v: 'v', you: 'you', sys: '··' }

// tools that count as "building" (V shifts into the building scene); others are just activity
const BUILD_TOOLS = new Set(['create_file_or_folder', 'delete_file_or_folder', 'rewrite_file', 'edit_file', 'run_command', 'run_persistent_command', 'git_commit'])
const humanizeTool = (name: string): string => {
	const map: Record<string, string> = {
		edit_file: 'editing a file', rewrite_file: 'rewriting a file', create_file_or_folder: 'creating files',
		delete_file_or_folder: 'deleting files', run_command: 'running a command', run_persistent_command: 'running a command',
		read_file: 'reading a file', ls_dir: 'listing files', get_dir_tree: 'mapping the tree',
		search_for_files: 'searching', search_pathnames_only: 'searching', search_in_file: 'searching a file',
		semantic_search: 'semantic search', find_text: 'searching', web_search: 'searching the web',
		get_symbol_context: 'pulling symbol context', get_call_graph: 'tracing call graph', pack_context: 'packing context',
		list_notes: 'reading notes', get_project_briefing: 'reading the briefing',
		git_commit: 'committing', read_lint_errors: 'checking lint',
	}
	return map[name] || name.replace(/_/g, ' ')
}

const SLASH_COMMANDS: SlashItem[] = [
	{ name: 'home', desc: 'back to V main menu', kind: 'command' },
	{ name: 'voice', desc: 'toggle V voice on/off', kind: 'command' },
	{ name: 'skills', desc: 'browse + mount skills onto the agent', kind: 'command' },
	{ name: 'skill-create', arg: 'task', desc: 'author a new skill for the agent', kind: 'command' },
	{ name: 'start', arg: 'idea', desc: 'start a project — structured intake', kind: 'command' },
	{ name: 'project', arg: 'idea', desc: 'start a project (alias)', kind: 'command' },
	{ name: 'git', desc: 'open git panel — branch, status, log', kind: 'command' },
	{ name: 'diff', desc: 'show uncommitted changes', kind: 'command' },
	{ name: 'commit', arg: 'msg', desc: 'compose + run a git commit', kind: 'command' },
	{ name: 'pr', arg: 'context', desc: 'draft a PR description', kind: 'command' },
	{ name: 'sprite', desc: 'open image → sprite studio', kind: 'command' },
	{ name: 'asset', desc: 'open alien sprite studio', kind: 'command' },
	{ name: 'prompt', arg: 'prompt', desc: 'sharpen a prompt for the agent', kind: 'command' },
	{ name: 'security', arg: 'prompt', desc: 'rephrase for security + correct terms', kind: 'command' },
	{ name: 'run', arg: 'task', desc: 'hand a task to the coding agent', kind: 'command' },
	{ name: 'remember', arg: 'fact', desc: "save a fact to V's memory", kind: 'command' },
	{ name: 'recall', arg: 'topic', desc: 'search what V remembers', kind: 'command' },
	{ name: 'build', arg: 'thing', desc: 'V builds it (scene preview)', kind: 'command' },
	{ name: 'skill', arg: 'task', desc: 'find or sketch a skill', kind: 'command' },
	{ name: 'watch', desc: 'keep an eye on the agent', kind: 'command' },
	{ name: 'clear', desc: 'clear the transcript', kind: 'command' },
	{ name: 'help', desc: 'list commands', kind: 'command' },
]

// V ends an offer with a trailing line `CHOICES: a | b | c` — parse it into clickable chips.
function parseChoices(text: string): { body: string; choices: Choice[] } {
	const m = text.match(/(?:^|\n)\s*CHOICES:\s*([^\n]+?)\s*$/i)
	if (!m || m.index == null) return { body: text, choices: [] }
	const choices = m[1].split('|').map(s => ({ label: s.trim() })).filter(c => c.label)
	return { body: text.slice(0, m.index).trimEnd(), choices }
}

// In auto-pilot, V ends with `RUN: <prompt>` to dispatch to the agent without a confirm.
function parseRun(text: string): { body: string; run: string | null } {
	const m = text.match(/(?:^|\n)\s*RUN:\s*([^\n]+?)\s*$/i)
	if (!m || m.index == null) return { body: text, run: null }
	return { body: text.slice(0, m.index).trimEnd(), run: m[1].trim() }
}

// Start-a-project: V emits a fenced ```vquestions JSON array``` the panel renders as a form.
function parseVQuestions(text: string): { body: string; questions: VQuestion[] } {
	const m = text.match(/```vquestions\s*([\s\S]*?)```/i)
	if (!m || m.index == null) return { body: text, questions: [] }
	let questions: VQuestion[] = []
	try {
		const parsed = JSON.parse(m[1].trim())
		if (Array.isArray(parsed)) questions = parsed
	} catch { /* malformed block — ignore */ }
	const body = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim()
	return { body, questions }
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
	const [catalog, setCatalog] = useState<CatalogSkill[]>([])
	const [catalogLoading, setCatalogLoading] = useState(false)
	const [mounting, setMounting] = useState<string | null>(null)
	const [autoPilot, setAutoPilot] = useState(false)
	const [studioUrl, setStudioUrl] = useState<string | null>(null)
	const [ctxUsed, setCtxUsed] = useState(0)
	const [ctxMax, setCtxMax] = useState(0)
	const [pendingQuestions, setPendingQuestions] = useState<VQuestion[] | null>(null)
	const [sandboxFiles, setSandboxFiles] = useState<SandboxFile[]>([])
	const [memInfo, setMemInfo] = useState<MemInfo | null>(null)
	const scrollRef = useRef<HTMLDivElement>(null)
	const greeted = useRef(false)
	const streamingRef = useRef(false)
	const lastProposed = useRef<string | null>(null)
	const awaitingPrompt = useRef(false)
	useEffect(() => { streamingRef.current = streaming }, [streaming])
	const [slashIndex, setSlashIndex] = useState(0)
	const voice = useVoice()

	const goHome = () => { setView('home'); setBuild(null) }

	const memoryLine = memInfo
		? `${memInfo.journalEntries ?? 0} memories · ${memInfo.profileLines ?? 0} profile lines`
		: undefined

	const refreshMemorySummary = () => {
		bridge.call<MemInfo>('vMemorySummary', {})
			.then(s => setMemInfo(s ?? null))
			.catch(() => { /* standalone / no folder */ })
	}

	const refreshSandbox = () => {
		bridge.call<{ files?: SandboxFile[] }>('vSandboxList', {})
			.then(r => setSandboxFiles(r?.files ?? []))
			.catch(() => { /* none */ })
	}

	// Git state
	const [gitInfo, setGitInfo] = useState<{ branch: string; status: string; log: string; branches: string } | null>(null)
	const refreshGit = () => {
		Promise.all([
			bridge.call<{ branch: string; branches: string }>('vGitBranch', {}),
			bridge.call<{ status: string }>('vGitStatus', {}),
			bridge.call<{ log: string }>('vGitLog', { count: 10 }),
		]).then(([br, st, lg]) => {
			setGitInfo({
				branch: br?.branch ?? '(unknown)',
				status: st?.status ?? '(clean)',
				log: lg?.log ?? '',
				branches: br?.branches ?? '',
			})
		}).catch(() => setGitInfo(null))
	}

	// Skills page: list editor-agent skills (categorised), then mount the chosen one onto the agent.
	const openSkills = () => {
		setView('skills')
		setCatalogLoading(true)
		bridge.call<{ skills?: CatalogSkill[] }>('vListSkills', {})
			.then(r => setCatalog(r?.skills ?? []))
			.catch(() => setCatalog([]))
			.finally(() => setCatalogLoading(false))
	}
	const mountSkill = (id: string) => {
		setMounting(id)
		setMessages(m => [...m, { role: 'sys', text: `· mounting "${id}" onto the agent` }])
		bridge.call('vMountSkill', { name: id })
			.then(() => {
				setMessages(m => [...m, { role: 'v', text: `mounted ${id}. the agent has it now and will follow it for relevant work.` }])
				setView('home')
			})
			.catch(() => setMessages(m => [...m, { role: 'sys', text: `⚠ couldn't mount ${id}` }]))
			.finally(() => setMounting(null))
	}

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
			{ role: 'v', text: `hey — i'm V. i'm watching ${root}, and i remember you across projects. tell me what you wanna build, or point me at the agent.` },
		])
		setChoices([
			{ label: 'sharpen a prompt' },
			{ label: 'start a project' },
			{ label: 'git status' },
			{ label: 'watch the agent' },
			{ label: 'browse skills' },
			{ label: 'make an asset' },
			{ label: 'help' },
		])
		setRecent([
			{ when: 'now', what: 'linked context-bridge' },
			{ when: '1m', what: `opened ${root}` },
		])
		// Pull V's real workspace (.v/) — created on first run by the host.
		bridge.call<{ fileCount?: number; skills?: Skill[] }>('vWorkspaceSummary', {})
			.then(s => { setSkills(s?.skills ?? []); setFileCount(s?.fileCount ?? 0) })
			.catch(() => { /* standalone / no folder */ })
		refreshMemorySummary()
		refreshSandbox()
		refreshGit()
	}, [connected, briefing])

	// Context-window meter: the host pushes {used,max} after each V turn.
	useEffect(() => {
		bridge.onCtx(c => { setCtxUsed(c.used); setCtxMax(c.max) })
	}, [])

	// Sprite/asset studio: the embedded tool posts its export back; relay it into V's chat.
	useEffect(() => {
		const onMsg = (e: MessageEvent) => {
			if (e.data?.type === 'vStudioExport') {
				setStudioUrl(null)
				const kind = e.data.kind ?? 'data'
				const raw = e.data.data
				const summary = raw && typeof raw === 'object'
					? Object.keys(raw).map(k => `${k}: ${typeof (raw as any)[k] === 'string' ? `${String((raw as any)[k]).length} chars` : 'data'}`).join(', ')
					: String(raw ?? '').slice(0, 400)
				setMessages(m => [...m, { role: 'v', text: `got your ${kind} from the studio (${summary}). tell me where it should go — a logo, a game asset, a ui sprite — and i'll stage it or hand it to the agent.` }])
			}
		}
		window.addEventListener('message', onMsg)
		return () => window.removeEventListener('message', onMsg)
	}, [])

	useEffect(() => {
		const el = scrollRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [messages])

	// Agent-watching: react to what the coding agent is doing (recent activity + scene shift).
	useEffect(() => {
		bridge.onAgentEvent((e: AgentEvent) => {
			if (e.kind === 'idle') {
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

	// update the trailing V message, or start a new one if the last line isn't V's
	const upsertV = (text: string) => setMessages(m => {
		const copy = m.slice()
		if (copy.length && copy[copy.length - 1].role === 'v') copy[copy.length - 1] = { role: 'v', text }
		else copy.push({ role: 'v', text })
		return copy
	})

	const runMainAgent = (prompt: string) => {
		setMessages(m => [...m, { role: 'sys', text: `· handed to the agent: ${prompt.length > 80 ? prompt.slice(0, 80) + '…' : prompt}` }])
		bridge.call('vRunAgent', { prompt }).catch(() => setMessages(m => [...m, { role: 'sys', text: '⚠ could not reach the agent' }]))
	}

	// Scene system: V shifts into a dedicated "level" for major work, then returns home.
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

	// V's final reply: pull out RUN: / vquestions / CHOICES: directives, then render.
	const finishVReply = (raw: string) => {
		let text = String(raw ?? '').trim()
		const runParsed = parseRun(text)
		text = runParsed.body
		if (runParsed.run && autoPilot) runMainAgent(runParsed.run)
		const qParsed = parseVQuestions(text)
		text = qParsed.body
		if (qParsed.questions.length) setPendingQuestions(qParsed.questions)
		const { body, choices: parsed } = parseChoices(text)
		if (awaitingPrompt.current && body) {
			lastProposed.current = body
			awaitingPrompt.current = false
		}
		upsertV(body || '')
		// don't leave a blank V bubble — if body is empty (tool-only turn), remove the trailing empty V message
		if (!body) {
			setMessages(m => {
				const copy = m.slice()
				if (copy.length && copy[copy.length - 1].role === 'v' && !copy[copy.length - 1].text) copy.pop()
				return copy
			})
		}
		const extra: Choice[] = [...parsed]
		if (lastProposed.current && !extra.some(c => /send to agent/i.test(c.label))) extra.unshift({ label: 'send to agent' })
		if (lastProposed.current && !extra.some(c => /refine/i.test(c.label))) extra.push({ label: 'refine' })
		if (!extra.some(c => /watch.*chat/i.test(c.label))) extra.push({ label: 'watch the chat' })
		if (!extra.some(c => /save this/i.test(c.label))) extra.push({ label: 'save this' })
		setChoices(extra)
		setStreaming(false)
		refreshMemorySummary()
		// Speak V's reply if voice is enabled
		if (body) voice.speak(body)
		refreshSandbox()
	}

	const askV = (text: string, displayText?: string) => {
		setMessages(m => [...m, { role: 'you', text: displayText ?? text }])
		setStreaming(true)
		setPendingQuestions(null)
		bridge.stream('vChat', { text }, {
			onText: full => { if (full && full.trim()) upsertV(full) },
			onTool: name => setMessages(m => [...m, { role: 'sys', text: `· ${humanizeTool(name)}` }]),
			onFinal: payload => finishVReply(String(payload ?? '')),
			onError: err => { setMessages(m => [...m, { role: 'sys', text: `⚠ ${err}` }]); setStreaming(false) },
			onAbort: () => setStreaming(false),
		})
	}

	// slash commands: some run locally, others reframe the message for V's brain
	const runCommand = (name: string, arg: string): boolean => {
		switch (name) {
			case 'clear':
				setMessages([{ role: 'sys', text: 'transcript cleared' }]); setChoices([]); return true
			case 'home':
				goHome()
				setChoices([
					{ label: 'sharpen a prompt' },
					{ label: 'start a project' },
					{ label: 'git status' },
					{ label: 'watch the agent' },
					{ label: 'browse skills' },
					{ label: 'make an asset' },
					{ label: 'help' },
				])
				return true
			case 'help':
				setMessages(m => [...m, { role: 'sys', text: 'commands: ' + SLASH_COMMANDS.map(c => '/' + c.name).join('  ') }]); return true
			case 'voice': {
				const next = arg === 'off' ? false : arg === 'on' ? true : !voice.enabled
				voice.toggle(next)
				setMessages(m => [...m, { role: 'sys', text: `· voice ${next ? 'on' : 'off'}` }])
				return true
			}
			case 'stop':
				voice.stop(); return true
			case 'skills':
				openSkills(); return true
			case 'watch':
				setMessages(m => [...m, { role: 'v', text: "watching the agent — i'll log what it does and flag anything worth a skill or a fix." }]); return true
			case 'build':
				if (!arg) return false
				setMessages(m => [...m, { role: 'you', text: `/build ${arg}` }]); runBuildScene(arg); return true
			case 'run':
				if (!arg) return false
				runMainAgent(arg); return true
			case 'start':
			case 'project':
				askV(arg
					? `start a project intake for: "${arg}". ask 3-5 grouped questions as a fenced \`\`\`vquestions\`\`\` JSON array block, then assemble a spec.`
					: 'start a project intake: ask me 3-5 grouped questions as a fenced ```vquestions``` JSON array block to scope what i want to build.', arg ? `/start ${arg}` : '/start'); return true
			case 'remember':
				if (!arg) return false
				bridge.call('vRemember', { text: arg })
					.then(() => { setMessages(m => [...m, { role: 'sys', text: '· saved to memory' }]); refreshMemorySummary() })
					.catch(() => setMessages(m => [...m, { role: 'sys', text: '⚠ could not save' }]))
				return true
			case 'recall':
				bridge.call<{ entries?: { text: string }[] }>('vRecall', { topic: arg || 'recent' })
					.then(r => {
						const lines = (r?.entries ?? []).map(e => `- ${e.text}`).join('\n') || '(nothing remembered yet)'
						setMessages(m => [...m, { role: 'v', text: lines }])
					})
					.catch(() => setMessages(m => [...m, { role: 'sys', text: '⚠ recall failed' }]))
				return true
			case 'sprite':
				setStudioUrl('/tools/image-to-sprite.html'); return true
			case 'asset':
				setStudioUrl('/tools/alien.html'); return true
			case 'prompt':
			case 'refactor':
				if (!arg) return false
				awaitingPrompt.current = true
				askV(`refactor this into a sharp, detailed prompt i can send to the coding agent. return ONLY the rewritten prompt, no preamble:\n\n${arg}`, `/prompt ${arg}`); return true
			case 'security':
				if (!arg) return false
				askV(`rewrite this prompt for the coding agent through two lenses: (1) fix wrong or imprecise technical terminology so the agent doesn't trip up, (2) add security hardening (auth, secrets, input validation, least privilege). return the rewritten prompt, then ONE line noting what you corrected:\n\n${arg}`, `/security ${arg}`); return true
			case 'skill-create':
				if (!arg) return false
				askV(`author a new skill for the CODING AGENT to use for: "${arg}". write a spec-compliant SKILL.md with frontmatter (name + description + category) and a tight body of concrete steps. it will live at .agents/skills/<category>/<name>/SKILL.md.`, `/skill-create ${arg}`); return true
			case 'skill':
				if (!arg) return false
				askV(`act as my skill concierge for this task: "${arg}". tell me if an existing skill fits, or sketch a new SKILL.md (name + description + category + steps). keep it tight.`, `/skill ${arg}`); return true
			case 'git':
			case 'repo': {
				setMessages(m => [...m, { role: 'you', text: '/git' }])
				setView('git')
				refreshGit()
				return true
			}
			case 'diff':
				setMessages(m => [...m, { role: 'you', text: '/diff' }])
				bridge.call<{ diff: string }>('vGitDiff', { staged: !!arg?.includes('staged') })
					.then(r => {
						const d = r?.diff ?? '(no changes)'
						setMessages(m => [...m, { role: 'sys', text: d.length > 2000 ? d.slice(0, 2000) + '\n... (truncated)' : d }])
					})
					.catch(() => setMessages(m => [...m, { role: 'sys', text: '⚠ git diff failed' }]))
				return true
			case 'commit':
				if (!arg) {
					askV('look at the current git diff and status, then compose a good commit message. return ONLY the message, no preamble. add a trailer line: "Assisted-by: V via DeepSeek"', '/commit'); return true
				}
				bridge.call<{ output: string }>('callTool', { toolName: 'git_commit', params: { message: arg + '\n\nAssisted-by: V via DeepSeek' } })
					.then(r => setMessages(m => [...m, { role: 'sys', text: `· committed: ${r?.output ?? 'done'}` }]))
					.catch(e => setMessages(m => [...m, { role: 'sys', text: `⚠ commit failed: ${e}` }]))
				return true
			case 'pr':
				askV(`read the git log (last 10 commits) and git diff against main. then draft a PR title and description in markdown format. the description should have: ## Summary (1-3 bullet points), ## Changes (list of files), ## Test plan. return ONLY the PR body.${arg ? ` context: ${arg}` : ''}`, '/pr'); return true
			default:
				return false
		}
	}

	// greeting/choice chips → route to a command, an action, or send to V's brain
	const runChoice = (label: string) => {
		const norm = label.toLowerCase()
		if (norm === 'send to agent' && lastProposed.current) {
			runMainAgent(lastProposed.current); lastProposed.current = null; setChoices([]); return
		}
		if (norm === 'refine' && lastProposed.current) {
			askV(`the user wants you to refine this prompt further. improve clarity, be more specific about files/paths, add constraints, tighten scope. return ONLY the improved prompt:\n\n${lastProposed.current}`, 'refine the prompt')
			return
		}
		if (norm === 'watch the chat') {
			runCommand('watch', ''); setChoices([]); return
		}
		if (norm === 'save this') {
			const lastV = [...messages].reverse().find(m => m.role === 'v')
			if (lastV?.text) bridge.call('vRemember', { text: lastV.text }).then(refreshMemorySummary).catch(() => { /* */ })
			setMessages(m => [...m, { role: 'sys', text: '· saved to memory' }])
			setChoices([]); return
		}
		switch (label) {
			case 'browse skills': openSkills(); return
			case 'make a skill': setInput('/skill-create '); return
			case 'start a project': runCommand('start', ''); setChoices([]); return
			case 'git status': runCommand('git', ''); setChoices([]); return
			case 'sharpen a prompt': setInput('/prompt '); return
			case 'security rephrase': setInput('/security '); return
			case 'watch the agent': runCommand('watch', ''); setChoices([]); return
			case 'make an asset': runCommand('sprite', ''); setChoices([]); return
			case 'help': runCommand('help', ''); return
			default: send(label)
		}
	}

	const send = (text: string) => {
		const t = text.trim()
		if (!t) return
		// If V is streaming, abort it first then send the new message
		if (streaming) {
			bridge.call('vAbort', {}).catch(() => { /* best effort */ })
			setStreaming(false)
			voice.stop()
			setMessages(m => [...m, { role: 'sys', text: '· interrupted' }])
		}
		const slash = t.match(/^\/(\w[\w-]*)\s*(.*)$/)
		if (slash) {
			const handled = runCommand(slash[1].toLowerCase(), slash[2].trim())
			if (handled) { setInput(''); setChoices([]); return }
			if (skills.some(s => s.name === slash[1])) { setInput(''); setChoices([]); askV(`use my skill "${slash[1]}" — ${slash[2].trim() || 'apply it to what we\'re doing'}`, t); return }
		}
		setInput('')
		setChoices([])
		askV(t)
	}

	return (
		<div className="term">
			<div className="statusline">
				<span><span className="dot">●</span> V</span>
				<span className="muted">{connected ? 'context-bridge online' : 'standalone'}</span>
				<button
					type="button"
					className={`autopilot-toggle ${autoPilot ? 'on' : ''}`}
					onClick={() => {
						const next = !autoPilot
						setAutoPilot(next)
						bridge.call('vSetAutoPilot', { on: next }).catch(() => { /* */ })
					}}
				>
					auto-pilot {autoPilot ? 'on' : 'off'}
				</button>
			</div>

			{studioUrl && (
				<div className="studio-overlay">
					<iframe title="V studio" src={studioUrl} className="studio-frame" />
					<button type="button" className="studio-exit" onClick={() => setStudioUrl(null)}>✕ exit</button>
				</div>
			)}

			{view === 'building' && build ? (
				<BuildingView title={build.title} steps={build.steps} pct={build.pct} onBack={goHome} />
			) : view === 'skills' ? (
				<VSkillsView
					skills={catalog}
					loading={catalogLoading}
					mounting={mounting}
					onMount={mountSkill}
					onMake={() => { goHome(); setInput('/skill-create ') }}
					onBack={goHome}
				/>
			) : view === 'git' ? (
				<VGitView info={gitInfo} onRefresh={refreshGit} onBack={goHome} onCommand={(cmd) => { goHome(); send(cmd) }} />
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
						{pendingQuestions && pendingQuestions.length > 0 && (
							<VQuestions
								questions={pendingQuestions}
								onSkip={() => { setPendingQuestions(null); askV('skip the questions — use sensible defaults and assemble the spec.') }}
								onSubmit={ans => {
									setPendingQuestions(null)
									const parts = Object.entries(ans).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
									askV(`answers — ${parts.join('; ')}`)
								}}
							/>
						)}
					</div>
					<VStage busy={streaming} choices={choices} onChoose={runChoice} />
				</div>

				<div className="col-right">
					<VSidePanel
						connected={connected}
						recent={recent}
						skills={skills}
						fileCount={fileCount}
						ctxUsed={ctxUsed}
						ctxMax={ctxMax}
						memorySummary={memoryLine}
						sandboxFiles={sandboxFiles}
						onApproveSandbox={path => {
							bridge.call('vSandboxApprove', { path })
								.then(() => { refreshSandbox(); setMessages(m => [...m, { role: 'sys', text: `· applied ${path}` }]) })
								.catch(() => setMessages(m => [...m, { role: 'sys', text: `⚠ could not apply ${path}` }]))
						}}
						gitSummary={gitInfo ? {
							branch: gitInfo.branch,
							dirty: !gitInfo.status.includes('clean') && gitInfo.status.trim().length > 0,
							fileCount: gitInfo.status.split('\n').filter(Boolean).length,
						} : null}
						onGitClick={() => { setView('git'); refreshGit() }}
					/>
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
					<button
						type="button"
						className={`voice-pill ${voice.enabled ? 'voice-pill--on' : ''}`}
						onClick={() => voice.toggle()}
						title={voice.enabled ? 'voice on — click to mute' : 'voice off — click to enable'}
					>
						{voice.enabled ? '🔊' : '🔇'}
					</button>
					<span className="cursor">▋</span>
				</div>
			</div>
		</div>
	)
}
