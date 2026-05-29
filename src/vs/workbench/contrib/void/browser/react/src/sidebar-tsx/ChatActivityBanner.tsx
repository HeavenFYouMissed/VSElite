/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useMemo } from 'react';
import { PixelAlien } from './V3AlienHeader.js';
import { IsRunningType } from '../../../chatThreadService.js';

const BASE_PHRASES = ['planning', 'v3code', 'working', 'indexing', 'reading'] as const;

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
}: {
	visible: boolean;
	isRunning?: IsRunningType;
	activeToolName?: string | null;
}) {
	const phrases = useMemo(() => {
		const primary = toolPhrase(activeToolName) ?? runPhrase(isRunning);
		const rest = BASE_PHRASES.filter(p => p !== primary);
		return [primary, ...rest];
	}, [isRunning, activeToolName]);

	const agentBusy = !!isRunning && isRunning !== 'idle';

	return (
		<div
			className={`v-chat-activity-banner${visible ? ' v-chat-activity-banner--visible' : ''}`}
			aria-hidden={!visible}
		>
			<div className="v-chat-activity-banner__inner">
				<div className="v-chat-activity-banner__alien">
					<PixelAlien cell={3} mode={agentBusy ? 'walk' : 'idle'} />
				</div>
				<div className="v-chat-activity-status">
					<div className="v-chat-activity-status__frame">┌ status ┐</div>
					<div className="v-chat-activity-phrases">
						{phrases.map((p, i) => (
							<span
								key={p}
								className="v-chat-activity-phrase"
								data-accent={p === 'v3code' ? 'brand' : p === 'planning' ? 'amethyst' : 'green'}
								style={{ animationDelay: `${i * (10 / phrases.length)}s` }}
							>
								{'>'} {p}
							</span>
						))}
					</div>
					<div className="v-chat-activity-status__frame v-chat-activity-status__frame--bottom">└────────┘</div>
				</div>
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
				className="v-activity-banner-dot"
				data-on={enabled ? 'true' : 'false'}
				onClick={() => onChange(!enabled)}
				title={enabled ? 'Activity banner on — click to hide' : 'Activity banner off — click to show'}
				aria-pressed={enabled}
			/>
		);
	}
	return (
		<label className="v-activity-banner-pill">
			<input
				type="checkbox"
				className="v-activity-banner-pill__input"
				checked={enabled}
				onChange={e => onChange(e.target.checked)}
			/>
			<span className="v-activity-banner-pill__track">
				<span className="v-activity-banner-pill__thumb" />
			</span>
			<span className="v-activity-banner-pill__label">activity banner</span>
		</label>
	);
}
