import { VSprite } from './VSprite'

export type BuildStep = { label: string; state: 'done' | 'active' | 'todo' }

// A dedicated "level" of V's UI — shown when something major (a build) is happening.
// V works in the foreground while steps + an ASCII progress bar stream; then we return home.
export function BuildingView({ title, steps, pct }: { title: string; steps: BuildStep[]; pct: number }) {
	const filled = Math.max(0, Math.min(10, Math.round(pct / 10)))
	const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)
	return (
		<div className="scene scene-build">
			<div className="build-head">
				▰ V is building <span className="build-title">{title}</span>
			</div>
			<div className="build-body">
				<div className="build-actor">
					<VSprite cell={7} mode="walk" />
				</div>
				<div className="build-steps">
					{steps.map((s, i) => (
						<div key={i} className={`build-step st-${s.state}`}>
							<span className="box">{s.state === 'done' ? '[x]' : s.state === 'active' ? '[~]' : '[ ]'}</span>
							<span className="step-label">{s.label}</span>
						</div>
					))}
				</div>
			</div>
			<div className="build-bar">[{bar}] {pct}%</div>
		</div>
	)
}
