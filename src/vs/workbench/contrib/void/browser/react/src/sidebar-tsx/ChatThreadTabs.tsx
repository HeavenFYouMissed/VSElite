/*--------------------------------------------------------------------------------------
 *  Multi-chat tabs (VS Code / Continue style) — switch threads without leaving the panel.
 *--------------------------------------------------------------------------------------*/

import { Plus, X } from 'lucide-react'
import { useMemo } from 'react'
import { useAccessor, useChatThreadsState, useFullChatThreadsStreamState } from '../util/services.js'
import { ThreadType } from '../../../chatThreadService.js'
const tabTitle = (thread: ThreadType): string => {
	const firstUser = thread.messages.find(m => m.role === 'user')
	const raw = firstUser && firstUser.role === 'user' ? firstUser.displayContent?.trim() : ''
	if (raw) return raw.length > 28 ? `${raw.slice(0, 28)}…` : raw
	return 'New chat'
}

const ThinkingDot = () => (
	<span
		className='shrink-0 rounded-full'
		style={{
			width: '6px', height: '6px',
			background: 'var(--vscode-progressBar-background, #0078d4)',
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
			className='flex items-stretch gap-0 shrink-0 overflow-x-auto select-none'
			style={{
				borderBottom: '1px solid var(--vscode-commandCenter-inactiveBorder, rgba(128,128,128,0.2))',
				background: 'var(--vscode-sideBar-background)',
				minHeight: '32px',
			}}
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
								? 'var(--vscode-tab-activeForeground, var(--vscode-foreground))'
								: 'var(--vscode-tab-inactiveForeground, var(--vscode-descriptionForeground))',
							background: isActive
								? 'var(--vscode-tab-activeBackground, var(--vscode-input-background))'
								: 'transparent',
							borderRight: '1px solid var(--vscode-commandCenter-inactiveBorder, rgba(128,128,128,0.12))',
						}}
						onClick={() => chatThreadsService.switchToThread(thread.id)}
						title={tabTitle(thread)}
					>
						{/* Active indicator bar at bottom */}
						{isActive && <div
							className='absolute bottom-0 left-0 right-0'
							style={{
								height: '2px',
								background: 'var(--vscode-focusBorder, var(--vscode-progressBar-background, #0078d4))',
								borderRadius: '1px 1px 0 0',
							}}
						/>}

						{/* Thinking indicator */}
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
			<button
				type='button'
				className='flex items-center justify-center shrink-0 opacity-60 hover:opacity-100 transition-opacity'
				style={{
					color: 'var(--vscode-foreground)',
					width: '32px', height: '32px',
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
