import React, { useEffect, useState } from 'react'

// V — the green pixel invader, rendered from a flat grid (crisp at any size).
// . transparent · g green body · d eye/mouth · r red V
const FRAME_A = [
	'....ggggggg....', '..ggggggggggg..', '.ggggggggggggg.', 'ggggggggggggggg',
	'ggggggggggggggg', 'ggddgggggggddgg', 'ggddgggggggddgg', 'ggggggggggggggg',
	'.gggggdddggggg.', '..ggggggggggg..', 'gg.ggggggggg.gg', 'gg.ggggggggg.gg',
	'...ggrgggrgg...', '...gggrgrggg...', '...ggggrgggg...', '...gg.....gg...', '...gg.....gg...',
]
const FRAME_B = [
	'....ggggggg....', '..ggggggggggg..', '.ggggggggggggg.', 'ggggggggggggggg',
	'ggggggggggggggg', 'ggddgggggggddgg', 'ggddgggggggddgg', 'ggggggggggggggg',
	'.gggggdddggggg.', 'gg.ggggggggg.gg', 'gg.ggggggggg.gg', '...ggggggggg...',
	'...ggrgggrgg...', '...gggrgrggg...', '...ggggrgggg...', '....gg...gg....', '....gg...gg....',
]

const PALETTE: Record<string, string> = { g: '#4ea03b', d: '#0c1016', r: '#d6392c' }

export type SpriteMode = 'idle' | 'walk' | 'static'

export function VSprite({
	cell = 8,
	mode = 'idle',
	dir = 1,
	showV = true,
}: { cell?: number; mode?: SpriteMode; dir?: 1 | -1; showV?: boolean }) {
	const [t, setT] = useState(0)
	useEffect(() => {
		if (mode === 'static') return
		const id = setInterval(() => setT(v => v + 1), 110)
		return () => clearInterval(id)
	}, [mode])

	const grid = mode === 'walk' && t % 2 ? FRAME_B : FRAME_A
	const cols = grid[0].length, rows = grid.length
	const bob = mode === 'idle' ? Math.round(Math.sin(t / 3)) * cell * 0.18 : mode === 'walk' ? (t % 2 ? cell * 0.16 : 0) : 0

	const rects: React.ReactNode[] = []
	grid.forEach((line, y) =>
		[...line].forEach((chRaw, x) => {
			let ch = chRaw
			if (ch === '.') return
			if (ch === 'r' && !showV) ch = 'g'
			rects.push(<rect key={x + '-' + y} x={x * cell} y={y * cell} width={cell} height={cell} fill={PALETTE[ch]} />)
		}),
	)

	return (
		<svg width={cols * cell} height={rows * cell} viewBox={`0 0 ${cols * cell} ${rows * cell}`} shapeRendering="crispEdges"
			style={{ imageRendering: 'pixelated', transform: `translateY(${bob}px) scaleX(${dir})`, transition: 'transform .09s linear', display: 'block' }}>
			{rects}
		</svg>
	)
}
