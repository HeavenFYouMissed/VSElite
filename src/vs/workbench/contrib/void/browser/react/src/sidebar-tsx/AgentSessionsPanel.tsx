/*--------------------------------------------------------------------------------------
 *  Right-side agent sessions panel — Cursor-style collapsible sidebar listing all
 *  chat threads with stats, search, and new-agent actions.
 *  Styled after Cursor's .agent-sidebar-* class system (panel-css-extracted.txt).
 *--------------------------------------------------------------------------------------*/

import React, { useMemo, useState, useCallback } from 'react'
import { Search, Plus, ChevronLeft, MessageSquare, Pin, Archive, Trash2, MoreHorizontal, Store } from 'lucide-react'
import { useAccessor, useChatThreadsState, useFullChatThreadsStreamState } from '../util/services.js'
import { ThreadType } from '../../../chatThreadService.js'

const threadTitle = (thread: ThreadType): string => {
	const firstUser = thread.messages.find(m => m.role === 'user')
	const raw = firstUser && firstUser.role === 'user' ? firstUser.displayContent?.trim() : ''
	if (raw) return raw.length > 40 ? `${raw.slice(0, 40)}…` : raw
	return 'New chat'
}

const threadStats = (thread: ThreadType): { files: number } => {
	const files = new Set<string>()
	for (const msg of thread.messages) {
		if (msg.role === 'tool' && msg.type === 'success') {
			const name = msg.name
			if (name === 'edit_file' || name === 'rewrite_file' || name === 'create_file_or_folder') {
				const params = msg.params as any
				if (params?.uri?.fsPath) files.add(params.uri.fsPath)
				else if (params?.uri?.path) files.add(params.uri.path)
			}
		}
	}
	return { files: files.size }
}

const groupByDate = (threads: ThreadType[]): { label: string, threads: ThreadType[] }[] => {
	const now = new Date()
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const yesterday = new Date(today.getTime() - 86400000)
	const weekAgo = new Date(today.getTime() - 7 * 86400000)

	const pinned = threads.filter(t => t.isPinned && !t.isArchived)
	const unpinned = threads.filter(t => !t.isPinned && !t.isArchived)

	const groups: { label: string, threads: ThreadType[] }[] = []

	if (pinned.length > 0) {
		groups.push({ label: 'Pinned', threads: pinned })
	}

	const dateGroups: { label: string, threads: ThreadType[] }[] = [
		{ label: 'Today', threads: [] },
		{ label: 'Yesterday', threads: [] },
		{ label: 'This Week', threads: [] },
		{ label: 'Older', threads: [] },
	]

	for (const t of unpinned) {
		const d = t.lastModified ? new Date(t.lastModified) : new Date(0)
		if (d >= today) dateGroups[0].threads.push(t)
		else if (d >= yesterday) dateGroups[1].threads.push(t)
		else if (d >= weekAgo) dateGroups[2].threads.push(t)
		else dateGroups[3].threads.push(t)
	}

	for (const g of dateGroups) {
		if (g.threads.length > 0) groups.push(g)
	}

	return groups
}

const CellActions = ({ thread, onPin, onArchive, onDelete }: {
	thread: ThreadType,
	onPin: () => void,
	onArchive: () => void,
	onDelete: () => void,
}) => {
	const [showMenu, setShowMenu] = useState(false)

	return (
		<div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
			<button
				onClick={e => { e.stopPropagation(); setShowMenu(v => !v) }}
				style={{
					background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
					color: 'var(--vscode-descriptionForeground)', borderRadius: '3px',
					display: 'flex', alignItems: 'center',
				}}
			>
				<MoreHorizontal size={12} />
			</button>
			{showMenu && (
				<div
					style={{
						position: 'absolute', right: 0, top: '100%', zIndex: 20,
						background: 'var(--vscode-menu-background, var(--vscode-dropdown-background, #2d2d30))',
						border: '1px solid var(--vscode-menu-border, var(--vscode-dropdown-border, #454545))',
						borderRadius: '4px', padding: '2px 0',
						boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
						minWidth: '120px',
					}}
					onMouseLeave={() => setShowMenu(false)}
				>
					<button
						onClick={e => { e.stopPropagation(); onPin(); setShowMenu(false) }}
						style={{
							display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
							padding: '4px 10px', background: 'none', border: 'none', cursor: 'pointer',
							color: 'var(--vscode-menu-foreground, var(--vscode-foreground))',
							fontSize: '12px', textAlign: 'left',
						}}
					>
						<Pin size={12} /> {thread.isPinned ? 'Unpin' : 'Pin'}
					</button>
					<button
						onClick={e => { e.stopPropagation(); onArchive(); setShowMenu(false) }}
						style={{
							display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
							padding: '4px 10px', background: 'none', border: 'none', cursor: 'pointer',
							color: 'var(--vscode-menu-foreground, var(--vscode-foreground))',
							fontSize: '12px', textAlign: 'left',
						}}
					>
						<Archive size={12} /> {thread.isArchived ? 'Unarchive' : 'Archive'}
					</button>
					<div style={{ height: '1px', background: 'var(--vscode-menu-separatorBackground, rgba(128,128,128,0.2))', margin: '2px 0' }} />
					<button
						onClick={e => { e.stopPropagation(); onDelete(); setShowMenu(false) }}
						style={{
							display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
							padding: '4px 10px', background: 'none', border: 'none', cursor: 'pointer',
							color: 'var(--vscode-errorForeground, #f44747)',
							fontSize: '12px', textAlign: 'left',
						}}
					>
						<Trash2 size={12} /> Delete
					</button>
				</div>
			)}
		</div>
	)
}

type MarketplaceItem = {
	name: string
	description: string
	category: string
	icon?: string
}

const MARKETPLACE_ITEMS: MarketplaceItem[] = [
	{ name: 'Datadog', description: 'Use Datadog directly...', category: 'Featured', icon: '📊' },
	{ name: 'Slack', description: 'Slack MCP server...', category: 'Featured', icon: '💬' },
	{ name: 'Figma', description: 'Plugin that includes...', category: 'Featured', icon: '🎨' },
	{ name: 'Linear', description: 'Cursor Plugin for...', category: 'Featured', icon: '📐' },
	{ name: 'ScyllaDB', description: 'Official ScyllaDB a...', category: 'Infrastructure', icon: '🗄️' },
	{ name: 'ParadeDB', description: 'Teach agents how...', category: 'Infrastructure', icon: '🐘' },
	{ name: 'Twilio', description: 'Twilio Skills MCP...', category: 'Infrastructure', icon: '📱' },
	{ name: 'Vantage', description: 'Query cloud costs...', category: 'Infrastructure', icon: '💰' },
	{ name: 'Azure', description: 'Microsoft Azure...', category: 'Infrastructure', icon: '☁️' },
	{ name: 'Temporal', description: 'Comprehensive sk...', category: 'Infrastructure', icon: '⏱️' },
	{ name: 'Desktop Commander', description: 'Terminal, file, and process management MCP', category: 'Agent Orchestration', icon: '🖥️' },
	{ name: 'Firecrawl', description: 'Web scraping and crawling', category: 'Data & Analytics', icon: '🔥' },
]

const CATEGORIES = ['Featured', 'Infrastructure', 'Data & Analytics', 'Agent Orchestration', 'Productivity', 'Payments']

const MarketplaceView = () => {
	const [search, setSearch] = useState('')
	const [selectedCat, setSelectedCat] = useState<string | null>(null)

	const filtered = useMemo(() => {
		let items = MARKETPLACE_ITEMS
		if (selectedCat) items = items.filter(i => i.category === selectedCat)
		if (search.trim()) {
			const q = search.toLowerCase()
			items = items.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
		}
		return items
	}, [search, selectedCat])

	return (
		<div style={{ flex: 1, overflow: 'auto', padding: '0 8px 16px' }}>
			{/* Category pills */}
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '4px 4px 8px' }}>
				<button
					onClick={() => setSelectedCat(null)}
					style={{
						padding: '3px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
						fontSize: '11px',
						background: !selectedCat ? 'var(--vscode-focusBorder, #007acc)' : 'var(--vscode-badge-background, rgba(255,255,255,0.08))',
						color: !selectedCat ? '#fff' : 'var(--vscode-descriptionForeground)',
					}}
				>All</button>
				{CATEGORIES.map(cat => (
					<button
						key={cat}
						onClick={() => setSelectedCat(cat === selectedCat ? null : cat)}
						style={{
							padding: '3px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
							fontSize: '11px',
							background: cat === selectedCat ? 'var(--vscode-focusBorder, #007acc)' : 'var(--vscode-badge-background, rgba(255,255,255,0.08))',
							color: cat === selectedCat ? '#fff' : 'var(--vscode-descriptionForeground)',
						}}
					>{cat}</button>
				))}
			</div>

			{/* Items */}
			<div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
				{filtered.map(item => (
					<div
						key={item.name}
						style={{
							display: 'flex', alignItems: 'center', gap: '10px',
							padding: '8px 8px', borderRadius: '6px', cursor: 'pointer',
						}}
						onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
						onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
					>
						<span style={{ fontSize: '18px', flexShrink: 0, width: '28px', textAlign: 'center' }}>
							{item.icon || '📦'}
						</span>
						<div style={{ flex: 1, minWidth: 0 }}>
							<div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--vscode-foreground)' }}>
								{item.name}
							</div>
							<div style={{
								fontSize: '11px', color: 'var(--vscode-descriptionForeground)',
								overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
							}}>
								{item.description}
							</div>
						</div>
						<button style={{
							padding: '3px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer',
							fontSize: '11px', fontWeight: 500, flexShrink: 0,
							background: 'var(--vscode-button-background, #0078d4)',
							color: 'var(--vscode-button-foreground, #fff)',
						}}>
							Get
						</button>
					</div>
				))}
			</div>
		</div>
	)
}

export const AgentSessionsPanel = ({ onClose }: { onClose: () => void }) => {
	const accessor = useAccessor()
	const chatThreadsService = accessor.get('IChatThreadService')
	const { allThreads, currentThreadId } = useChatThreadsState()
	const streamState = useFullChatThreadsStreamState()
	const [searchQuery, setSearchQuery] = useState('')
	const [showArchived, setShowArchived] = useState(false)
	const [showMarketplace, setShowMarketplace] = useState(false)

	const sortedThreads = useMemo(() => {
		let threads = Object.values(allThreads ?? {})
			.sort((a, b) => (b.lastModified ?? '').localeCompare(a.lastModified ?? ''))
		if (!showArchived) {
			threads = threads.filter(t => !t.isArchived)
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase()
			threads = threads.filter(t => threadTitle(t).toLowerCase().includes(q))
		}
		return threads
	}, [allThreads, searchQuery, showArchived])

	const archivedCount = useMemo(() => {
		return Object.values(allThreads ?? {}).filter(t => t.isArchived).length
	}, [allThreads])

	const groups = useMemo(() => groupByDate(sortedThreads), [sortedThreads])

	const handleNewAgent = useCallback(() => {
		chatThreadsService.openNewThread()
	}, [chatThreadsService])

	const handleSelectThread = useCallback((threadId: string) => {
		chatThreadsService.switchToThread(threadId)
	}, [chatThreadsService])

	return (
		<div style={{
			display: 'flex', flexDirection: 'column',
			height: '100%', width: '100%',
			background: 'var(--vscode-sideBar-background)',
			outline: 'none',
		}}>
			{/* Header */}
			<div style={{
				display: 'flex', flexDirection: 'column', flexShrink: 0,
				gap: '6px', padding: '12px',
			}}>
				<div style={{
					display: 'flex', alignItems: 'center', gap: '8px', minHeight: '22px',
				}}>
					<button
						onClick={onClose}
						style={{
							background: 'none', border: 'none', cursor: 'pointer',
							padding: '2px 6px', borderRadius: '6px',
							color: 'var(--vscode-foreground)',
							opacity: 0.5, display: 'flex', alignItems: 'center',
						}}
						title='Collapse panel'
					>
						<ChevronLeft size={14} />
					</button>
				</div>

				<div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
					<button
						onClick={handleNewAgent}
						style={{
							display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
							width: '100%', minHeight: '28px', padding: '6px 12px',
							borderRadius: '6px',
							border: '1px solid var(--vscode-commandCenter-inactiveBorder, rgba(128,128,128,0.2))',
							background: 'transparent',
							color: 'var(--vscode-foreground)',
							fontSize: '12px', cursor: 'pointer',
						}}
					>
						<Plus size={13} />
						<span style={{ flex: 1, textAlign: 'left' }}>New Agent</span>
						<span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '11px' }}>Ctrl+N</span>
					</button>

					<button
						onClick={() => setShowMarketplace(v => !v)}
						style={{
							display: 'flex', alignItems: 'center', gap: '6px',
							width: '100%', minHeight: '28px', padding: '6px 12px',
							borderRadius: '6px',
							border: 'none',
							background: showMarketplace ? 'var(--vscode-list-activeSelectionBackground, rgba(255,255,255,0.06))' : 'transparent',
							color: 'var(--vscode-foreground)',
							fontSize: '12px', cursor: 'pointer',
						}}
					>
						<Store size={13} />
						<span style={{ flex: 1, textAlign: 'left' }}>Marketplace</span>
					</button>

					<div style={{ display: 'flex', flex: 1, position: 'relative', width: '100%' }}>
						<Search size={12} style={{
							position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
							color: 'var(--vscode-descriptionForeground)', pointerEvents: 'none',
						}} />
						<input
							type='text'
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							placeholder='Search Agents...'
							style={{
								width: '100%', height: '28px',
								borderRadius: '6px', boxSizing: 'border-box',
								border: '1px solid var(--vscode-commandCenter-inactiveBorder, rgba(128,128,128,0.15))',
								background: 'var(--vscode-input-background, transparent)',
								color: 'var(--vscode-input-foreground, var(--vscode-foreground))',
								fontSize: '12px', lineHeight: '16px',
								padding: '6px 8px 6px 26px',
								outline: 'none', opacity: 0.85,
							}}
						/>
					</div>
				</div>
			</div>

			{/* Body */}
			<div style={{
				display: 'flex', flex: 1, flexDirection: 'column',
				minHeight: 0, overflow: 'hidden', paddingTop: '4px',
			}}>
				{showMarketplace ? <MarketplaceView /> : <div style={{
					display: 'flex', flexDirection: 'column', gap: '1px',
					padding: '0 8px 16px',
					overflow: 'auto', flex: 1,
				}}>
					{groups.map(group => (
						<div key={group.label} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
							<div style={{
								display: 'flex', alignItems: 'center', gap: 0,
								height: '24px', padding: '0 6px',
							}}>
								<span style={{
									color: 'var(--vscode-descriptionForeground)',
									fontSize: '11px', lineHeight: '14px',
									flex: 1,
								}}>
									{group.label}
								</span>
								{group.label === 'Pinned' && (
									<Pin size={10} style={{ color: 'var(--vscode-descriptionForeground)', opacity: 0.5 }} />
								)}
							</div>

							<div style={{ display: 'flex', flexDirection: 'column', gap: '1px', paddingBottom: '11px' }}>
								{group.threads.map(thread => {
									const isActive = thread.id === currentThreadId
									const isRunning = streamState[thread.id]?.isRunning
									const stats = threadStats(thread)

									return (
										<div
											key={thread.id}
											className='group'
											onClick={() => handleSelectThread(thread.id)}
											style={{
												display: 'flex', alignItems: 'center', gap: '8px',
												borderRadius: '6px', cursor: 'pointer',
												padding: '5px 6px', position: 'relative',
												background: isActive
													? 'var(--vscode-list-activeSelectionBackground, rgba(255,255,255,0.06))'
													: 'transparent',
											}}
											onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
											onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--vscode-list-activeSelectionBackground, rgba(255,255,255,0.06))' : 'transparent' }}
										>
											<div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
												{isRunning ? (
													<span style={{
														width: '5px', height: '5px', borderRadius: '50%',
														background: 'var(--vscode-progressBar-background, #0078d4)',
														animation: 'v3code-pulse 1.5s ease-in-out infinite',
													}} />
												) : (
													<MessageSquare size={13} style={{
														color: isActive
															? 'var(--vscode-foreground)'
															: 'var(--vscode-descriptionForeground)',
													}} />
												)}
											</div>

											<div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
												<span style={{
													fontSize: '12px', lineHeight: '16px',
													overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
													color: isActive ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
												}}>
													{threadTitle(thread)}
												</span>
												{stats.files > 0 && (
													<span style={{
														fontSize: '11px', lineHeight: '14px',
														color: 'var(--vscode-descriptionForeground)',
														opacity: 0.7,
													}}>
														{stats.files} File{stats.files !== 1 ? 's' : ''}
													</span>
												)}
											</div>

											{/* Hover actions */}
											<div className='opacity-0 group-hover:opacity-100 transition-opacity' style={{ flexShrink: 0 }}>
												<CellActions
													thread={thread}
													onPin={() => thread.isPinned ? chatThreadsService.unpinThread(thread.id) : chatThreadsService.pinThread(thread.id)}
													onArchive={() => thread.isArchived ? chatThreadsService.unarchiveThread(thread.id) : chatThreadsService.archiveThread(thread.id)}
													onDelete={() => chatThreadsService.deleteThread(thread.id)}
												/>
											</div>
										</div>
									)
								})}
							</div>
						</div>
					))}

					{sortedThreads.length === 0 && (
						<div style={{
							color: 'var(--vscode-descriptionForeground)',
							fontSize: '12px', padding: '4px 12px',
						}}>
							{searchQuery ? 'No matching agents' : 'No agents yet'}
						</div>
					)}
				</div>}
			</div>

			{/* Footer */}
			<div style={{
				display: 'flex', alignItems: 'center', flexShrink: 0,
				gap: '8px', padding: '8px 12px',
				borderTop: '1px solid var(--vscode-commandCenter-inactiveBorder, rgba(128,128,128,0.1))',
			}}>
				<span style={{
					color: 'var(--vscode-descriptionForeground)',
					fontSize: '11px', flex: 1, opacity: 0.6,
				}}>
					{sortedThreads.length} agent{sortedThreads.length !== 1 ? 's' : ''}
				</span>
				{archivedCount > 0 && (
					<button
						onClick={() => setShowArchived(v => !v)}
						style={{
							background: 'none', border: 'none', cursor: 'pointer',
							color: 'var(--vscode-descriptionForeground)',
							fontSize: '11px', opacity: 0.6, padding: '0 2px',
						}}
					>
						<Archive size={11} /> {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
					</button>
				)}
			</div>
		</div>
	)
}
