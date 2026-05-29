/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccessor } from '../util/services.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AtMentionItem {
	type: 'file' | 'symbol';
	label: string;
	detail?: string;
	path: string;
	line?: number;
}

export interface AtMentionPopupProps {
	query: string;
	onSelect: (item: AtMentionItem) => void;
	onDismiss: () => void;
	visible: boolean;
	position: { top: number; left: number };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RESULTS = 20;
const CATEGORY_FILE = 'Files';
const CATEGORY_SYMBOL = 'Symbols';

// ---------------------------------------------------------------------------
// Styles (dark theme using CSS variables)
// ---------------------------------------------------------------------------

const styles = {
	overlay: {
		position: 'fixed' as const,
		inset: 0,
		zIndex: 9998,
	},
	container: (top: number, left: number): React.CSSProperties => ({
		position: 'fixed',
		top,
		left,
		zIndex: 9999,
		width: 320,
		maxHeight: 340,
		display: 'flex',
		flexDirection: 'column',
		background: 'var(--v3code-bg, #0f0f1a)',
		border: '1px solid var(--v3code-border, #2a2a3a)',
		borderRadius: 8,
		boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
		overflow: 'hidden',
		fontFamily: 'var(--vscode-font-family, system-ui, sans-serif)',
		fontSize: 13,
		color: 'var(--v3code-fg, #e0e0e0)',
	}),
	header: {
		padding: '8px 12px 4px',
		fontSize: 11,
		fontWeight: 600,
		textTransform: 'uppercase' as const,
		letterSpacing: '0.05em',
		opacity: 0.55,
		userSelect: 'none' as const,
	},
	list: {
		overflowY: 'auto' as const,
		flex: 1,
		padding: '4px 0',
	},
	item: (isActive: boolean): React.CSSProperties => ({
		display: 'flex',
		alignItems: 'center',
		gap: 8,
		padding: '6px 12px',
		cursor: 'pointer',
		background: isActive ? 'var(--v3code-accent, #8b5cf6)' : 'transparent',
		color: isActive ? '#fff' : 'var(--v3code-fg, #e0e0e0)',
		borderRadius: isActive ? 4 : 0,
		margin: isActive ? '0 4px' : 0,
		transition: 'background 80ms ease',
	}),
	icon: {
		width: 18,
		height: 18,
		flexShrink: 0,
		opacity: 0.7,
	},
	labelWrap: {
		display: 'flex',
		flexDirection: 'column' as const,
		overflow: 'hidden',
		minWidth: 0,
	},
	label: {
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap' as const,
	},
	detail: {
		fontSize: 11,
		opacity: 0.5,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap' as const,
	},
	empty: {
		padding: '16px 12px',
		textAlign: 'center' as const,
		opacity: 0.45,
	},
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function highlightMatch(text: string, query: string): React.ReactNode {
	if (!query) return text;
	const idx = text.toLowerCase().indexOf(query.toLowerCase());
	if (idx === -1) return text;
	return (
		<>
			{text.slice(0, idx)}
			<span style={{ color: 'var(--v3code-accent, #8b5cf6)', fontWeight: 600 }}>
				{text.slice(idx, idx + query.length)}
			</span>
			{text.slice(idx + query.length)}
		</>
	);
}

const FileIcon = () => (
	<svg style={styles.icon} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path
			d="M3 1.5h6.793L13 4.707V14.5H3V1.5z"
			stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
		/>
		<path d="M9 1.5V5h3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const SymbolIcon = () => (
	<svg style={styles.icon} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path
			d="M8 2L2 5.5v5L8 14l6-3.5v-5L8 2z"
			stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
		/>
		<path d="M2 5.5L8 9l6-3.5M8 9v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AtMentionPopup: React.FC<AtMentionPopupProps> = ({ query, onSelect, onDismiss, visible, position }) => {
	const accessor = useAccessor();
	const searchService = accessor.get('ISearchService');
	const workspaceContext = accessor.get('IWorkspaceContextService');

	const [results, setResults] = useState<AtMentionItem[]>([]);
	const [activeIndex, setActiveIndex] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);

	// -- search --------------------------------------------------------------

	const runSearch = useCallback(async (q: string) => {
		if (!q) {
			setResults([]);
			setActiveIndex(0);
			return;
		}

		const items: AtMentionItem[] = [];
		const folders = workspaceContext.getWorkspace().folders;
		if (folders.length === 0) {
			setResults([]);
			return;
		}

		try {
			const filePattern = `**/*${q}*`;
			const folderQueries = folders.map(f => ({ folder: f.uri }));
			const fileQuery = {
				type: 1 as const, // QueryType.File
				filePattern,
				folderQueries,
				maxResults: MAX_RESULTS,
			};

			const fileResults = await searchService.fileSearch(fileQuery);
			for (const match of fileResults.results) {
				const uri = match.resource;
				const segments = uri.path.split('/');
				const filename = segments[segments.length - 1] || uri.path;
				items.push({
					type: 'file',
					label: filename,
					detail: uri.fsPath,
					path: uri.fsPath,
				});
			}
		} catch {
			// file search unavailable; proceed with empty file results
		}

		setResults(items.slice(0, MAX_RESULTS));
		setActiveIndex(0);
	}, [searchService, workspaceContext]);

	useEffect(() => {
		if (!visible) return;
		const timer = setTimeout(() => runSearch(query), 120);
		return () => clearTimeout(timer);
	}, [query, visible, runSearch]);

	// -- keyboard navigation -------------------------------------------------

	useEffect(() => {
		if (!visible) return;

		const onKey = (e: KeyboardEvent) => {
			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					e.stopPropagation();
					setActiveIndex(i => (i + 1) % Math.max(results.length, 1));
					break;
				case 'ArrowUp':
					e.preventDefault();
					e.stopPropagation();
					setActiveIndex(i => (i - 1 + results.length) % Math.max(results.length, 1));
					break;
				case 'Enter':
					e.preventDefault();
					e.stopPropagation();
					if (results[activeIndex]) {
						onSelect(results[activeIndex]);
					}
					break;
				case 'Escape':
					e.preventDefault();
					e.stopPropagation();
					onDismiss();
					break;
			}
		};

		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [visible, results, activeIndex, onSelect, onDismiss]);

	// -- scroll active item into view ----------------------------------------

	useEffect(() => {
		const container = listRef.current;
		if (!container) return;
		const activeEl = container.children[activeIndex] as HTMLElement | undefined;
		activeEl?.scrollIntoView({ block: 'nearest' });
	}, [activeIndex]);

	// -- render --------------------------------------------------------------

	if (!visible) return null;

	const fileItems = results.filter(r => r.type === 'file');
	const symbolItems = results.filter(r => r.type === 'symbol');

	return (
		<>
			{/* Invisible backdrop to catch clicks outside */}
			<div style={styles.overlay} onClick={onDismiss} />

			<div style={styles.container(position.top, position.left)}>
				<div style={styles.list} ref={listRef}>
					{results.length === 0 && (
						<div style={styles.empty}>
							{query ? 'No results' : 'Type to search files and symbols'}
						</div>
					)}

					{fileItems.length > 0 && (
						<>
							<div style={styles.header}>{CATEGORY_FILE}</div>
							{fileItems.map((item) => {
								const globalIdx = results.indexOf(item);
								return (
									<div
										key={`file-${item.path}`}
										style={styles.item(globalIdx === activeIndex)}
										onMouseEnter={() => setActiveIndex(globalIdx)}
										onClick={() => onSelect(item)}
									>
										<FileIcon />
										<div style={styles.labelWrap}>
											<div style={styles.label}>{highlightMatch(item.label, query)}</div>
											{item.detail && <div style={styles.detail}>{item.detail}</div>}
										</div>
									</div>
								);
							})}
						</>
					)}

					{symbolItems.length > 0 && (
						<>
							<div style={styles.header}>{CATEGORY_SYMBOL}</div>
							{symbolItems.map((item) => {
								const globalIdx = results.indexOf(item);
								return (
									<div
										key={`sym-${item.path}-${item.line}`}
										style={styles.item(globalIdx === activeIndex)}
										onMouseEnter={() => setActiveIndex(globalIdx)}
										onClick={() => onSelect(item)}
									>
										<SymbolIcon />
										<div style={styles.labelWrap}>
											<div style={styles.label}>{highlightMatch(item.label, query)}</div>
											{item.detail && <div style={styles.detail}>{item.detail}</div>}
										</div>
									</div>
								);
							})}
						</>
					)}
				</div>
			</div>
		</>
	);
};

export default AtMentionPopup;
