/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';

// ---- the V3 alien, as a flat pixel grid ----------------------------------------------
// . transparent · g green body · d eye/mouth · r red V
const FRAME_A = [
	'....ggggggg....',
	'..ggggggggggg..',
	'.ggggggggggggg.',
	'ggggggggggggggg',
	'ggggggggggggggg',
	'ggddgggggggddgg',
	'ggddgggggggddgg',
	'ggggggggggggggg',
	'.gggggdddggggg.',
	'..ggggggggggg..',
	'gg.ggggggggg.gg',
	'gg.ggggggggg.gg',
	'...ggrgggrgg...',
	'...gggrgrggg...',
	'...ggggrgggg...',
	'...gg.....gg...',
	'...gg.....gg...',
];
const FRAME_B = [
	'....ggggggg....',
	'..ggggggggggg..',
	'.ggggggggggggg.',
	'ggggggggggggggg',
	'ggggggggggggggg',
	'ggddgggggggddgg',
	'ggddgggggggddgg',
	'ggggggggggggggg',
	'.gggggdddggggg.',
	'gg.ggggggggg.gg',
	'gg.ggggggggg.gg',
	'...ggggggggg...',
	'...ggrgggrgg...',
	'...gggrgrggg...',
	'...ggggrgggg...',
	'....gg...gg....',
	'....gg...gg....',
];

const PALETTE: Record<string, string> = { g: '#4ea03b', d: '#0c1016', r: '#d6392c' };

type AlienMode = 'idle' | 'walk' | 'static';

export function PixelAlien({
	cell = 8,
	mode = 'idle',
	showV = true,
	cutoutEyes = false,
	palette = PALETTE,
}: {
	cell?: number;
	mode?: AlienMode;
	showV?: boolean;
	cutoutEyes?: boolean;
	palette?: Record<string, string>;
}) {
	const [t, setT] = useState(0);
	useEffect(() => {
		if (mode === 'static') return;
		const id = setInterval(() => setT(v => v + 1), 90);
		return () => clearInterval(id);
	}, [mode]);

	const grid = mode === 'walk' && t % 2 ? FRAME_B : FRAME_A;
	const cols = grid[0].length, rows = grid.length;
	const bob = mode === 'idle' ? Math.round(Math.sin(t / 3)) * cell * 0.18
		: mode === 'walk' ? (t % 2 ? cell * 0.18 : 0) : 0;

	const rects: React.ReactNode[] = [];
	grid.forEach((line, y) =>
		[...line].forEach((chRaw, x) => {
			let ch = chRaw;
			if (ch === '.') return;
			if (ch === 'd' && cutoutEyes) return;
			if (ch === 'r' && !showV) ch = 'g';
			rects.push(
				<rect key={x + '-' + y} x={x * cell} y={y * cell} width={cell} height={cell} fill={palette[ch]} />
			);
		})
	);

	return (
		<svg width={cols * cell} height={rows * cell}
			viewBox={`0 0 ${cols * cell} ${rows * cell}`}
			shapeRendering="crispEdges"
			style={{ imageRendering: 'pixelated', transform: `translateY(${bob}px)`, transition: 'transform .09s linear' }}>
			{rects}
		</svg>
	);
}

/**
 * Collapsible "sky" header that sits at the top of the V3 chat. The green invader is the
 * brand pet: it walks while the agent is working and idles (gentle bob) otherwise. A small
 * chevron toggles the header open/closed; it auto-opens when a run finishes.
 */
export const V3AlienHeader = ({ isWorking }: { isWorking: boolean }) => {
	const [open, setOpen] = useState(true);

	// Auto-open the sky when the agent finishes a turn (the pet "comes back").
	const prevWorking = React.useRef(isWorking);
	useEffect(() => {
		if (prevWorking.current && !isWorking) setOpen(true);
		prevWorking.current = isWorking;
	}, [isWorking]);

	return (
		<div className="w-full select-none shrink-0">
			<div
				className="relative w-full overflow-hidden transition-all duration-300 ease-out"
				style={{
					height: open ? 92 : 0,
					background: 'linear-gradient(180deg, #160a2b 0%, #2a1257 55%, #1d0f3d 100%)',
					borderBottom: open ? '1px solid rgba(139,92,246,0.18)' : 'none',
				}}
			>
				{/* faint star/pixel texture */}
				<div className="absolute inset-0 opacity-[0.07]" style={{
					backgroundImage: 'radial-gradient(1px 1px at 20% 30%, #fff 1px, transparent 0), radial-gradient(1px 1px at 70% 60%, #fff 1px, transparent 0), radial-gradient(1px 1px at 45% 80%, #fff 1px, transparent 0), radial-gradient(1px 1px at 85% 25%, #fff 1px, transparent 0)',
				}} />

				{open && (
					<div className="flex items-end justify-center gap-7 h-full pb-2">
						<div style={{ opacity: 0.14 }}><PixelAlien cell={3} mode="static" /></div>
						<PixelAlien cell={4} mode={isWorking ? 'walk' : 'idle'} />
						<div style={{ opacity: 0.14 }}><PixelAlien cell={3} mode="static" /></div>
					</div>
				)}
			</div>

			{/* toggle handle */}
			<button
				type="button"
				onClick={() => setOpen(v => !v)}
				className="flex items-center justify-center w-full h-[14px] text-void-fg-4 hover:text-void-fg-2 transition-colors duration-150 cursor-pointer"
				title={open ? 'Hide V' : 'Show V'}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
					style={{ transform: open ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s ease' }}>
					<polyline points="6 15 12 9 18 15" />
				</svg>
			</button>
		</div>
	);
};
