/*--------------------------------------------------------------------------------------
 *  Right-side agent sessions panel — Cursor-style collapsible sidebar listing all
 *  chat threads with stats, search, and new-agent actions.
 *  Styled after Cursor's .agent-sidebar-* class system (panel-css-extracted.txt).
 *--------------------------------------------------------------------------------------*/

import React, { useMemo, useState, useCallback } from 'react'
import { Search, Plus, ChevronLeft, MessageSquare } from 'lucide-react'
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

	const groups: { label: string, threads: ThreadType[] }[] = [
		{ label: 'Today', threads: [] },
		{ label: 'Yesterday', threads: [] },
		{ label: 'This Week', threads: [] },
		{ label: 'Older', threads: [] },
	]

	for (const t of threads) {
		const d = t.lastModified ? new Date(t.lastModified) : new Date(0)
		if (d >= today) groups[0].threads.push(t)
		else if (d >= yesterday) groups[1].threads.push(t)
		else if (d >= weekAgo) groups[2].threads.push(t)
		else groups[3].threads.push(t)
	}

	return groups.filter(g => g.threads.length > 0)
}

export const AgentSessionsPanel = ({ onClose }: { onClose: () => void }) => {
	const accessor = useAccessor()
	const chatThreadsService = accessor.get('IChatThreadService')
	const { allThreads, currentThreadId } = useChatThreadsState()
	const streamState = useFullChatThreadsStreamState()
	const [searchQuery, setSearchQuery] = useState('')

	const sortedThreads = useMemo(() => {
		const threads = Object.values(allThreads ?? {})
			.sort((a, b) => (b.lastModified ?? '').localeCompare(a.lastModified ?? ''))
		if (!searchQuery.trim()) return threads
		const q = searchQuery.toLowerCase()
		return threads.filter(t => threadTitle(t).toLowerCase().includes(q))
	}, [allThreads, searchQuery])

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
			{/* Header — .agent-sidebar-header: padding 12px, gap 6px */}
			<div style={{
				display: 'flex', flexDirection: 'column', flexShrink: 0,
				gap: '6px', padding: '12px',
			}}>
				{/* Top row — .agent-sidebar-header-top-row: gap 8px, min-height 22px */}
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

				{/* Input row — .agent-sidebar-input-row: gap 4px */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
					{/* New agent button — .agent-sidebar-new-agent-button: radius 6px, min-h 28px, 6px 12px padding */}
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

					{/* Search — .agent-sidebar-search-input: h 28px, radius 6px, font 12px, padding 6px 8px */}
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

			{/* Body — .agent-sidebar-body: flex 1, min-h 0, overflow hidden, padding-top 4px */}
			<div style={{
				display: 'flex', flex: 1, flexDirection: 'column',
				minHeight: 0, overflow: 'hidden', paddingTop: '4px',
			}}>
				{/* Sections — .agent-sidebar-sections: gap 1px, padding 0 8px 16px */}
				<div style={{
					display: 'flex', flexDirection: 'column', gap: '1px',
					padding: '0 8px 16px',
					overflow: 'auto', flex: 1,
				}}>
					{groups.map(group => (
						<div key={group.label} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
							{/* Section title — .agent-sidebar-section-title: h 24px, padding 0 6px */}
							<div style={{
								display: 'flex', alignItems: 'center', gap: 0,
								height: '24px', padding: '0 6px',
							}}>
								<span style={{
									color: 'var(--vscode-descriptionForeground)',
									fontSize: '11px', lineHeight: '14px',
								}}>
									{group.label}
								</span>
							</div>

							{/* List — .agent-sidebar-list: gap 1px, padding-bottom 11px */}
							<div style={{ display: 'flex', flexDirection: 'column', gap: '1px', paddingBottom: '11px' }}>
								{group.threads.map(thread => {
									const isActive = thread.id === currentThreadId
									const isRunning = streamState[thread.id]?.isRunning
									const stats = threadStats(thread)

									return (
										<div
											key={thread.id}
											onClick={() => handleSelectThread(thread.id)}
											style={{
												display: 'flex', alignItems: 'center', gap: '12px',
												borderRadius: '6px', cursor: 'pointer',
												padding: '5px 6px', position: 'relative',
												background: isActive
													? 'var(--vscode-list-activeSelectionBackground, rgba(255,255,255,0.06))'
													: 'transparent',
											}}
											onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
											onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
										>
											{/* Icon — .agent-sidebar-cell-icon */}
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

											{/* Content — .agent-sidebar-cell-content-wrapper */}
											<div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
												{/* Title — .agent-sidebar-cell-text: 12px, 16px line-height */}
												<span style={{
													fontSize: '12px', lineHeight: '16px',
													overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
													color: isActive ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
												}}>
													{threadTitle(thread)}
												</span>

												{/* Subtitle — .agent-sidebar-cell-subtitle: 11px, 14px line-height */}
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
				</div>
			</div>

			{/* Footer — .agent-sidebar-footer: gap 4px, padding 8px 12px */}
			<div style={{
				display: 'flex', alignItems: 'center', flexShrink: 0,
				gap: '4px', padding: '8px 12px',
				borderTop: '1px solid var(--vscode-commandCenter-inactiveBorder, rgba(128,128,128,0.1))',
			}}>
				<span style={{
					color: 'var(--vscode-descriptionForeground)',
					fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis',
					whiteSpace: 'nowrap', opacity: 0.6,
				}}>
					{sortedThreads.length} agent{sortedThreads.length !== 1 ? 's' : ''}
				</span>
			</div>
		</div>
	)
}
