/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { PixelAlien } from './V3AlienHeader.js';
import { IsRunningType } from '../../../chatThreadService.js';

const toolPhrase = (name: string | null | undefined): string | undefined => {
	if (!name) return undefined;
	const n = name.toLowerCase();
	if (n.includes('semantic') || n.includes('search')) return 'indexing';
	if (n.includes('read') || n.includes('file')) return 'reading';
	if (n.includes('edit') || n.includes('write') || n.includes('rewrite')) return 'writing';
	if (n.includes('terminal') || n.includes('command')) return 'running';
	if (n.includes('web')) return 'searching';
	return 'working';
};

const runPhrase = (isRunning: IsRunningType | undefined): string => {
	if (isRunning === 'LLM') return 'planning';
	if (isRunning === 'tool') return 'working';
	if (isRunning === 'awaiting_user') return 'waiting';
	return 'v3code';
};

export function ChatActivityBanner({
	visible,
	isRunning,
	activeToolName,
	onClose,
}: {
	visible: boolean;
	isRunning?: IsRunningType;
	activeToolName?: string | null;
	onClose?: () => void;
}) {
	const phrase = useMemo(() => {
		return toolPhrase(activeToolName) ?? runPhrase(isRunning);
	}, [isRunning, activeToolName]);

	const agentBusy = !!isRunning && isRunning !== 'idle';

	return (
		<div
			className="overflow-hidden flex-shrink-0 transition-all duration-300 ease-out"
			style={{ maxHeight: visible ? 34 : 0, opacity: visible ? 1 : 0 }}
			aria-hidden={!visible}
		>
			<div className="flex items-center gap-2 h-[34px] px-3 border-b border-[var(--v3-amethyst-muted,rgba(124,58,237,0.18))] bg-[var(--v3-amethyst-wash,rgba(139,92,246,0.06))]">
				{/* sprite */}
				<div className="flex items-center flex-shrink-0">
					<PixelAlien cell={2} mode={agentBusy ? 'walk' : 'idle'} />
				</div>

				{/* subtle pulse dot */}
				<span className="relative flex h-1.5 w-1.5 flex-shrink-0">
					{agentBusy &&
						<span className="absolute inline-flex h-full w-full rounded-full bg-[#A78BFA] opacity-50 animate-ping" />
					}
					<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#A78BFA]" />
				</span>

				{/* status word */}
				<span className="text-xs font-medium tracking-wide lowercase text-void-fg-2">
					{phrase}…
				</span>

				<div className="flex-1" />

				{/* real close button — slides the banner up */}
				<button
					type="button"
					onClick={onClose}
					title="Hide activity banner"
					aria-label="Hide activity banner"
					className="flex items-center justify-center h-5 w-5 rounded text-void-fg-4 hover:text-void-fg-1 hover:bg-void-bg-3 transition-colors duration-150"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	);
}

const BANNER_STORAGE_KEY = 'void.chatActivityBanner.enabled';

export function readActivityBannerEnabled(): boolean {
	try {
		const v = localStorage.getItem(BANNER_STORAGE_KEY);
		return v === null ? true : v === 'true';
	} catch {
		return true;
	}
}

export function writeActivityBannerEnabled(on: boolean): void {
	try {
		localStorage.setItem(BANNER_STORAGE_KEY, String(on));
	} catch { /* private mode */ }
}

/** Compact pill + dot control for toggling the activity banner. */
export function ActivityBannerToggle({
	enabled,
	onChange,
	compact,
}: {
	enabled: boolean;
	onChange: (on: boolean) => void;
	/** When true, show only the status dot (for header corner). */
	compact?: boolean;
}) {
	if (compact) {
		return (
			<button
				type="button"
				onClick={() => onChange(!enabled)}
				title={enabled ? 'Activity banner on — click to hide' : 'Activity banner off — click to show'}
				aria-pressed={enabled}
				className={`h-2 w-2 rounded-full border-none p-0 cursor-pointer transition-colors duration-150 ${enabled ? 'bg-[#A78BFA]' : 'bg-void-fg-4 opacity-40 hover:opacity-70'}`}
			/>
		);
	}
	return (
		<button
			type="button"
			onClick={() => onChange(!enabled)}
			aria-pressed={enabled}
			title={enabled ? 'Hide activity banner' : 'Show activity banner'}
			className="group inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] px-2 py-0.5 rounded-full bg-void-bg-2/40 border border-void-border-3/60 hover:border-[var(--v3-amethyst-muted,rgba(124,58,237,0.4))] transition-colors duration-150"
		>
			<span className={`relative w-[22px] h-[12px] rounded-full transition-colors duration-200 ${enabled ? 'bg-[var(--v3-amethyst-muted,rgba(139,92,246,0.45))]' : 'bg-void-fg-4/30'}`}>
				<span className={`absolute top-[2px] h-2 w-2 rounded-full transition-all duration-200 ${enabled ? 'left-[12px] bg-[#A78BFA]' : 'left-[2px] bg-void-fg-4'}`} />
			</span>
			<span className={enabled ? 'text-void-fg-3' : 'text-void-fg-4'}>v active</span>
		</button>
	);
}
