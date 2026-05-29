/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pill } from './VibeComponents.js';

// ---- Types ----

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface TodoItem {
	id: string;
	content: string;
	status: TodoStatus;
	children?: TodoItem[];
}

// ---- Status icon map ----

const STATUS_ICONS: Record<TodoStatus, string> = {
	pending: '○',
	in_progress: '◉',
	completed: '✓',
	cancelled: '✗',
};

const STATUS_COLORS: Record<TodoStatus, string> = {
	pending: 'var(--v3code-fg-tertiary)',
	in_progress: 'var(--v3code-blue)',
	completed: 'var(--v3code-green)',
	cancelled: 'var(--v3code-fg-disabled)',
};

const STATUS_PILL: Record<TodoStatus, 'blue' | 'green' | 'red' | 'purple'> = {
	pending: 'purple',
	in_progress: 'blue',
	completed: 'green',
	cancelled: 'red',
};

// ---- Single Todo Item ----

interface TodoItemViewProps {
	item: TodoItem;
	depth?: number;
	onStatusChange: (id: string, status: TodoStatus) => void;
	onContentChange: (id: string, content: string) => void;
	focusedId: string | null;
	onFocus: (id: string) => void;
}

const TodoItemView: React.FC<TodoItemViewProps> = ({
	item,
	depth = 0,
	onStatusChange,
	onContentChange,
	focusedId,
	onFocus,
}) => {
	const isFocused = focusedId === item.id;
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isDone = item.status === 'completed' || item.status === 'cancelled';

	useEffect(() => {
		if (isFocused && textareaRef.current) {
			textareaRef.current.focus();
		}
	}, [isFocused]);

	const cycleStatus = useCallback(() => {
		const order: TodoStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];
		const idx = order.indexOf(item.status);
		onStatusChange(item.id, order[(idx + 1) % order.length]);
	}, [item.status, item.id, onStatusChange]);

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			cycleStatus();
		}
	}, [cycleStatus]);

	return (
		<div style={{ paddingLeft: depth * 16 }}>
			<div
				className="v3code-todo-item"
				data-todo-id={item.id}
				style={{
					display: 'flex',
					alignItems: 'flex-start',
					gap: '8px',
					padding: '4px 0',
					fontSize: 'var(--v3code-font-size-base)',
					color: isDone ? 'var(--v3code-fg-tertiary)' : 'var(--v3code-fg)',
					textDecoration: isDone ? 'line-through' : 'none',
					opacity: isDone ? 0.6 : 1,
				}}
			>
				{/* Status indicator */}
				<button
					onClick={cycleStatus}
					style={{
						width: '20px',
						height: '20px',
						borderRadius: '50%',
						border: `1.5px solid ${STATUS_COLORS[item.status]}`,
						background: item.status === 'completed' ? STATUS_COLORS[item.status] : 'transparent',
						color: item.status === 'completed' ? '#fff' : STATUS_COLORS[item.status],
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						cursor: 'pointer',
						fontSize: '11px',
						flexShrink: 0,
						marginTop: '1px',
						transition: 'all 0.15s ease',
					}}
					title="Click to cycle status (Enter key)"
				>
					{STATUS_ICONS[item.status]}
				</button>

				{/* Content */}
				<textarea
					ref={textareaRef}
					value={item.content}
					onChange={e => onContentChange(item.id, e.target.value)}
					onFocus={() => onFocus(item.id)}
					onKeyDown={handleKeyDown}
					rows={1}
					style={{
						flex: 1,
						background: 'transparent',
						border: isFocused ? '1px solid var(--v3code-border-focus)' : '1px solid transparent',
						borderRadius: 'var(--v3code-radius-sm)',
						color: 'inherit',
						fontSize: 'inherit',
						fontFamily: 'inherit',
						resize: 'none',
						outline: 'none',
						padding: '1px 4px',
						textDecoration: 'inherit',
					}}
				/>

				{/* Status pill */}
				<Pill
					label={item.status.replace('_', ' ')}
					color={STATUS_PILL[item.status]}
					size="sm"
				/>
			</div>

			{/* Children */}
			{item.children?.map(child => (
				<TodoItemView
					key={child.id}
					item={child}
					depth={depth + 1}
					onStatusChange={onStatusChange}
					onContentChange={onContentChange}
					focusedId={focusedId}
					onFocus={onFocus}
				/>
			))}
		</div>
	);
};

// ---- Todo List Container ----

interface TodoListProps {
	items: TodoItem[];
	onItemsChange: (items: TodoItem[]) => void;
	className?: string;
}

export const TodoList: React.FC<TodoListProps> = ({ items, onItemsChange, className }) => {
	const [focusedId, setFocusedId] = useState<string | null>(null);

	const updateItem = useCallback((id: string, updater: (item: TodoItem) => TodoItem) => {
		const update = (list: TodoItem[]): TodoItem[] =>
			list.map(item => {
				if (item.id === id) return updater(item);
				if (item.children) return { ...item, children: update(item.children) };
				return item;
			});
		onItemsChange(update(items));
	}, [items, onItemsChange]);

	const handleStatusChange = useCallback((id: string, status: TodoStatus) => {
		updateItem(id, item => ({ ...item, status }));
	}, [updateItem]);

	const handleContentChange = useCallback((id: string, content: string) => {
		updateItem(id, item => ({ ...item, content }));
	}, [updateItem]);

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		// Accept all / Reject all shortcuts
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			const allDone = items.every(i => i.status === 'completed');
			const newStatus: TodoStatus = allDone ? 'pending' : 'completed';
			onItemsChange(items.map(i => ({ ...i, status: newStatus })));
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
			e.preventDefault();
			onItemsChange(items.map(i => ({ ...i, status: 'cancelled' })));
		}
	}, [items, onItemsChange]);

	const counts = {
		total: items.length,
		done: items.filter(i => i.status === 'completed').length,
		inProgress: items.filter(i => i.status === 'in_progress').length,
	};

	return (
		<div className={className} onKeyDown={handleKeyDown} style={{ userSelect: 'none' }}>
			{/* Header with counts */}
			<div style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				padding: '8px 0',
				marginBottom: '4px',
				borderBottom: '1px solid var(--v3code-border)',
			}}>
				<span style={{
					fontSize: 'var(--v3code-font-size-sm)',
					fontWeight: 600,
					color: 'var(--v3code-fg-secondary)',
					textTransform: 'uppercase',
					letterSpacing: '0.5px',
				}}>
					Task List
				</span>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
					{counts.inProgress > 0 && (
						<Pill label={`${counts.inProgress} active`} color="blue" size="sm" />
					)}
					<Pill label={`${counts.done}/${counts.total}`} color="green" size="sm" />
				</div>
			</div>

			{/* Keyboard hints */}
			<div style={{
				fontSize: '10px',
				color: 'var(--v3code-fg-disabled)',
				marginBottom: '8px',
				display: 'flex',
				gap: '12px',
			}}>
				<span>Enter: cycle status</span>
				<span>Ctrl+Enter: accept all</span>
				<span>Ctrl+Backspace: cancel all</span>
			</div>

			{/* Todo items */}
			<div>
				{items.map(item => (
					<TodoItemView
						key={item.id}
						item={item}
						onStatusChange={handleStatusChange}
						onContentChange={handleContentChange}
						focusedId={focusedId}
						onFocus={setFocusedId}
					/>
				))}
			</div>

			{/* Accept/Reject all buttons */}
			<div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
				<button
					className="v3code-btn v3code-btn--sm v3code-btn--primary"
					onClick={() => onItemsChange(items.map(i => ({ ...i, status: 'completed' as TodoStatus })))}
				>
					Accept All
				</button>
				<button
					className="v3code-btn v3code-btn--sm v3code-btn--secondary"
					onClick={() => onItemsChange(items.map(i => ({ ...i, status: 'cancelled' as TodoStatus })))}
				>
					Reject All
				</button>
			</div>
		</div>
	);
};

// ---- Plan Mode Panel ----

interface PlanModeProps {
	planContent?: string;
	isStreaming?: boolean;
	onSaveToWorkspace?: () => void;
	className?: string;
}

export const PlanModePanel: React.FC<PlanModeProps> = ({
	planContent,
	isStreaming = false,
	onSaveToWorkspace,
	className,
}) => (
	<div className={className} style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
		<div style={{
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			marginBottom: '12px',
		}}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
				<span style={{ display: 'inline-flex', color: 'var(--v3code-accent, #8B5CF6)' }}>
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
						<path d="M5 6h6M5 9h6M5 12h3" />
					</svg>
				</span>
				<span style={{ fontSize: 'var(--v3code-font-size-md)', fontWeight: 600, color: 'var(--v3code-fg)' }}>
					Plan
				</span>
				{isStreaming && (
					<span style={{
						fontSize: 'var(--v3code-font-size-xs)',
						color: 'var(--v3code-blue)',
						animation: 'v3code-glow-pulse 2s ease infinite',
					}}>
						streaming...
					</span>
				)}
			</div>
			{onSaveToWorkspace && planContent && (
				<button
					className="v3code-btn v3code-btn--sm v3code-btn--secondary"
					onClick={onSaveToWorkspace}
				>
					Save to Workspace
				</button>
			)}
		</div>

		{planContent ? (
			<div style={{
				background: 'var(--v3code-bg-tertiary)',
				border: '1px solid var(--v3code-border)',
				borderRadius: 'var(--v3code-radius-lg)',
				padding: '16px',
				fontSize: 'var(--v3code-font-size-base)',
				color: 'var(--v3code-fg)',
				whiteSpace: 'pre-wrap',
				fontFamily: 'var(--v3code-font-family)',
				lineHeight: '1.6',
			}}>
				{planContent}
			</div>
		) : (
			<div style={{
				textAlign: 'center',
				color: 'var(--v3code-fg-tertiary)',
				padding: '48px 16px',
				fontSize: 'var(--v3code-font-size-base)',
			}}>
				{isStreaming ? 'Generating plan...' : 'No plan yet. Start an agent task to see the plan here.'}
			</div>
		)}
	</div>
);

// ---- Agent Tray Row ----

interface AgentTrayRowProps {
	name: string;
	type: 'subagent' | 'mode' | 'skill' | 'command' | 'action';
	status: 'pending' | 'running' | 'completed' | 'error' | 'needs_attention';
	onClick?: () => void;
	className?: string;
}

const TYPE_COLORS: Record<string, 'magenta' | 'blue' | 'cyan' | 'green' | 'purple'> = {
	subagent: 'magenta',
	mode: 'blue',
	skill: 'cyan',
	command: 'green',
	action: 'purple',
};

const STATUS_INDICATOR: Record<string, { color: string; pulse: boolean }> = {
	pending: { color: 'var(--v3code-fg-tertiary)', pulse: false },
	running: { color: 'var(--v3code-blue)', pulse: true },
	completed: { color: 'var(--v3code-green)', pulse: false },
	error: { color: 'var(--v3code-red)', pulse: false },
	needs_attention: { color: 'var(--v3code-yellow)', pulse: true },
};

export const AgentTrayRow: React.FC<AgentTrayRowProps> = ({
	name,
	type,
	status,
	onClick,
	className,
}) => {
	const ind = STATUS_INDICATOR[status] ?? STATUS_INDICATOR.pending;

	return (
		<div
			className={className}
			onClick={onClick}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '8px',
				padding: '8px 12px',
				borderRadius: 'var(--v3code-radius-md)',
				cursor: onClick ? 'pointer' : 'default',
				transition: 'background 0.15s ease',
				background: 'transparent',
			}}
			onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'var(--v3code-bg-hover)'; }}
			onMouseLeave={e => { if (onClick) e.currentTarget.style.background = 'transparent'; }}
		>
			{/* Status dot */}
			<span
				className={`v3code-subagent-status-dot${ind.pulse ? ' v3code-subagent-status-dot--pulse' : ''}`}
				style={{
					width: 'var(--v3code-agent-status-dot-size)',
					height: 'var(--v3code-agent-status-dot-size)',
					borderRadius: '50%',
					background: ind.color,
					flexShrink: 0,
					boxShadow: ind.pulse ? `0 0 6px ${ind.color}` : 'none',
				}}
			/>

			{/* Name */}
			<span style={{
				flex: 1,
				fontSize: 'var(--v3code-font-size-sm)',
				color: 'var(--v3code-fg)',
				fontWeight: 500,
			}}>
				{name}
			</span>

			{/* Type + Status pills */}
			<div style={{ display: 'flex', gap: '4px' }}>
				<Pill label={type} color={TYPE_COLORS[type] ?? 'purple'} size="sm" />
				<Pill label={status.replace('_', ' ')} color={
					status === 'completed' ? 'green' :
					status === 'error' ? 'red' :
					status === 'running' ? 'blue' :
					status === 'needs_attention' ? 'yellow' :
					'purple'
				} size="sm" />
			</div>

			{/* Pulse animation CSS */}
			<style>{`
				.v3code-subagent-status-dot--pulse {
					animation: v3code-glow-pulse 2s ease infinite;
				}
			`}</style>
		</div>
	);
};
