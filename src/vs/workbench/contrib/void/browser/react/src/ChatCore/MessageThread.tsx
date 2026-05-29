/*--------------------------------------------------------------------------------------
 *  V3Code ChatCore — Message rendering components
 *  MessageBubble: single message (user/assistant/system)
 *  MessageThread: message list with virtual scrolling support
 *--------------------------------------------------------------------------------------*/

import React, { useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	/** Whether this message is currently being streamed */
	isStreaming?: boolean;
	/** Reasoning/thought process content (DeepSeek reasoning models) */
	thoughtProcess?: string;
	/** Tool calls made during this message */
	toolCalls?: ToolCall[];
	/** File diffs associated with this message */
	fileDiffs?: InlineDiff[];
	/** Completion info */
	completionStatus?: {
		totalTokens?: number;
		completionTokens?: number;
		isComplete: boolean;
	};
	timestamp?: number;
}

export interface ToolCall {
	id: string;
	name: string;
	description: string;
	isRunning: boolean;
	result?: string;
	error?: string;
}

export interface InlineDiff {
	filePath: string;
	relativePath: string;
	insertions: number;
	deletions: number;
	isNew?: boolean;
}

// ---------------------------------------------------------------------------
// Inline Tool Call Display
// ---------------------------------------------------------------------------

const ToolCallCard: React.FC<{ tool: ToolCall }> = ({ tool }) => {
	const [isExpanded, setIsExpanded] = React.useState(false);

	return (
		<div
			className={`
				v3code-tool-call
				my-1 rounded-lg border overflow-hidden
				transition-all duration-200
				${tool.isRunning
					? 'border-[var(--vscode-focusBorder,#8B5CF6)] bg-[rgba(139,92,246,0.06)]'
					: tool.error
						? 'border-[var(--vscode-inputValidation-errorBorder,#e51400)] bg-[rgba(229,20,0,0.04)]'
						: 'border-[var(--vscode-widget-border,rgba(255,255,255,0.08))] bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.02))]'
				}
			`}
		>
			{/* Summary row */}
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="
					flex items-center gap-2 w-full px-3 py-1.5
					text-[12px] cursor-pointer bg-transparent border-none
					hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.03))]
					transition-colors
				"
			>
				{/* Status icon */}
				<span className="shrink-0">
					{tool.isRunning ? (
						<span className="inline-block w-3 h-3 border-2 border-[var(--vscode-focusBorder,#8B5CF6)] border-t-transparent rounded-full animate-spin" />
					) : tool.error ? (
						<span className="codicon codicon-error text-[var(--vscode-inputValidation-errorForeground,#e51400)] text-xs" />
					) : (
						<span className="codicon codicon-check text-[var(--vscode-terminal-ansiGreen,#26A57B)] text-xs" />
					)}
				</span>

				{/* Tool name + description */}
				<span className="font-medium text-[var(--vscode-foreground,#cccccc)]">
					{tool.name}
				</span>
				<span className="text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.45))] truncate">
					— {tool.description}
				</span>

				{/* Expand chevron */}
				<span className={`codicon codicon-chevron-down text-[10px] ml-auto transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
			</button>

			{/* Expanded details */}
			{isExpanded && (
				<div className="px-3 pb-2 text-[11px] text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.5))] font-mono whitespace-pre-wrap border-t border-[var(--vscode-widget-border,rgba(255,255,255,0.06))] pt-1.5 mt-0">
					{tool.result && (
						<div className="text-[var(--vscode-terminal-ansiGreen,#26A57B)]">
							{tool.result}
						</div>
					)}
					{tool.error && (
						<div className="text-[var(--vscode-inputValidation-errorForeground,#e51400)]">
							{tool.error}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

// ---------------------------------------------------------------------------
// Inline Diff Card
// ---------------------------------------------------------------------------

const fileTypeColors: Record<string, string> = {
	ts: '#3178C6', tsx: '#61DAFB', js: '#F7DF1E', jsx: '#61DAFB',
	css: '#1572B6', html: '#E34F26', json: '#F5A623', py: '#3776AB',
	rs: '#DEA584', go: '#00ADD8', md: '#8B5CF6',
};

const getExt = (p: string) => p.split('.').pop()?.toLowerCase() || '';

const InlineDiffCard: React.FC<{ diff: InlineDiff; onOpenDiff?: (path: string) => void }> = ({ diff, onOpenDiff }) => {
	const ext = getExt(diff.filePath);
	const color = fileTypeColors[ext] || '#8B8B8B';
	const basename = diff.filePath.split('/').pop() || diff.filePath;

	return (
		<div
			className="
				v3code-inline-diff
				flex items-center gap-1.5 my-1 px-2 py-1.5
				rounded-lg border border-[var(--vscode-widget-border,rgba(255,255,255,0.08))]
				bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.02))]
				text-[11px]
				hover:border-[var(--vscode-focusBorder,rgba(139,92,246,0.4))]
				transition-colors cursor-pointer
			"
			onClick={() => onOpenDiff?.(diff.filePath)}
		>
			{/* File type badge */}
			<span
				className="shrink-0 px-1 py-0.5 rounded text-[10px] font-semibold uppercase"
				style={{ backgroundColor: `${color}20`, color }}
			>
				{ext}
			</span>

			{/* Filename */}
			<span className="font-medium text-[var(--vscode-foreground,#cccccc)] truncate max-w-[180px]">
				{basename}
			</span>

			{/* Path */}
			<span className="text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.35))] truncate max-w-[150px] hidden sm:inline">
				{diff.relativePath}
			</span>

			{/* +/- counts */}
			<span className="ml-auto text-[var(--vscode-terminal-ansiGreen,#26A57B)] shrink-0">
				+{diff.insertions}
			</span>
			<span className="text-[var(--vscode-terminal-ansiRed,#e51400)] shrink-0">
				-{diff.deletions}
			</span>

			{/* Open diff */}
			<button
				type="button"
				className="
					ml-1 px-2 py-0.5 rounded text-[10px]
					bg-[var(--vscode-button-background,#8B5CF6)] text-white
					hover:brightness-110 transition-all shrink-0
				"
				onClick={(e) => {
					e.stopPropagation();
					onOpenDiff?.(diff.filePath);
				}}
			>
				Open Diff
			</button>
		</div>
	);
};

// ---------------------------------------------------------------------------
// Thought Process (collapsible reasoning)
// ---------------------------------------------------------------------------

const ThoughtProcess: React.FC<{ content: string }> = ({ content }) => {
	const [isExpanded, setIsExpanded] = React.useState(false);

	return (
		<div className="my-1">
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="
					flex items-center gap-1.5 text-[11px] cursor-pointer
					bg-transparent border-none
					text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.45))]
					hover:text-[var(--vscode-foreground,#cccccc)]
					transition-colors
				"
			>
				<span className={`codicon text-xs transition-transform ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} />
				Thought process
			</button>
			{isExpanded && (
				<div className="
					mt-1 ml-4 pl-3 py-1.5
					border-l-2 border-[var(--vscode-widget-border,rgba(255,255,255,0.1))]
					text-[12px] text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.45))]
					italic whitespace-pre-wrap
				">
					{content}
				</div>
			)}
		</div>
	);
};

// ---------------------------------------------------------------------------
// Checkpoint separator
// ---------------------------------------------------------------------------

const Checkpoint: React.FC = () => (
	<div className="flex items-center gap-2 my-4">
		<div className="flex-1 h-px bg-[var(--vscode-widget-border,rgba(255,255,255,0.06))]" />
		<span className="text-[10px] text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.25))] uppercase tracking-wider">
			Checkpoint
		</span>
		<div className="flex-1 h-px bg-[var(--vscode-widget-border,rgba(255,255,255,0.06))]" />
	</div>
);

// ---------------------------------------------------------------------------
// Completion indicator
// ---------------------------------------------------------------------------

const CompletionIndicator: React.FC<{ totalTokens?: number; completionTokens?: number; isComplete: boolean }> = ({
	totalTokens,
	completionTokens,
	isComplete,
}) => {
	if (!isComplete && !totalTokens) return null;

	const pct = totalTokens && completionTokens
		? Math.round((completionTokens / totalTokens) * 100)
		: 100;

	return (
		<div className="flex items-center gap-1.5 my-1 text-[10px] text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.35))]">
			{isComplete && (
				<>
					<span className="w-1.5 h-1.5 rounded-full bg-[var(--vscode-terminal-ansiGreen,#26A57B)]" />
					Completed
				</>
			)}
			{totalTokens && (
				<span>
					{totalTokens.toLocaleString()} tokens
					{completionTokens ? ` (${completionTokens.toLocaleString()} output)` : ''}
				</span>
			)}
		</div>
	);
};

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
	message: ChatMessage;
	onOpenDiff?: (filePath: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onOpenDiff }) => {
	const isUser = message.role === 'user';
	const isAssistant = message.role === 'assistant';

	return (
		<div
			className={`
				v3code-message-bubble
				${isUser
					? 'flex justify-end'
					: 'flex justify-start'
				}
			`}
		>
			<div
				className={`
					max-w-[85%]
					${isUser
						? 'bg-[var(--vscode-button-background,#8B5CF6)] bg-opacity-15 rounded-2xl rounded-br-md px-4 py-2.5'
						: 'px-1'
					}
				`}
			>
				{/* Thought process for assistant messages */}
				{isAssistant && message.thoughtProcess && (
					<ThoughtProcess content={message.thoughtProcess} />
				)}

				{/* Main content */}
				<div
					className={`
						text-[13px] leading-[20px] whitespace-pre-wrap
						${isUser
							? 'text-[var(--vscode-foreground,#cccccc)]'
							: 'text-[var(--vscode-foreground,#cccccc)]'
						}
					`}
				>
					{message.content}
				</div>

				{/* Streaming cursor */}
				{message.isStreaming && (
					<span className="inline-block w-[2px] h-[16px] bg-[var(--vscode-focusBorder,#8B5CF6)] animate-pulse ml-0.5 align-text-bottom" />
				)}

				{/* Tool calls */}
				{message.toolCalls && message.toolCalls.length > 0 && (
					<div className="mt-2">
						{message.toolCalls.map((tc) => (
							<ToolCallCard key={tc.id} tool={tc} />
						))}
					</div>
				)}

				{/* File diffs */}
				{message.fileDiffs && message.fileDiffs.length > 0 && (
					<div className="mt-2">
						{message.fileDiffs.map((diff, i) => (
							<InlineDiffCard key={`${diff.filePath}-${i}`} diff={diff} onOpenDiff={onOpenDiff} />
						))}
					</div>
				)}

				{/* Completion indicator */}
				{message.completionStatus && (
					<CompletionIndicator {...message.completionStatus} />
				)}
			</div>
		</div>
	);
};

// ---------------------------------------------------------------------------
// MessageThread
// ---------------------------------------------------------------------------

interface MessageThreadProps {
	messages: ChatMessage[];
	onOpenDiff?: (filePath: string) => void;
	className?: string;
	/** Ref for the scroll container */
	scrollRef?: React.RefObject<HTMLDivElement | null>;
}

export const MessageThread: React.FC<MessageThreadProps> = ({
	messages,
	onOpenDiff,
	className = '',
	scrollRef,
}) => {
	return (
		<div
			ref={scrollRef}
			className={`
				v3code-message-thread
				flex flex-col gap-1 py-2 px-1
				overflow-y-auto
				${className}
			`}
		>
			{messages.length === 0 && (
				<div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.35))]">
					<span className="text-[13px]">Message V3Code to get started</span>
					<div className="flex flex-col gap-1.5 text-[12px]">
						<button
							type="button"
							className="px-3 py-1.5 rounded-lg border border-[var(--vscode-widget-border,rgba(255,255,255,0.08))] bg-transparent text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.4))] hover:text-[var(--vscode-foreground,#cccccc)] hover:border-[var(--vscode-focusBorder,rgba(139,92,246,0.4))] transition-colors cursor-pointer"
						>
							Explain this codebase
						</button>
						<button
							type="button"
							className="px-3 py-1.5 rounded-lg border border-[var(--vscode-widget-border,rgba(255,255,255,0.08))] bg-transparent text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.4))] hover:text-[var(--vscode-foreground,#cccccc)] hover:border-[var(--vscode-focusBorder,rgba(139,92,246,0.4))] transition-colors cursor-pointer"
						>
							Find bugs in the current file
						</button>
						<button
							type="button"
							className="px-3 py-1.5 rounded-lg border border-[var(--vscode-widget-border,rgba(255,255,255,0.08))] bg-transparent text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.4))] hover:text-[var(--vscode-foreground,#cccccc)] hover:border-[var(--vscode-focusBorder,rgba(139,92,246,0.4))] transition-colors cursor-pointer"
						>
							Refactor the selected function
						</button>
					</div>
				</div>
			)}

			{messages.map((msg, idx) => {
				// Checkpoint between exchanges (user message after an assistant message)
				const showCheckpoint = idx > 0
					&& messages[idx - 1].role === 'assistant'
					&& msg.role === 'user'
					&& !msg.isStreaming;

				return (
					<React.Fragment key={msg.id}>
						{showCheckpoint && <Checkpoint />}
						<MessageBubble message={msg} onOpenDiff={onOpenDiff} />
					</React.Fragment>
				);
			})}
		</div>
	);
};

MessageThread.displayName = 'MessageThread';

export { ToolCallCard, InlineDiffCard, ThoughtProcess, Checkpoint, CompletionIndicator };
