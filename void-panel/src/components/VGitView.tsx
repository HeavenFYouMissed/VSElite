import { useState, useEffect } from 'react'

type GitInfo = { branch: string; status: string; log: string; branches: string }

export function VGitView({ info, onRefresh, onBack, onCommand }: {
	info: GitInfo | null
	onRefresh: () => void
	onBack: () => void
	onCommand: (cmd: string) => void
}) {
	const [tab, setTab] = useState<'status' | 'log' | 'branches'>('status')

	useEffect(() => { if (!info) { onRefresh() } }, [info])

	if (!info) {
		return <div className="git-view">
			<div className="git-header">
				<button type="button" onClick={onBack} className="git-back">&lt; back</button>
				<span className="git-title">git</span>
			</div>
			<div className="git-loading">loading...</div>
		</div>
	}

	const statusLines = info.status.split('\n').filter(Boolean)
	const modified = statusLines.filter(l => l.startsWith(' M') || l.startsWith('M '))
	const added = statusLines.filter(l => l.startsWith('A ') || l.startsWith('??'))
	const deleted = statusLines.filter(l => l.startsWith(' D') || l.startsWith('D '))
	const isClean = info.status.includes('clean') || statusLines.length === 0

	return <div className="git-view">
		<div className="git-header">
			<button type="button" onClick={onBack} className="git-back">&lt; back</button>
			<span className="git-title">git</span>
			<span className="git-branch-badge">{info.branch}</span>
			<button type="button" onClick={onRefresh} className="git-refresh">↻</button>
		</div>

		<div className="git-tabs">
			<button type="button" className={`git-tab ${tab === 'status' ? 'active' : ''}`} onClick={() => setTab('status')}>status</button>
			<button type="button" className={`git-tab ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>log</button>
			<button type="button" className={`git-tab ${tab === 'branches' ? 'active' : ''}`} onClick={() => setTab('branches')}>branches</button>
		</div>

		<div className="git-body">
			{tab === 'status' && (
				<div className="git-status-panel">
					{isClean ? (
						<div className="git-clean">✓ clean working tree</div>
					) : (
						<>
							{modified.length > 0 && <div className="git-section">
								<div className="git-section-label">modified ({modified.length})</div>
								{modified.map((l, i) => <div key={i} className="git-file git-file-mod">{l.slice(3)}</div>)}
							</div>}
							{added.length > 0 && <div className="git-section">
								<div className="git-section-label">new ({added.length})</div>
								{added.map((l, i) => <div key={i} className="git-file git-file-add">{l.slice(3)}</div>)}
							</div>}
							{deleted.length > 0 && <div className="git-section">
								<div className="git-section-label">deleted ({deleted.length})</div>
								{deleted.map((l, i) => <div key={i} className="git-file git-file-del">{l.slice(3)}</div>)}
							</div>}
							<div className="git-actions">
								<button type="button" className="git-action-btn" onClick={() => onCommand('/diff')}>view diff</button>
								<button type="button" className="git-action-btn git-action-primary" onClick={() => onCommand('/commit')}>commit</button>
							</div>
						</>
					)}
				</div>
			)}

			{tab === 'log' && (
				<div className="git-log-panel">
					{info.log.split('\n').filter(Boolean).map((line, i) => {
						const [hash, ...rest] = line.split(' ')
						return <div key={i} className="git-log-entry">
							<span className="git-hash">{hash}</span>
							<span className="git-msg">{rest.join(' ')}</span>
						</div>
					})}
				</div>
			)}

			{tab === 'branches' && (
				<div className="git-branches-panel">
					{info.branches.split('\n').filter(Boolean).map((br, i) => (
						<div key={i} className={`git-branch-line ${br.startsWith('*') ? 'active' : ''}`}>
							{br.trim()}
						</div>
					))}
				</div>
			)}
		</div>
	</div>
}
