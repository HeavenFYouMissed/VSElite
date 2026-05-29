import { useEffect, useState } from 'react'

// A little ASCII screensaver for V's visual area — a slow twinkle field that occasionally
// flashes a "V". Cheap (one interval), terminal vibe.
const W = 26
const H = 6
const TWINKLE = [' ', ' ', ' ', ' ', ' ', '·', '·', '˙', '.', '*', '+']

const V_GLYPH = [
	'                          ',
	'  █   █                   ',
	'  █   █   the companion   ',
	'   █ █                    ',
	'    █     v3code          ',
	'                          ',
]

export function VScreensaver() {
	const [rows, setRows] = useState<string[]>(V_GLYPH)
	useEffect(() => {
		let t = 0
		const id = setInterval(() => {
			t++
			// every ~7s, hold the V glyph for a beat; otherwise twinkle
			if (t % 26 < 5) { setRows(V_GLYPH); return }
			const out: string[] = []
			for (let y = 0; y < H; y++) {
				let s = ''
				for (let x = 0; x < W; x++) s += TWINKLE[Math.floor(Math.random() * TWINKLE.length)]
				out.push(s)
			}
			setRows(out)
		}, 280)
		return () => clearInterval(id)
	}, [])
	return <pre className="screensaver">{rows.join('\n')}</pre>
}
