import { useMemo, useState } from 'react'

export type CatalogSkill = { name: string; desc: string; category: string; id: string }

export function VSkillsView({
	skills, loading, mounting, onMount, onMake, onBack,
}: {
	skills: CatalogSkill[]
	loading: boolean
	mounting: string | null
	onMount: (id: string) => void
	onMake: () => void
	onBack: () => void
}) {
	const [category, setCategory] = useState<string | null>(null)
	const [search, setSearch] = useState('')

	const categories = useMemo(() => {
		const m = new Map<string, number>()
		for (const s of skills) { m.set(s.category, (m.get(s.category) ?? 0) + 1) }
		return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
	}, [skills])

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase()
		return skills.filter(s => {
			if (category && s.category !== category) return false
			if (!q) return true
			return s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
		})
	}, [skills, category, search])

	return (
		<div className="scene scene-skills">
			<div className="build-head">
				<span>▰ skill library <span className="skills-sub">· for the coding agent</span></span>
				<button className="scene-back" onClick={onBack}>esc · back to V</button>
			</div>

			<input
				className="skills-search"
				placeholder="search all skills…"
				value={search}
				onChange={e => setSearch(e.target.value)}
			/>

			{category ? (
				<>
					<div className="skills-breadcrumb">
						<button type="button" className="skills-back-cat" onClick={() => setCategory(null)}>← categories</button>
						<span> / {category}</span>
					</div>
					<div className="skills-list">
						{loading && <div className="skills-empty">· scanning .agents/skills …</div>}
						{!loading && filtered.length === 0 && <div className="skills-empty">no skills in this category.</div>}
						{filtered.map(s => (
							<div key={s.id} className="skill-card">
								<div className="skill-card-main">
									<div className="skill-card-name">▸ {s.name}</div>
									<div className="skill-card-desc">{s.desc || 'no description'}</div>
								</div>
								<button className="skill-mount" disabled={mounting === s.id} onClick={() => onMount(s.id)}>
									{mounting === s.id ? 'mounting…' : 'mount → agent'}
								</button>
							</div>
						))}
					</div>
				</>
			) : (
				<div className="skills-cats">
					{loading && <div className="skills-empty">· scanning .agents/skills …</div>}
					{!loading && categories.length === 0 && <div className="skills-empty">no skills yet. make one below.</div>}
					{categories.map(([cat, count]) => (
						<button key={cat} type="button" className="skill-cat-card" onClick={() => setCategory(cat)}>
							<span className="skill-cat-name">{cat}</span>
							<span className="skill-cat-count">{count} skills</span>
						</button>
					))}
					{search && filtered.length > 0 && (
						<div className="skills-search-results">
							<div className="skills-hint">search hits ({filtered.length})</div>
							{filtered.map(s => (
								<div key={s.id} className="skill-card">
									<div className="skill-card-main">
										<div className="skill-card-name">▸ {s.category}/{s.name}</div>
										<div className="skill-card-desc">{s.desc}</div>
									</div>
									<button className="skill-mount" disabled={mounting === s.id} onClick={() => onMount(s.id)}>
										{mounting === s.id ? 'mounting…' : 'mount → agent'}
									</button>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			<div className="skills-foot">
				<button className="skill-make" onClick={onMake}>+ make a new skill</button>
			</div>
		</div>
	)
}
