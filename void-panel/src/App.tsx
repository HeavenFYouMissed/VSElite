import { useMemo } from 'react'
import { VSprite } from './components/VSprite'
import { useProjectBriefing } from './hooks/useVoidBridge'

export function App() {
	const { briefing, connected } = useProjectBriefing()

	const greeting = useMemo(() => {
		if (!connected) return "Booting up… (standalone preview — no workbench host yet)"
		if (!briefing) return "Hey — I'm V. Reading your codebase…"
		const root = briefing.workspaceRoot?.split(/[\\/]/).pop() || 'this workspace'
		const commits = briefing.recentCommits?.length ?? 0
		return `Hey — I'm V, your V3Code companion. I'm watching ${root}` +
			(commits ? ` (${commits} recent commits).` : '.') +
			' Ask me anything, or I\'ll nudge the agent when it needs me.'
	}, [briefing, connected])

	return (
		<div className="h-full w-full flex flex-col font-mono">
			{/* sky */}
			<div className="relative shrink-0 h-28 flex items-end justify-center overflow-hidden"
				style={{ background: 'linear-gradient(180deg, #160a2b 0%, #2a1257 55%, #1d0f3d 100%)', borderBottom: '1px solid rgba(139,92,246,0.18)' }}>
				<div className="absolute inset-0 opacity-[0.08]" style={{
					backgroundImage: 'radial-gradient(1px 1px at 20% 30%, #fff 1px, transparent 0), radial-gradient(1px 1px at 70% 55%, #fff 1px, transparent 0), radial-gradient(1px 1px at 45% 80%, #fff 1px, transparent 0), radial-gradient(1px 1px at 85% 25%, #fff 1px, transparent 0)',
				}} />
				<div className="flex items-end gap-8 pb-3">
					<div style={{ opacity: 0.14 }}><VSprite cell={3} mode="static" /></div>
					<VSprite cell={5} mode={connected ? 'idle' : 'walk'} />
					<div style={{ opacity: 0.14 }}><VSprite cell={3} mode="static" /></div>
				</div>
			</div>

			{/* transcript area (Phase-1 placeholder) */}
			<div className="flex-1 overflow-auto px-4 py-4">
				<div className="max-w-[680px] mx-auto">
					<div className="flex items-start gap-3">
						<div className="shrink-0 mt-1"><VSprite cell={2} mode="static" /></div>
						<div className="text-[13px] leading-relaxed text-[#c7d2dd]">{greeting}</div>
					</div>
				</div>
			</div>

			{/* status bar */}
			<div className="shrink-0 px-3 py-1.5 text-[11px] flex items-center justify-between border-t"
				style={{ borderColor: 'rgba(139,92,246,0.15)', background: '#2a1f47' }}>
				<span className="flex items-center gap-1.5">
					<span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: connected ? '#4ea03b' : '#d6392c' }} />
					{connected ? 'Context Bridge connected' : 'standalone'}
				</span>
				<span className="text-[#5d6b7a]">V · deepseek-v4-flash</span>
			</div>
		</div>
	)
}
