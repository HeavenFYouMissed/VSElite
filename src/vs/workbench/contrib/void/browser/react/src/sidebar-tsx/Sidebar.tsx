/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import { useIsDark, useAccessor } from '../util/services.js';
import { SidebarChat } from './SidebarChat.js';
import { VibeAgentPanel } from './VibeAgentPanel.js';
import { VibeToggleButton, vibeToggleStyles } from './VibeToggleButton.js';
import { IVibeModeService } from '../../../vibeModeService.js';
import ErrorBoundary from './ErrorBoundary.js';
import '../styles.css';
import './v3code-design-tokens.css';

/**
 * Main Sidebar entry point.
 * - DEV mode: renders the standard SidebarChat (existing behavior)
 * - VIBE mode: renders the full VibeAgentPanel (tools + chat, fullscreen via zen mode)
 *
 * Safe against IVibeModeService not being registered yet — falls back to DEV mode.
 */
export const Sidebar = ({ className }: { className: string }) => {
	const isDark = useIsDark();
	const accessor = useAccessor();

	// Safely get vibe service — may not be registered yet
	let vibeService: IVibeModeService | null = null;
	try {
		vibeService = accessor.get(IVibeModeService);
	} catch {
		// Service not registered — stay in DEV mode
	}

	const [mode, setMode] = useState<'vibe' | 'dev'>('dev');

	useEffect(() => {
		if (!vibeService) return;
		setMode(vibeService.mode);
		const disp = vibeService.onDidChangeMode(m => setMode(m));
		return () => disp.dispose();
	}, [vibeService]);

	// VIBE mode: full agent panel (tools left, chat right, fullscreen)
	if (mode === 'vibe') {
		return (
			<>
				<style>{vibeToggleStyles}</style>
				<ErrorBoundary>
					<VibeAgentPanel />
				</ErrorBoundary>
			</>
		);
	}

	// DEV mode: standard chat sidebar (existing behavior)
	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ width: '100%', height: '100%' }}>
			<style>{vibeToggleStyles}</style>
			<div className="w-full h-full bg-void-bg-2 text-void-fg-1" style={{ display: 'flex', flexDirection: 'column' }}>
				{/* VIBE toggle in header — only if service available */}
				{vibeService && (
					<div style={{
						display: 'flex', alignItems: 'center', justifyContent: 'space-between',
						padding: '8px 12px', borderBottom: '1px solid var(--v3code-border, #2a2a3a)',
						flexShrink: 0,
					}}>
						<span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--v3code-fg-tertiary, #666)' }}>
							V3Code
						</span>
						<VibeToggleButton />
					</div>
				)}
				<div style={{ flex: 1, minHeight: 0 }}>
					<ErrorBoundary>
						<SidebarChat />
					</ErrorBoundary>
				</div>
			</div>
		</div>
	);
};

