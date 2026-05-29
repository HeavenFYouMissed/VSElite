import { VScreensaver } from './VScreensaver'

export type Activity = { when: string; what: string }
export type Skill = { name: string; desc?: string }

// The right info column — V's "heads-up display". Mirrors the Claude-Code welcome layout:
// stacked dashed panels for recent activity + V's own workspace/skills.
export function VSidePanel({
	connected,
	recent,
	skills,
	fileCount,
}: { connected: boolean; recent: Activity[]; skills: Skill[]; fileCount: number }) {
	return (
		<div className="side">
			<section className="panel panel-visual">
				<div className="panel-label">V</div>
				<VScreensaver />
			</section>

			<section className="panel">
				<div className="panel-label">recent activity</div>
				{recent.length === 0 && <div className="panel-empty">{connected ? 'nothing yet — i\'m watching.' : '—'}</div>}
				{recent.map((a, i) => (
					<div key={i} className="panel-row">
						<span className="when">{a.when}</span>
						<span className="what">{a.what}</span>
					</div>
				))}
				<div className="panel-more">…/resume for more</div>
			</section>

			<section className="panel">
				<div className="panel-label">V's workspace</div>
				<div className="panel-row"><span className="when">.v/</span><span className="what">{fileCount} files</span></div>
				<div className="panel-sub">skills</div>
				{skills.length === 0 && <div className="panel-empty">no skills yet</div>}
				{skills.map((s, i) => (
					<div key={i} className="panel-row">
						<span className="skill-dot">▸</span>
						<span className="what">{s.name}</span>
					</div>
				))}
				<div className="panel-more">…ask V for a skill</div>
			</section>
		</div>
	)
}
