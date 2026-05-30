/*--------------------------------------------------------------------------------------
 *  Multi-chat tabs — switch threads without leaving the panel.
 *  Constrained width so they never overflow into sibling header buttons.
 *--------------------------------------------------------------------------------------*/

import { Plus, X } from 'lucide-react'
import { useMemo } from 'react'
import { useAccessor, useChatThreadsState, useFullChatThreadsStreamState } from '../util/services.js'
import { ThreadType } from '../../../chatThreadService.js'
const tabTitle = (thread: ThreadType): string => {
	const firstUser = thread.messages.find(m => m.role === 'user')
	const raw = firstUser && firstUser.role === 'user' ? firstUser.displayContent?.trim() : ''
	if (raw) return raw.length > 28 ? `${raw.slice(0, 28)}...` : raw
	return 'New chat'
}

const ThinkingDot = () => (
	<span
		className='shrink-0 rounded-full'
		style={{
			width: '6px', height: '6px',
			background: 'var(--accent, #8FD96A)',
			animation: 'v3code-pulse 1.5s ease-in-out infinite',
		}}
	/>
)

export const ChatThreadTabs = () => {
	const accessor = useAccessor()
	const chatThreadsService = accessor.get('IChatThreadService')
	const { allThreads, currentThreadId } = useChatThreadsState()
	const streamState = useFullChatThreadsStreamState()

	const sortedThreads = useMemo(() => {
		return Object.values(allThreads ?? {})
			.sort((a, b) => (b.lastModified ?? '').localeCompare(a.lastModified ?? ''))
	}, [allThreads])

	if (sortedThreads.length === 0) return null

	return (
		<div
			className='flex items-stretch shrink-0 select-none'
			style={{
				borderBottom: '1px solid var(--border, #2A2A30)',
				background: 'var(--surface, #131316)',
				minHeight: '32px',
				maxWidth: '100%',
				overflow: 'hidden',
			}}
		>
			{/* Scrollable tab area — takes remaining space */}
			<div
				className='flex items-stretch flex-1 min-w-0 overflow-x-auto'
				style={{ scrollbarWidth: 'none' }}
			>
				{sortedThreads.map(thread => {
					const isActive = thread.id === currentThreadId
					const isRunning = streamState[thread.id]?.isRunning

					return (
						<div
							key={thread.id}
							className='group flex items-center shrink-0 cursor-pointer relative'
							style={{
								gap: '5px',
								padding: '0 6px 0 8px',
								maxWidth: '160px',
								minWidth: '0',
								height: '32px',
								fontSize: '12px',
								color: isActive
									? 'var(--fg, #ECECEE)'
									: 'var(--fg-muted, #A0A0A8)',
								background: isActive
									? 'var(--surface-2, #1A1A1E)'
									: 'transparent',
								borderRight: '1px solid var(--border, #2A2A30)',
							}}
							onClick={() => chatThreadsService.switchToThread(thread.id)}
							title={tabTitle(thread)}
						>
							{isActive && <div
								className='absolute bottom-0 left-0 right-0'
								style={{
									height: '2px',
									background: 'var(--accent, #8FD96A)',
									borderRadius: '1px 1px 0 0',
								}}
							/>}

							{isRunning && <ThinkingDot />}

							<span className='truncate flex-1' style={{ lineHeight: '32px' }}>{tabTitle(thread)}</span>

							{sortedThreads.length > 1 && (
								<button
									type='button'
									className='opacity-0 group-hover:opacity-70 hover:!opacity-100 p-0.5 rounded-sm shrink-0'
									style={{ color: 'inherit' }}
									onClick={(e) => {
										e.stopPropagation()
										if (thread.id === currentThreadId) {
											const other = sortedThreads.find(t => t.id !== thread.id)
											if (other) chatThreadsService.switchToThread(other.id)
										}
										chatThreadsService.deleteThread(thread.id)
									}}
									aria-label='Close chat'
								>
									<X className='w-3 h-3' strokeWidth={2} />
								</button>
							)}
						</div>
					)
				})}
			</div>
			{/* New tab button — always visible, never pushed off */}
			<button
				type='button'
				className='flex items-center justify-center shrink-0 opacity-60 hover:opacity-100 transition-opacity'
				style={{
					color: 'var(--fg, #ECECEE)',
					width: '32px', height: '32px',
					borderLeft: '1px solid var(--border, #2A2A30)',
				}}
				onClick={() => chatThreadsService.openNewThread()}
				title='New chat'
				aria-label='New chat'
			>
				<Plus className='w-3.5 h-3.5' strokeWidth={2} />
			</button>
		</div>
	)
}
