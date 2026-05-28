/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState } from 'react';
import { useAccessor } from '../util/services.js';
import { IVibeModeService } from '../../../vibeModeService.js';

/**
 * Large branded VIBE/DEV toggle button.
 * Positioned top-left in the title bar area (replaces Trae's SOLO switch).
 *
 * VIBE = Purple gradient, pulsing glow, agent mode active
 * DEV  = Subtle dark, normal state
 */
export const VibeToggleButton: React.FC = () => {
	const accessor = useAccessor();

	// Safely get vibe service — may not be registered yet
	let vibeService: IVibeModeService | null = null;
	try {
		vibeService = accessor.get(IVibeModeService);
	} catch {
		// Service not registered — button won't work, that's OK
	}

	const [mode, setMode] = useState<'vibe' | 'dev'>(vibeService?.mode ?? 'dev');
	const [isHovered, setIsHovered] = useState(false);

	useEffect(() => {
		if (!vibeService) return;
		setMode(vibeService.mode);
		const disp = vibeService.onDidChangeMode(m => setMode(m));
		return () => disp.dispose();
	}, [vibeService]);

	const handleToggle = useCallback(() => {
		vibeService?.toggle();
	}, [vibeService]);

	const isVibe = mode === 'vibe';

	return (
		<button
			onClick={handleToggle}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '8px',
				padding: '6px 14px',
				borderRadius: '8px',
				border: isVibe
					? '1px solid var(--v3code-accent, #8B5CF6)'
					: '1px solid var(--v3code-border, #333)',
				background: isVibe
					? 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 50%, #4C1D95 100%)'
					: 'var(--v3code-bg-secondary, #1e1e2e)',
				color: isVibe ? '#fff' : 'var(--v3code-fg-secondary, #888)',
				cursor: 'pointer',
				fontSize: '13px',
				fontWeight: 700,
				letterSpacing: '0.5px',
				transition: 'all 0.3s ease',
				boxShadow: isVibe
					? '0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)'
					: isHovered
						? '0 0 10px rgba(139, 92, 246, 0.2)'
						: 'none',
				transform: isHovered ? 'scale(1.03)' : 'scale(1)',
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			{/* Animated glow bar for VIBE mode */}
			{isVibe && (
				<div
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						height: '2px',
						background: 'linear-gradient(90deg, transparent, #A78BFA, #C4B5FD, #A78BFA, transparent)',
						animation: 'v3code-glow-slide 2s linear infinite',
					}}
				/>
			)}

			{/* Icon */}
			<div
				style={{
					width: '20px',
					height: '20px',
					borderRadius: '4px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					background: isVibe ? 'rgba(255,255,255,0.2)' : 'rgba(139, 92, 246, 0.15)',
					fontSize: '12px',
				}}
			>
				{isVibe ? '⚡' : '◈'}
			</div>

			{/* Label */}
			<span style={{ textTransform: 'uppercase' }}>
				{isVibe ? 'VIBE' : 'DEV'}
			</span>

			{/* Status dot */}
			<div
				style={{
					width: '6px',
					height: '6px',
					borderRadius: '50%',
					background: isVibe ? '#34D399' : '#6B7280',
					boxShadow: isVibe ? '0 0 8px rgba(52, 211, 153, 0.6)' : 'none',
					transition: 'all 0.3s ease',
				}}
			/>
		</button>
	);
};

/** CSS keyframes injected once */
export const vibeToggleStyles = `
@keyframes v3code-glow-slide {
	0% { transform: translateX(-100%); }
	100% { transform: translateX(100%); }
}
`;
