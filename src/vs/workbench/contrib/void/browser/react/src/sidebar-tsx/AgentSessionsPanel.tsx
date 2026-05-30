/*--------------------------------------------------------------------------------------
 *  Right-side agent sessions panel — Cursor-style collapsible sidebar listing all
 *  chat threads with stats, search, and new-agent actions.
 *  Styled after Cursor's .agent-sidebar-* class system (panel-css-extracted.txt).
 *--------------------------------------------------------------------------------------*/

import React, { useMemo, useState, useCallback } from 'react'
import { Search, Plus, ChevronLeft, MessageSquare, Pin, Archive, Trash2, MoreHorizontal, Store } from 'lucide-react'
import { useAccessor, useChatThreadsState, useFullChatThreadsStreamState, useMCPServiceState } from '../util/services.js'
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

// ─── MCP Marketplace (grey/black only, real favicons, actual install) ───────────

import { MCP_CATALOG, MCP_CATEGORIES, McpServer, iconUrl } from './mcpCatalog.js'
import { VSBuffer } from '../../../../../../../base/common/buffer.js'
import { URI } from '../../../../../../../base/common/uri.js'

type TileState = 'idle' | 'env-prompt' | 'installing' | 'installed' | 'error'

const TOKEN = {
	bg: '#0a0a0a', surface: '#141414', surface2: '#1e1e1e', surface3: '#262626',
	border: '#2a2a2a', border2: '#383838',
	fg: '#e6e6e6', fgMuted: '#888888', fgDim: '#555555',
	accent: '#9fff3d', accentFg: '#0a0a0a',
	errorFg: '#ff6b6b',
} as const

const ServerIcon = ({ server }: { server: McpServer }) => {
	const [failed, setFailed] = useState(false)
	if (failed) {
		return (
			<div style={{
				width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
				background: TOKEN.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center',
				color: TOKEN.fgMuted, fontSize: '13px', fontWeight: 600,
			}}>{server.name[0]}</div>
		)
	}
	return (
		<img
			src={iconUrl(server)}
			alt=""
			width={28} height={28}
			style={{ borderRadius: '6px', flexShrink: 0 }}
			onError={() => setFailed(true)}
		/>
	)
}

const EnvPromptRow = ({ envKeys, onSubmit, onCancel }: {
	envKeys: string[],
	onSubmit: (vals: Record<string, string>) => void,
	onCancel: () => void,
}) => {
	const [vals, setVals] = useState<Record<string, string>>(() => {
		const m: Record<string, string> = {}
		for (const k of envKeys) m[k] = ''
		return m
	})
	const allFilled = envKeys.every(k => vals[k]?.trim())
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 0' }}>
			{envKeys.map(k => (
				<input
					key={k}
					type="text"
					placeholder={k}
					value={vals[k] || ''}
					onChange={e => setVals(p => ({ ...p, [k]: e.target.value }))}
					style={{
						width: '100%', boxSizing: 'border-box',
						height: '24px', borderRadius: '4px', fontSize: '11px',
						background: TOKEN.surface2, color: TOKEN.fg,
						border: `1px solid ${TOKEN.border2}`, padding: '2px 6px', outline: 'none',
					}}
				/>
			))}
			<div style={{ display: 'flex', gap: '4px' }}>
				<button onClick={() => onSubmit(vals)} disabled={!allFilled} style={{
					flex: 1, height: '22px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, cursor: allFilled ? 'pointer' : 'default',
					background: allFilled ? TOKEN.accent : TOKEN.surface3,
					color: allFilled ? TOKEN.accentFg : TOKEN.fgDim,
					border: 'none', opacity: allFilled ? 1 : 0.5,
				}}>Install</button>
				<button onClick={onCancel} style={{
					height: '22px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
					background: 'transparent', color: TOKEN.fgMuted, border: `1px solid ${TOKEN.border2}`, padding: '0 8px',
				}}>Cancel</button>
			</div>
		</div>
	)
}

const MarketplaceTile = ({ server, installedNames, onInstall }: {
	server: McpServer,
	installedNames: Set<string>,
	onInstall: (server: McpServer, env?: Record<string, string>) => Promise<void>,
}) => {
	const isAlreadyInstalled = installedNames.has(server.id) || installedNames.has(server.name.toLowerCase())
	const [state, setState] = useState<TileState>(isAlreadyInstalled ? 'installed' : 'idle')
	const [errorMsg, setErrorMsg] = useState('')

	const handleGet = async (env?: Record<string, string>) => {
		setState('installing')
		setErrorMsg('')
		try {
			await onInstall(server, env)
			setState('installed')
		} catch (e: any) {
			setState('error')
			setErrorMsg(e?.message || 'Install failed')
		}
	}

	const handleClick = () => {
		if (state === 'installed' || state === 'installing') return
		if (server.install.env && server.install.env.length > 0 && state !== 'env-prompt') {
			setState('env-prompt')
			return
		}
		handleGet()
	}

	return (
		<div style={{
			display: 'flex', flexDirection: 'column', padding: '8px 8px',
			borderBottom: `1px solid ${TOKEN.border}`,
		}}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
				<ServerIcon server={server} />
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ fontSize: '12px', fontWeight: 500, color: TOKEN.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
						{server.name}
					</div>
					<div style={{ fontSize: '11px', color: TOKEN.fgMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '16px' }}>
						{server.description}
					</div>
				</div>
				<button
					onClick={handleClick}
					disabled={state === 'installed' || state === 'installing'}
					style={{
						padding: '3px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, flexShrink: 0,
						cursor: state === 'idle' || state === 'error' ? 'pointer' : 'default',
						background: state === 'installed' ? 'transparent' : state === 'installing' ? TOKEN.surface3 : 'transparent',
						color: state === 'installed' ? TOKEN.fgDim : state === 'error' ? TOKEN.errorFg : TOKEN.fg,
						border: state === 'installed' ? `1px solid ${TOKEN.border}` : `1px solid ${TOKEN.border2}`,
						opacity: state === 'installing' ? 0.6 : 1,
					}}
				>
					{state === 'idle' || state === 'env-prompt' ? 'Get' : state === 'installing' ? 'Installing...' : state === 'installed' ? 'Installed' : 'Retry'}
				</button>
			</div>
			{state === 'env-prompt' && server.install.env && (
				<EnvPromptRow
					envKeys={server.install.env}
					onSubmit={(vals) => handleGet(vals)}
					onCancel={() => setState('idle')}
				/>
			)}
			{state === 'error' && errorMsg && (
				<div style={{ fontSize: '10px', color: TOKEN.errorFg, paddingTop: '4px' }}>{errorMsg}</div>
			)}
		</div>
	)
}

const MarketplaceView = () => {
	const accessor = useAccessor()
	const mcpState = useMCPServiceState()
	const fileService = accessor.get('IFileService')
	const pathService = accessor.get('IPathService')
	const [search, setSearch] = useState('')
	const [activeCategory, setActiveCategory] = useState<typeof MCP_CATEGORIES[number]>('All')

	const installedNames = useMemo(() => {
		const names = new Set<string>()
		for (const name of Object.keys(mcpState.mcpServerOfName)) {
			names.add(name.toLowerCase())
		}
		return names
	}, [mcpState.mcpServerOfName])

	const filtered = useMemo(() => {
		let items = MCP_CATALOG
		if (activeCategory !== 'All') {
			items = items.filter(s => s.category === activeCategory)
		}
		if (search.trim()) {
			const q = search.toLowerCase()
			items = items.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
		}
		return items
	}, [search, activeCategory])

	const handleInstall = useCallback(async (server: McpServer, env?: Record<string, string>) => {
		const userHome = await pathService.userHome()
		const configUri = URI.joinPath(userHome, '.v3code', 'mcp.json')

		let existing: Record<string, any> = { mcpServers: {} }
		try {
			const content = await fileService.readFile(configUri)
			existing = JSON.parse(content.value.toString())
			if (!existing.mcpServers) existing.mcpServers = {}
		} catch { /* file doesn't exist yet */ }

		let entry: Record<string, any>
		if (server.transport === 'http') {
			entry = { url: server.install.url }
		} else {
			entry = { command: server.install.command, args: server.install.args }
			if (env && Object.keys(env).length > 0) {
				entry.env = env
			}
		}

		existing.mcpServers[server.id] = entry
		const buffer = VSBuffer.fromString(JSON.stringify(existing, null, 2))
		await fileService.writeFile(configUri, buffer)
	}, [fileService, pathService])

	return (
		<div style={{ flex: 1, overflow: 'auto', padding: '0 8px 16px' }}>
			{/* Search */}
			<div style={{ padding: '0 4px 8px', position: 'relative' }}>
				<Search size={12} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: TOKEN.fgMuted, pointerEvents: 'none' }} />
				<input
					type='text' value={search} onChange={e => setSearch(e.target.value)}
					placeholder='Search Agents...'
					style={{
						width: '100%', height: '28px', borderRadius: '6px', boxSizing: 'border-box',
						border: `1px solid ${TOKEN.border}`,
						background: TOKEN.surface, color: TOKEN.fg, fontSize: '11px',
						padding: '4px 8px 4px 28px', outline: 'none',
					}}
				/>
			</div>
			{/* Category pills */}
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '0 4px 10px' }}>
				{MCP_CATEGORIES.map(cat => (
					<button
						key={cat}
						onClick={() => setActiveCategory(cat)}
						style={{
							padding: '3px 10px', borderRadius: '10px', fontSize: '11px', cursor: 'pointer',
							border: `1px solid ${activeCategory === cat ? TOKEN.border2 : TOKEN.border}`,
							background: activeCategory === cat ? TOKEN.surface3 : 'transparent',
							color: activeCategory === cat ? TOKEN.fg : TOKEN.fgMuted,
							fontWeight: activeCategory === cat ? 500 : 400,
						}}
					>{cat}</button>
				))}
			</div>
			{/* Tiles */}
			<div style={{ display: 'flex', flexDirection: 'column' }}>
				{filtered.map(server => (
					<MarketplaceTile
						key={server.id}
						server={server}
						installedNames={installedNames}
						onInstall={handleInstall}
					/>
				))}
			</div>
			{filtered.length === 0 && (
				<div style={{ fontSize: '11px', color: TOKEN.fgDim, textAlign: 'center', padding: '20px 8px' }}>
					No servers match your search.
				</div>
			)}
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
			background: 'var(--surface, #131316)',
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
						className='v3-panel-btn'
						style={{
							background: 'none', border: 'none', cursor: 'pointer',
							padding: '2px 6px', borderRadius: '6px',
							color: 'var(--fg-muted, #A0A0A8)',
							display: 'flex', alignItems: 'center',
						}}
						title='Collapse panel'
					>
						<ChevronLeft size={14} />
					</button>
				</div>

				<div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
					<button
						onClick={handleNewAgent}
						className='v3-panel-btn'
						style={{
							display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
							width: '100%', minHeight: '28px', padding: '6px 12px',
							borderRadius: '6px',
							border: '1px solid var(--border, #2A2A30)',
							background: 'transparent',
							color: 'var(--fg, #ECECEE)',
							fontSize: '12px', cursor: 'pointer',
						}}
					>
						<Plus size={13} />
						<span style={{ flex: 1, textAlign: 'left' }}>New Agent</span>
						<span style={{ color: 'var(--fg-dim, #6B6B73)', fontSize: '11px' }}>Ctrl+N</span>
					</button>

					<button
						onClick={() => setShowMarketplace(v => !v)}
						className='v3-panel-btn'
						style={{
							display: 'flex', alignItems: 'center', gap: '6px',
							width: '100%', minHeight: '28px', padding: '6px 12px',
							borderRadius: '6px',
							border: 'none',
							background: showMarketplace ? 'var(--surface-3, #222227)' : 'transparent',
							color: showMarketplace ? 'var(--fg, #ECECEE)' : 'var(--fg-muted, #A0A0A8)',
							fontSize: '12px', cursor: 'pointer',
						}}
					>
						<Store size={13} />
						<span style={{ flex: 1, textAlign: 'left' }}>Marketplace</span>
					</button>

					<div style={{ display: 'flex', flex: 1, position: 'relative', width: '100%' }}>
						<Search size={12} style={{
							position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
							color: 'var(--fg-dim, #6B6B73)', pointerEvents: 'none',
						}} />
						<input
							type='text'
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							placeholder='Search Agents...'
							style={{
								width: '100%', height: '28px',
								borderRadius: '6px', boxSizing: 'border-box',
								border: '1px solid var(--border, #2A2A30)',
								background: 'var(--surface-2, #1A1A1E)',
								color: 'var(--fg, #ECECEE)',
								fontSize: '12px', lineHeight: '16px',
								padding: '6px 8px 6px 26px',
								outline: 'none',
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
									color: 'var(--fg-dim, #6B6B73)',
									fontSize: '11px', lineHeight: '14px',
									flex: 1,
								}}>
									{group.label}
								</span>
								{group.label === 'Pinned' && (
									<Pin size={10} style={{ color: 'var(--fg-dim, #6B6B73)' }} />
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
													? 'var(--surface-3, #222227)'
													: 'transparent',
											}}
											onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-2, #1A1A1E)' }}
											onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--surface-3, #222227)' : 'transparent' }}
										>
											<div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
												{isRunning ? (
													<span style={{
														width: '5px', height: '5px', borderRadius: '50%',
														background: 'var(--accent, #8FD96A)',
														animation: 'v3code-pulse 1.5s ease-in-out infinite',
													}} />
												) : (
													<MessageSquare size={13} style={{
														color: isActive
															? 'var(--fg, #ECECEE)'
															: 'var(--fg-dim, #6B6B73)',
													}} />
												)}
											</div>

											<div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
												<span style={{
													fontSize: '12px', lineHeight: '16px',
													overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
													color: isActive ? 'var(--fg, #ECECEE)' : 'var(--fg-muted, #A0A0A8)',
												}}>
													{threadTitle(thread)}
												</span>
												{stats.files > 0 && (
													<span style={{
														fontSize: '11px', lineHeight: '14px',
														color: 'var(--fg-dim, #6B6B73)',
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
							color: 'var(--fg-dim, #6B6B73)',
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
				borderTop: '1px solid var(--border, #2A2A30)',
			}}>
				<span style={{
					color: 'var(--fg-dim, #6B6B73)',
					fontSize: '11px', flex: 1,
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
