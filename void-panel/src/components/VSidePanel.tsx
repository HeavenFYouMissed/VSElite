import { VScreensaver } from './VScreensaver'

export type Activity = { when: string; what: string }
export type Skill = { name: string; desc?: string }

export function VSidePanel({
	connected,
	recent,
	skills,
	fileCount,
	ctxUsed,
	ctxMax,
	memorySummary,
	sandboxFiles,
	onApproveSandbox,
}: {
	connected: boolean
	recent: Activity[]
	skills: Skill[]
	fileCount: number
	ctxUsed?: number
	ctxMax?: number
	memorySummary?: string
	sandboxFiles?: { path: string; bytes: number }[]
	onApproveSandbox?: (path: string) => void
}) {
	const pct = ctxMax ? Math.min(100, Math.round((ctxUsed ?? 0) / ctxMax * 100)) : 0
	const filled = Math.round(pct / 10)

	return (
		<div className="side">
			<section className="panel panel-visual">
				<div className="panel-label">V</div>
				<VScreensaver />
			</section>

			{ctxMax != null && ctxMax > 0 && (
				<section className="panel">
					<div className="panel-label">context</div>
					<div className={`ctx-bar ${pct >= 85 ? 'ctx-critical' : pct >= 65 ? 'ctx-warn' : ''}`}>
						[{ '█'.repeat(filled) }{ '░'.repeat(10 - filled) }] {pct}%
					</div>
					<div className="panel-row"><span className="when">tokens</span><span className="what">~{ctxUsed} / {ctxMax}</span></div>
				</section>
			)}

			{memorySummary && (
				<section className="panel">
					<div className="panel-label">memory</div>
					<div className="panel-row"><span className="what">{memorySummary}</span></div>
				</section>
			)}

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

			{(sandboxFiles?.length ?? 0) > 0 && (
				<section className="panel">
					<div className="panel-label">sandbox (.v/files)</div>
					{sandboxFiles!.map(f => (
						<div key={f.path} className="panel-row">
							<span className="what">{f.path}</span>
							<button type="button" className="sandbox-approve" onClick={() => onApproveSandbox?.(f.path)}>approve</button>
						</div>
					))}
				</section>
			)}

			<section className="panel">
				<div className="panel-label">V's workspace</div>
				<div className="panel-row"><span className="when">.v/</span><span className="what">{fileCount} files</span></div>
				<div className="panel-sub">concierge skills</div>
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
