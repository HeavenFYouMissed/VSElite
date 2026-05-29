/*--------------------------------------------------------------------------------------
 *  V3Code ChatCore — ChatContainer (shared chat component, multi-layout)
 *
 *  Renders in three layouts via props:
 *    "sidebar"   — compact, right sidebar (default chat mode)
 *    "fullpanel" — full takeover, agent panel mode (VIBE mode)
 *    "inline"    — minimal, quick edit mode
 *
 *  ONE chat component. Multiple layouts via props. Non-negotiable.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useRef, useState } from 'react';
import { Composer } from './Composer.js';
import { MessageThread, ChatMessage, InlineDiff } from './MessageThread.js';
import { FileChangeItem } from './FileChangeSummaryBar.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatLayout = 'sidebar' | 'fullpanel' | 'inline';

export interface ChatContainerProps {
	/** Layout mode — determines styling and which features are shown */
	layout: ChatLayout;

	// Messages
	messages: ChatMessage[];
	isStreaming: boolean;

	// Input
	inputValue: string;
	onInputChange: (value: string) => void;
	onSubmit: () => void;
	onAbort?: () => void;
	isInputDisabled?: boolean;
	inputErrorMessage?: string;

	// Toolbar
	showTabs?: boolean;
	showToolCalls?: boolean;
	showModelSelector?: boolean;
	showAgentModeToggle?: boolean;
	showMentionButton?: boolean;
	showAttachmentButton?: boolean;

	// Agent mode
	agentMode?: 'Chat' | 'Agent' | 'V3Agent';
	onAgentModeChange?: (mode: 'Chat' | 'Agent' | 'V3Agent') => void;

	// Model
	modelName?: string;
	onModelSelectorClick?: () => void;

	// File changes
	fileChanges?: FileChangeItem[];
	onAcceptAllChanges?: () => void;
	onRevertFile?: (filePath: string) => void;
	onOpenFileDiff?: (filePath: string) => void;

	// Header
	headerLeft?: React.ReactNode;
	headerRight?: React.ReactNode;

	// Session tabs
	sessionTabs?: React.ReactNode;

	// DEV/VIBE toggle
	showModeToggle?: boolean;
	isVibeMode?: boolean;
	onToggleMode?: () => void;

	// Max input rows per layout
	inputMaxRows?: number;
	inputMaxLength?: number;

	className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ChatContainer: React.FC<ChatContainerProps> = ({
	layout,
	messages,
	isStreaming,
	inputValue,
	onInputChange,
	onSubmit,
	onAbort,
	isInputDisabled = false,
	inputErrorMessage,
	showTabs = false,
	showToolCalls = true,
	showModelSelector = true,
	showAgentModeToggle = true,
	showMentionButton = true,
	showAttachmentButton = true,
	agentMode = 'Agent',
	onAgentModeChange,
	modelName = 'deepseek-reasoner',
	onModelSelectorClick,
	fileChanges,
	onAcceptAllChanges,
	onRevertFile,
	onOpenFileDiff,
	headerLeft,
	headerRight,
	sessionTabs,
	showModeToggle = false,
	isVibeMode = false,
	onToggleMode,
	inputMaxRows,
	inputMaxLength,
	className = '',
}) => {
	const scrollRef = useRef<HTMLDivElement | null>(null);

	// Auto-scroll to bottom on new messages
	const handleMessagesChange = useCallback(() => {
		const el = scrollRef.current;
		if (el) {
			const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
			if (isNearBottom || isStreaming) {
				el.scrollTop = el.scrollHeight;
			}
		}
	}, [isStreaming]);

	React.useEffect(() => {
		handleMessagesChange();
	}, [messages, handleMessagesChange]);

	// Layout-specific config
	const isSidebar = layout === 'sidebar';
	const isFullPanel = layout === 'fullpanel';
	const isInline = layout === 'inline';

	const composerMinRows = isInline ? 1 : 3;
	const composerMaxRows = inputMaxRows || (isInline ? 4 : isFullPanel ? 12 : 8);
	const composerZoomUpRows = isInline ? undefined : 16;

	return (
		<div
			className={`
				v3code-chat-container
				flex flex-col h-full
				${isFullPanel ? 'bg-[var(--vscode-editor-background,#1e1e2e)]' : ''}
				${className}
			`}
		>
			{/* Header bar */}
			{(showTabs || showModeToggle || headerLeft || headerRight) && (
				<div className="
					v3code-chat-header
					flex items-center gap-2 px-3 py-2
					border-b border-[var(--vscode-panel-border,rgba(255,255,255,0.06))]
					shrink-0
				">
					{/* Left: Label + tabs */}
					<div className="flex items-center gap-2 flex-1 min-w-0">
						{headerLeft || (
							<span className="text-[12px] font-bold text-[var(--vscode-foreground,#cccccc)] tracking-wide">
								CHAT
							</span>
						)}
						{showTabs && (
							<div className="flex items-center gap-0.5 ml-2">
								{sessionTabs}
							</div>
						)}
					</div>

					{/* Center: DEV/VIBE toggle */}
					{showModeToggle && (
						<div className="flex items-center h-7 rounded-full bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.06))] p-0.5">
							<button
								type="button"
								onClick={() => !isVibeMode || onToggleMode?.()}
								className={`
									px-3 h-full rounded-full text-[11px] font-semibold transition-all duration-200
									${!isVibeMode
										? 'bg-[var(--vscode-button-background,#8B5CF6)] text-white shadow-sm'
										: 'text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.5))] hover:text-[var(--vscode-foreground,#cccccc)]'
									}
									cursor-pointer
								`}
							>
								DEV
							</button>
							<button
								type="button"
								onClick={() => isVibeMode || onToggleMode?.()}
								className={`
									px-3 h-full rounded-full text-[11px] font-semibold transition-all duration-200
									${isVibeMode
										? 'bg-[var(--vscode-focusBorder,#a78bfa)] text-white shadow-sm'
										: 'text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.5))] hover:text-[var(--vscode-foreground,#cccccc)]'
									}
									cursor-pointer
								`}
							>
								VIBE
							</button>
						</div>
					)}

					{/* Right: actions */}
					<div className="flex items-center gap-1">
						{headerRight}
					</div>
				</div>
			)}

			{/* Message thread */}
			<MessageThread
				messages={messages}
				onOpenDiff={onOpenFileDiff}
				scrollRef={scrollRef}
				className="flex-1"
			/>

			{/* Composer (input area) */}
			{layout !== 'inline' || true ? (
				<div className={`
					shrink-0
					${isFullPanel ? 'px-4 pb-4' : 'px-2 pb-2'}
				`}>
					<Composer
						inputValue={inputValue}
						onInputChange={onInputChange}
						onSubmit={onSubmit}
						onAbort={onAbort}
						isStreaming={isStreaming}
						isDisabled={isInputDisabled}
						errorMessage={inputErrorMessage}
						showModelSelector={showModelSelector && !isInline}
						showAgentModeToggle={showAgentModeToggle && !isInline}
						showMentionButton={showMentionButton}
						showAttachmentButton={showAttachmentButton}
						agentMode={agentMode}
						onAgentModeChange={onAgentModeChange}
						modelName={modelName}
						onModelSelectorClick={onModelSelectorClick}
						fileChanges={fileChanges}
						onAcceptAllChanges={onAcceptAllChanges}
						onRevertFile={onRevertFile}
						onOpenFileDiff={onOpenFileDiff}
						minRows={composerMinRows}
						maxRows={composerMaxRows}
						zoomUpRows={composerZoomUpRows}
						maxLength={inputMaxLength}
					/>
				</div>
			) : null}
		</div>
	);
};

ChatContainer.displayName = 'ChatContainer';
