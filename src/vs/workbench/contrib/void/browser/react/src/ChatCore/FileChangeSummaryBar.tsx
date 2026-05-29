/*--------------------------------------------------------------------------------------
 *  V3Code ChatCore — File change summary bar (above the chat input)
 *  Shows: "3 files changed — Done ✓" with expandable file list
 *  Patterns extracted from Trae's TasksHub file list (ex_, exb)
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileChangeItem {
	filePath: string;
	relativePath: string;
	insertions: number;
	deletions: number;
	isNew?: boolean;
}

export interface FileChangeSummaryBarProps {
	files: FileChangeItem[];
	onAcceptAll?: () => void;
	onRevertFile?: (filePath: string) => void;
	onOpenDiff?: (filePath: string) => void;
	className?: string;
}

// ---------------------------------------------------------------------------
// File type colors
// ---------------------------------------------------------------------------

const fileTypeColors: Record<string, string> = {
	ts: '#3178C6',
	tsx: '#61DAFB',
	js: '#F7DF1E',
	jsx: '#61DAFB',
	css: '#1572B6',
	html: '#E34F26',
	json: '#F5A623',
	py: '#3776AB',
	rs: '#DEA584',
	go: '#00ADD8',
	md: '#8B5CF6',
	svg: '#FFB13B',
};

function getFileExtension(filePath: string): string {
	const parts = filePath.split('.');
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function getFileColor(filePath: string): string {
	const ext = getFileExtension(filePath);
	return fileTypeColors[ext] || '#8B8B8B';
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const IconNewFile = ({ color }: { color: string }) => (
	<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect x="2" y="0.5" width="10" height="13" rx="1.5" stroke={color} fill="none" strokeWidth="0.8" />
		<line x1="5" y1="4" x2="9" y2="4" stroke={color} strokeWidth="0.7" />
		<line x1="5" y1="6.5" x2="9" y2="6.5" stroke={color} strokeWidth="0.7" />
		<line x1="5" y1="9" x2="7.5" y2="9" stroke={color} strokeWidth="0.7" />
	</svg>
);

const IconEditFile = ({ color }: { color: string }) => (
	<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect x="2" y="0.5" width="10" height="13" rx="1.5" stroke={color} fill="none" strokeWidth="0.8" />
		<path d="M4.5 9.5L4.5 10.5L5.5 10.5L9.2 6.8L8.2 5.8L4.5 9.5Z" fill={color} opacity="0.6" />
	</svg>
);

const IconChevronDown = ({ className = '' }: { className?: string }) => (
	<svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={className}>
		<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FileChangeSummaryBar: React.FC<FileChangeSummaryBarProps> = ({
	files,
	onAcceptAll,
	onRevertFile,
	onOpenDiff,
	className = '',
}) => {
	const [isExpanded, setIsExpanded] = useState(false);
	const totalAdditions = files.reduce((sum, f) => sum + f.insertions, 0);
	const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

	const handleToggle = useCallback(() => {
		setIsExpanded((prev) => !prev);
	}, []);

	if (files.length === 0) {
		return (
			<div className={`text-[11px] text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.4))] py-1 ${className}`}>
				No files with changes
			</div>
		);
	}

	return (
		<div className={`v3code-file-changes ${className}`}>
			{/* Summary header — click to expand */}
			<button
				type="button"
				onClick={handleToggle}
				className="
					flex items-center gap-2 w-full py-1
					text-[11px] text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.5))]
					hover:text-[var(--vscode-foreground,#cccccc)]
					transition-colors cursor-pointer
					bg-transparent border-none
				"
			>
				<IconChevronDown
					className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
				/>
				<span>
					{files.length} {files.length === 1 ? 'file' : 'files'} changed
				</span>
				<span className="text-[var(--vscode-terminal-ansiGreen,#26A57B)]">
					+{totalAdditions}
				</span>
				<span className="text-[var(--vscode-terminal-ansiRed,#e51400)]">
					-{totalDeletions}
				</span>
				{onAcceptAll && (
					<span
						className="ml-auto text-[var(--vscode-terminal-ansiGreen,#26A57B)] hover:brightness-125 font-medium"
						onClick={(e) => {
							e.stopPropagation();
							onAcceptAll();
						}}
					>
						Done ✓
					</span>
				)}
			</button>

			{/* Expanded file list — Trae ex_/exb pattern */}
			{isExpanded && (
				<div className="flex flex-col gap-0.5 mt-1 mb-2 pl-4">
					{files.map((file) => {
						const color = getFileColor(file.filePath);
						const basename = file.filePath.split('/').pop() || file.filePath;
						return (
							<div
								key={file.filePath}
								className="
									flex items-center gap-1.5 py-0.5
									text-[11px] cursor-pointer
									hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.04))]
									rounded px-1 -mx-1 transition-colors
								"
								onClick={() => onOpenDiff?.(file.filePath)}
							>
								{/* File type icon */}
								<span className="shrink-0">
									{file.isNew
										? <IconNewFile color={color} />
										: <IconEditFile color={color} />
									}
								</span>

								{/* Filename */}
								<span className="text-[var(--vscode-foreground,#cccccc)] font-medium truncate max-w-[200px]">
									{basename}
								</span>

								{/* Path */}
								<span className="text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.35))] truncate max-w-[150px] hidden sm:inline">
									{file.relativePath}
								</span>

								{/* +/- counts */}
								<span className="text-[var(--vscode-terminal-ansiGreen,#26A57B)] ml-auto shrink-0">
									+{file.insertions}
								</span>
								<span className="text-[var(--vscode-terminal-ansiRed,#e51400)] shrink-0">
									-{file.deletions}
								</span>

								{/* Open diff button */}
								<button
									type="button"
									className="
										ml-1 px-1.5 py-0.5 rounded text-[10px]
										bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.06))]
										text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.5))]
										hover:text-[var(--vscode-foreground,#cccccc)]
										hover:bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.1))]
										transition-colors shrink-0
									"
									onClick={(e) => {
										e.stopPropagation();
										onOpenDiff?.(file.filePath);
									}}
								>
									Diff
								</button>

								{/* Revert button */}
								{onRevertFile && (
									<button
										type="button"
										className="
											px-1.5 py-0.5 rounded text-[10px]
											text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.4))]
											hover:text-[var(--vscode-inputValidation-errorForeground,#e51400)]
											transition-colors shrink-0
										"
										onClick={(e) => {
											e.stopPropagation();
											onRevertFile(file.filePath);
										}}
									>
										Revert
									</button>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

FileChangeSummaryBar.displayName = 'FileChangeSummaryBar';
