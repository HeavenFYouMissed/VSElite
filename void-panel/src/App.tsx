import { useEffect, useRef, useState } from 'react'
import { VStage } from './components/VStage'
import { useProjectBriefing } from './hooks/useVoidBridge'

type Role = 'v' | 'you' | 'sys'
type Msg = { role: Role; text: string }
type Choice = { label: string }

const PFX: Record<Role, string> = { v: 'v', you: 'you', sys: '··' }

export function App() {
	const { briefing, connected } = useProjectBriefing()
	const [messages, setMessages] = useState<Msg[]>([
		{ role: 'sys', text: 'V companion · boot' },
		{ role: 'sys', text: 'context-bridge · linking…' },
	])
	const [choices, setChoices] = useState<Choice[]>([])
	const [input, setInput] = useState('')
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
	}, [connected, briefing])

	useEffect(() => {
		const el = scrollRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [messages, choices])

	const send = (text: string) => {
		const t = text.trim()
		if (!t) return
		setMessages(m => [...m, { role: 'you', text: t }])
		setInput('')
		setChoices([])
		// Phase 1: V's brain isn't wired yet — acknowledge so the loop feels alive.
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

			<div className="transcript" ref={scrollRef}>
				{messages.map((m, i) => (
					<div key={i} className="line">
						<span className={`pfx pfx-${m.role}`}>{PFX[m.role]}{m.role === 'sys' ? ' ' : '>'} </span>
						<span className={`msg msg-${m.role}`}>{m.text}</span>
					</div>
				))}

				{choices.length > 0 && (
					<div className="choices">
						{choices.map((c, i) => (
							<button key={i} className="choice" onClick={() => send(c.label)}>
								<span className="k">{i + 1}</span>{c.label}
							</button>
						))}
					</div>
				)}
			</div>

			<VStage busy={false} />

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
