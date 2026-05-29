import { useEffect, useState } from 'react'
import { bridge } from '../lib/messagePort'
import type { ProjectBriefing } from '../lib/types'

// Phase-1 hook: on init, pull a project briefing so V can greet with something true about
// the codebase. Falls back gracefully when running standalone (no host) in the browser.
export function useProjectBriefing() {
	const [briefing, setBriefing] = useState<ProjectBriefing | null>(null)
	const [connected, setConnected] = useState(false)

	useEffect(() => {
		let cancelled = false
		bridge.onInit(() => {
			if (cancelled) return
			setConnected(true)
			bridge.call<ProjectBriefing>('getProjectBriefing', { includeNotes: false })
				.then(b => { if (!cancelled) setBriefing(b) })
				.catch(() => { /* host not ready / standalone */ })
		})
		return () => { cancelled = true }
	}, [])

	return { briefing, connected }
}
