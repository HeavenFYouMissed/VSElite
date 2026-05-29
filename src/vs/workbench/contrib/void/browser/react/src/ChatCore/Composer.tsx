/*--------------------------------------------------------------------------------------
 *  V3Code ChatCore — Composer (full chat input area with toolbar)
 *  Patterns extracted from VoidChatArea + Trae's input layout
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useRef } from 'react';
import { InputBox, InputBoxProps } from './InputBox.js';
import { FileChangeSummaryBar, FileChangeItem } from './FileChangeSummaryBar.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComposerProps {
	// Input
	inputValue: string;
	onInputChange: (value: string) => void;
	onSubmit: () => void;
	onAbort?: () => void;
	placeholder?: string;

	// State
	isStreaming: boolean;
	isDisabled?: boolean;
	errorMessage?: string;

	// Toolbar options
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

	// InputBox overrides
	minRows?: number;
	maxRows?: number;
	zoomUpRows?: number;
	maxLength?: number;

	className?: string;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const IconArrowUp = ({ className = '' }: { className?: string }) => (
	<svg
		width="18" height="18" viewBox="0 0 20 20" fill="none"
		className={className}
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			fill="currentColor"
			fillRule="evenodd"
			clipRule="evenodd"
			d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
		/>
	</svg>
);

const IconSquare = ({ className = '' }: { className?: string }) => (
	<svg
		className={className}
		stroke="currentColor" fill="currentColor" strokeWidth="0"
		viewBox="0 0 24 24" width="18" height="18"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect x="2" y="2" width="20" height="20" rx="4" ry="4" />
	</svg>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Composer: React.FC<ComposerProps> = ({
	inputValue,
	onInputChange,
	onSubmit,
	onAbort,
	placeholder = 'Message V3Code... (type / for commands)',
	isStreaming,
	isDisabled = false,
	errorMessage,
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
	minRows = 3,
	maxRows = 8,
	zoomUpRows = 16,
	maxLength,
	className = '',
}) => {
	const composerRef = useRef<HTMLDivElement | null>(null);

	const handleMentionClick = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		const host = composerRef.current;
		const ta = host?.querySelector('textarea') as HTMLTextAreaElement | null;
		if (!ta) return;
		ta.focus();
		const start = ta.selectionStart ?? ta.value.length;
		const end = ta.selectionEnd ?? ta.value.length;
		const before = ta.value.slice(0, start);
		const after = ta.value.slice(end);
		const needsSpace = before.length > 0 && !/\s$/.test(before);
		const insert = (needsSpace ? ' ' : '') + '@';
		ta.value = before + insert + after;
		const pos = (before + insert).length;
		ta.setSelectionRange(pos, pos);
		ta.dispatchEvent(new Event('input', { bubbles: true }));
		onInputChange(ta.value);
	}, [onInputChange]);

	const hasText = inputValue.trim().length > 0;

	return (
		<div
			ref={composerRef}
			className={`
				v3code-composer group
				flex flex-col shrink-0
				bg-[var(--vscode-input-background,var(--void-bg-2,#1e1e2e))]
				border border-[var(--vscode-panel-border,rgba(255,255,255,0.08))]
				rounded-2xl
				transition-[border-color,box-shadow] duration-200
				focus-within:border-[var(--vscode-focusBorder,#8B5CF6)]
				focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.12),inset_0_1px_0_rgba(255,255,255,0.04)]
				hover:border-[var(--vscode-widget-border,rgba(255,255,255,0.12))]
				p-3
				${className}
			`}
		>
			{/* File change summary bar — above the input */}
			{fileChanges && fileChanges.length > 0 && (
				<div className="mb-2">
					<FileChangeSummaryBar
						files={fileChanges}
						onAcceptAll={onAcceptAllChanges}
						onRevertFile={onRevertFile}
						onOpenDiff={onOpenFileDiff}
					/>
				</div>
			)}

			{/* Input textarea */}
			<InputBox
				value={inputValue}
				placeholder={placeholder}
				disabled={isDisabled || isStreaming}
				onChange={onInputChange}
				onSubmit={onSubmit}
				errorMessage={errorMessage}
				minRows={minRows}
				maxRows={maxRows}
				zoomUpRows={zoomUpRows}
				maxLength={maxLength}
				showCharCount={!!maxLength}
				className="w-full"
			/>

			{/* Bottom toolbar */}
			<div className="flex flex-row justify-between items-end gap-1 pt-2">
				{/* Left side: toolbar buttons */}
				<div className="flex items-center flex-wrap gap-x-1 gap-y-1">
					{/* @ Mention button */}
					{showMentionButton && (
						<button
							type="button"
							onClick={handleMentionClick}
							title="Mention a file or symbol (@)"
							className="
								flex items-center justify-center h-7 w-7 rounded-md
								text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.45))]
								hover:text-[var(--vscode-foreground,#cccccc)]
								hover:bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.06))]
								transition-colors cursor-pointer
							"
						>
							<span className="text-[15px] font-semibold leading-none">@</span>
						</button>
					)}

					{/* Attachment button */}
					{showAttachmentButton && (
						<button
							type="button"
							title="Attach files or images"
							className="
								flex items-center justify-center h-7 w-7 rounded-md
								text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.45))]
								hover:text-[var(--vscode-foreground,#cccccc)]
								hover:bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.06))]
								transition-colors cursor-pointer
							"
						>
							<span className="codicon codicon-add text-sm" />
						</button>
					)}

					{/* Agent mode toggle pill */}
					{showAgentModeToggle && onAgentModeChange && (
						<div className="flex items-center h-7 rounded-md border border-[var(--vscode-widget-border,rgba(255,255,255,0.1))] overflow-hidden ml-1">
							{(['Chat', 'Agent', 'V3Agent'] as const).map((mode) => (
								<button
									key={mode}
									type="button"
									onClick={() => onAgentModeChange(mode)}
									className={`
										px-2.5 h-full text-[11px] font-medium
										transition-colors cursor-pointer
										${agentMode === mode
											? 'bg-[var(--vscode-button-background,#8B5CF6)] text-white'
											: 'text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.5))] hover:text-[var(--vscode-foreground,#cccccc)] hover:bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.06))]'
										}
									`}
								>
									{mode === 'V3Agent' ? 'V3 Agent' : mode}
								</button>
							))}
						</div>
					)}

					{/* Model selector */}
					{showModelSelector && (
						<button
							type="button"
							onClick={onModelSelectorClick}
							className="
								flex items-center gap-1 h-7 px-2 rounded-md ml-1
								text-[11px] text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.5))]
								bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.04))]
								border border-[var(--vscode-widget-border,rgba(255,255,255,0.08))]
								hover:text-[var(--vscode-foreground,#cccccc)]
								hover:bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.08))]
								transition-colors cursor-pointer
							"
						>
							<span className="truncate max-w-[100px]">{modelName}</span>
							<span className="codicon codicon-chevron-down text-[10px]" />
						</button>
					)}
				</div>

				{/* Right side: submit/stop button */}
				<div className="flex items-center gap-2">
					{isStreaming ? (
						<button
							type="button"
							onClick={onAbort}
							className="
								flex items-center justify-center h-8 w-8 rounded-lg
								bg-[var(--vscode-inputValidation-errorBackground,rgba(229,20,0,0.1))]
								border border-[var(--vscode-inputValidation-errorBorder,rgba(229,20,0,0.4))]
								text-[var(--vscode-inputValidation-errorForeground,#e51400)]
								hover:brightness-110 transition-all cursor-pointer
							"
							title="Stop generating"
						>
							<IconSquare />
						</button>
					) : (
						<button
							type="button"
							onClick={onSubmit}
							disabled={isDisabled || !hasText}
							className={`
								flex items-center justify-center h-8 w-8 rounded-lg
								transition-all duration-200 cursor-pointer
								${hasText && !isDisabled
									? 'bg-[var(--vscode-button-background,#8B5CF6)] text-white hover:brightness-110 shadow-sm'
									: 'bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.06))] text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.3))]'
								}
								${isDisabled ? 'cursor-not-allowed opacity-40' : ''}
							`}
							title="Send message (Enter)"
						>
							<IconArrowUp
								className={hasText && !isDisabled ? 'text-white' : ''}
							/>
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

Composer.displayName = 'Composer';
