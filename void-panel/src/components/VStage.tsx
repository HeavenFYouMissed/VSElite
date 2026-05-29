import { useEffect, useRef, useState } from 'react'
import { VSprite } from './VSprite'

export type Choice = { label: string }
type Pos = { x: number; dir: 1 | -1; pause: number; idleBob: boolean }

// V roams his terminal floor — walks edge to edge (Mario-style), flips when he turns, and
// idle-pauses. When choices are present he steps to the left and idles while they pop up here.
export function VStage({
	busy = false,
	choices = [],
	onChoose,
}: { busy?: boolean; choices?: Choice[]; onChoose?: (label: string) => void }) {
	const [pos, setPos] = useState<Pos>({ x: 0.06, dir: 1, pause: 0, idleBob: false })
	const speed = useRef(0.011)
	speed.current = busy ? 0.02 : 0.011
	const hasChoices = choices.length > 0

	useEffect(() => {
		if (hasChoices) {
			// park V at the left and let him idle while the choices occupy the floor
			setPos(p => ({ ...p, x: 0.06, dir: 1, idleBob: true }))
			return
		}
		const id = setInterval(() => {
			setPos(p => {
				if (p.pause > 0) return { ...p, pause: p.pause - 1, idleBob: true }
				let x = p.x + p.dir * speed.current
				let dir = p.dir
				if (x > 0.93) { x = 0.93; dir = -1 }
				if (x < 0.04) { x = 0.04; dir = 1 }
				const pause = !busy && Math.random() < 0.008 ? 26 : 0
				return { x, dir, pause, idleBob: false }
			})
		}, 50)
		return () => clearInterval(id)
	}, [busy, hasChoices])

	const ground = '·  ˙  ·  ·  ˙   ·  ·  ˙  ·  ·   ˙  ·  ·  ˙  ·  ·  ˙  ·  ·  ·  ˙  ·  ·  ˙  ·'

	return (
		<div className="vstage">
			<div className="vstage-ground">{ground.repeat(3)}</div>
			<div className="vstage-actor" style={{ left: `${(pos.x * 100).toFixed(2)}%` }}>
				<VSprite cell={4} mode={pos.idleBob || hasChoices ? 'idle' : 'walk'} dir={pos.dir} />
			</div>
			{hasChoices && (
				<div className="vstage-choices">
					{choices.map((c, i) => (
						<button key={i} className="choice" onClick={() => onChoose?.(c.label)}>
							<span className="k">{i + 1}</span>{c.label}
						</button>
					))}
				</div>
			)}
		</div>
	)
}
