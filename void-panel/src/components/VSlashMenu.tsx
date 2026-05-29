export type SlashItem = { name: string; arg?: string; desc: string; kind: 'command' | 'skill' }

// The slash palette that pops up over the prompt when you type "/".
// Command names render in red (V's accent for actions); skills are listed below.
export function VSlashMenu({ items, index, onPick }: { items: SlashItem[]; index: number; onPick: (i: number) => void }) {
	if (items.length === 0) return null
	const commands = items.filter(i => i.kind === 'command')
	const skills = items.filter(i => i.kind === 'skill')

	let running = -1
	const row = (it: SlashItem) => {
		running++
		const i = running
		return (
			<button
				key={it.kind + it.name}
				className={`slash-row${i === index ? ' active' : ''}`}
				onMouseDown={e => { e.preventDefault(); onPick(i) }}
			>
				<span className="slash-name">/{it.name}{it.arg ? <span className="slash-arg"> [{it.arg}]</span> : null}</span>
				<span className="slash-desc">{it.desc}</span>
			</button>
		)
	}

	return (
		<div className="slash-menu">
			{commands.length > 0 && <div className="slash-section">commands</div>}
			{commands.map(row)}
			{skills.length > 0 && <div className="slash-section">skills</div>}
			{skills.map(row)}
		</div>
	)
}
