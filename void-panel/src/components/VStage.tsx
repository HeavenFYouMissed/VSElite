import { useEffect, useRef, useState } from 'react'
import { VSprite } from './VSprite'

// V roams his terminal floor — walks edge to edge (Mario-style), flips when he turns,
// and occasionally stops to idle-bob. When `busy` he paces faster (the agent is working).
type Pos = { x: number; dir: 1 | -1; pause: number; idleBob: boolean }

export function VStage({ busy = false }: { busy?: boolean }) {
	const [pos, setPos] = useState<Pos>({ x: 0.08, dir: 1, pause: 0, idleBob: false })
	const speed = useRef(0.011)
	speed.current = busy ? 0.02 : 0.011

	useEffect(() => {
		const id = setInterval(() => {
			setPos(p => {
				if (p.pause > 0) return { ...p, pause: p.pause - 1, idleBob: true }
				let x = p.x + p.dir * speed.current
				let dir = p.dir
				if (x > 0.93) { x = 0.93; dir = -1 }
				if (x < 0.04) { x = 0.04; dir = 1 }
				// small chance to stop and look around for a beat
				const pause = !busy && Math.random() < 0.008 ? 26 : 0
				return { x, dir, pause, idleBob: false }
			})
		}, 50)
		return () => clearInterval(id)
	}, [busy])

	// repeating ASCII floor
	const ground = '·  ˙  ·  ·  ˙   ·  ·  ˙  ·  ·   ˙  ·  ·  ˙  ·  ·  ˙  ·  ·  ·  ˙  ·  ·  ˙  ·'

	return (
		<div className="vstage">
			<div className="vstage-ground">{ground.repeat(3)}</div>
			<div
				className="vstage-actor"
				style={{ left: `calc(${(pos.x * 100).toFixed(2)}% )` }}
			>
				<VSprite cell={4} mode={pos.idleBob ? 'idle' : 'walk'} dir={pos.dir} />
			</div>
		</div>
	)
}
