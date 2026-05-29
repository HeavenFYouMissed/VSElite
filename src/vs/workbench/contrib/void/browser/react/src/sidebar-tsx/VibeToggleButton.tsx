/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState } from 'react';
import { useAccessor } from '../util/services.js';
import type { IVibeModeService } from '../../../vibeModeService.js';

/**
 * Two-state slide toggle (DEV | VIBE) — modeled on Trae's IDE/SOLO switch.
 * Active half is "sunk-in" (inset shadow + accent gradient).
 * Inactive half is flat and dim. Clicking the inactive half toggles mode.
 */
export const VibeToggleButton: React.FC = () => {
	const accessor = useAccessor();

	let vibeService: IVibeModeService | null = null;
	try {
		vibeService = accessor.get('IVibeModeService') as IVibeModeService | null;
	} catch {
		// service unavailable
	}

	const [mode, setMode] = useState<'vibe' | 'dev'>(vibeService?.mode ?? 'dev');

	useEffect(() => {
		if (!vibeService) return;
		setMode(vibeService.mode);
		const disp = vibeService.onDidChangeMode(m => setMode(m));
		return () => disp.dispose();
	}, [vibeService]);

	const setVibe = useCallback(() => {
		if (mode !== 'vibe') vibeService?.enterVibe();
	}, [vibeService, mode]);

	const setDev = useCallback(() => {
		if (mode !== 'dev') vibeService?.exitVibe();
	}, [vibeService, mode]);

	const isVibe = mode === 'vibe';

	const halfBase: React.CSSProperties = {
		flex: 1,
		padding: '0 14px',
		fontSize: '11px',
		fontWeight: 700,
		letterSpacing: '0.8px',
		textTransform: 'uppercase',
		fontFamily: 'inherit',
		cursor: 'pointer',
		border: 'none',
		outline: 'none',
		background: 'transparent',
		color: 'rgba(200, 200, 220, 0.45)',
		transition: 'color 180ms ease, text-shadow 180ms ease',
		zIndex: 1,
		userSelect: 'none',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		height: '100%',
	};

	const halfActive: React.CSSProperties = {
		color: '#ffffff',
		textShadow: '0 0 8px rgba(167, 139, 250, 0.55)',
	};

	return (
		<div
			className="v3code-vibe-toggle"
			role="tablist"
			aria-label="Mode selector"
			style={{
				position: 'relative',
				display: 'inline-flex',
				alignItems: 'stretch',
				width: 132,
				height: 26,
				borderRadius: 999,
				background: 'linear-gradient(180deg, #1a1a26 0%, #14141d 100%)',
				border: '1px solid rgba(255, 255, 255, 0.06)',
				boxShadow:
					'inset 0 1px 2px rgba(0, 0, 0, 0.6), inset 0 -1px 0 rgba(255, 255, 255, 0.03), 0 1px 0 rgba(255, 255, 255, 0.04)',
				overflow: 'hidden',
			}}
		>
			{/* Sliding thumb (the sunk-in active half) */}
			<div
				aria-hidden="true"
				style={{
					position: 'absolute',
					top: 2,
					left: 2,
					width: 'calc(50% - 2px)',
					height: 'calc(100% - 4px)',
					borderRadius: 999,
					background: isVibe
						? 'linear-gradient(180deg, #8B5CF6 0%, #6D28D9 100%)'
						: 'linear-gradient(180deg, #2a2a3a 0%, #1f1f2c 100%)',
					boxShadow: isVibe
						? 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 4px rgba(0,0,0,0.35), 0 0 14px rgba(139, 92, 246, 0.45)'
						: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 2px rgba(0,0,0,0.4)',
					transform: isVibe ? 'translateX(100%)' : 'translateX(0)',
					transition: 'transform 260ms cubic-bezier(0.4, 0.0, 0.2, 1), background 260ms ease, box-shadow 260ms ease',
					zIndex: 0,
				}}
			/>

			<button
				type="button"
				role="tab"
				aria-selected={!isVibe}
				onClick={setDev}
				style={{ ...halfBase, ...(!isVibe ? halfActive : {}) }}
			>
				DEV
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={isVibe}
				onClick={setVibe}
				style={{ ...halfBase, ...(isVibe ? halfActive : {}) }}
			>
				VIBE
			</button>
		</div>
	);
};

/** Focus-ring CSS injected from Sidebar.tsx. */
export const vibeToggleStyles = `
.v3code-vibe-toggle button:focus-visible {
	box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.5);
	border-radius: 999px;
}
`;
