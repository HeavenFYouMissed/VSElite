import { useEffect, useRef, useState } from 'react'
import { VStage, type Choice } from './components/VStage'
import { VSidePanel, type Activity, type Skill } from './components/VSidePanel'
import { useProjectBriefing } from './hooks/useVoidBridge'
import { bridge } from './lib/messagePort'

type Role = 'v' | 'you' | 'sys'
type Msg = { role: Role; text: string }

const PFX: Record<Role, string> = { v: 'v', you: 'you', sys: '··' }

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
	const scrollRef = useRef<HTMLDivElement>(null)
	const greeted = useRef(false)

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

	const send = (text: string) => {
		const t = text.trim()
		if (!t) return
		setMessages(m => [...m, { role: 'you', text: t }])
		setInput('')
		setChoices([])
		window.setTimeout(() => {
			setMessages(m => [...m, { role: 'v', text: 'on it — though my brain isn\'t plugged in yet (that\'s next). i\'m listening.' }])
		}, 280)
	}

	return (
		<div className="term">
			<div className="statusline">
				<span><span className="dot">●</span> V</span>
				<span className="muted">{connected ? 'context-bridge online' : 'standalone'}</span>
			</div>

			<div className="main">
				<div className="col-left">
					<div className="transcript" ref={scrollRef}>
						{messages.map((m, i) => (
							<div key={i} className="line">
								<span className={`pfx pfx-${m.role}`}>{PFX[m.role]}{m.role === 'sys' ? ' ' : '>'} </span>
								<span className={`msg msg-${m.role}`}>{m.text}</span>
							</div>
						))}
					</div>
					<VStage busy={false} choices={choices} onChoose={send} />
				</div>

				<div className="col-right">
					<VSidePanel connected={connected} recent={recent} skills={skills} fileCount={fileCount} />
				</div>
			</div>

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
