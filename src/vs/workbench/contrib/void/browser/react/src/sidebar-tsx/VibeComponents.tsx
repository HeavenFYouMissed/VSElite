/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ---- TextRoll (Cursor-style animated text cycling) ----

interface TextRollProps {
	/** Array of strings to cycle through */
	items: string[];
	/** Delay between transitions in ms */
	delayMs?: number;
	className?: string;
}

export const TextRoll: React.FC<TextRollProps> = ({ items, delayMs = 2000, className }) => {
	const [index, setIndex] = useState(0);
	const [visible, setVisible] = useState(true);

	useEffect(() => {
		if (items.length <= 1) return;
		const timer = setInterval(() => {
			setVisible(false);
			setTimeout(() => {
				setIndex(i => (i + 1) % items.length);
				setVisible(true);
			}, 200);
		}, delayMs);
		return () => clearInterval(timer);
	}, [items, delayMs]);

	if (items.length === 0) return null;

	return (
		<span
			className={className}
			style={{
				opacity: visible ? 1 : 0,
				transform: visible ? 'translateY(0)' : 'translateY(8px)',
				transition: 'opacity 0.2s ease, transform 0.2s ease',
				display: 'inline-block',
			}}
		>
			{items[index]}
		</span>
	);
};

// ---- Thinking Indicator (Cursor-style 3-dot pulse) ----

interface ThinkingDotsProps {
	size?: number;
	color?: string;
	className?: string;
}

export const ThinkingDots: React.FC<ThinkingDotsProps> = ({
	size = 6,
	color = 'var(--v3code-fg-tertiary)',
	className,
}) => (
	<span
		className={`v3code-thinking-dots ${className ?? ''}`}
		style={{ display: 'inline-flex', gap: `${size * 0.6}px`, alignItems: 'center', padding: '2px 0' }}
	>
		{[0, 1, 2].map(i => (
			<span
				key={i}
				style={{
					width: size,
					height: size,
					borderRadius: '50%',
					background: color,
					animation: `v3code-thinking-dot 1.4s infinite ease-in-out both`,
					animationDelay: `${-0.32 + i * 0.16}s`,
				}}
			/>
		))}
	</span>
);

// ---- Streaming Text (types character by character in real-time) ----

interface StreamingTextProps {
	text: string;
	isComplete?: boolean;
	speed?: number;
	className?: string;
	onComplete?: () => void;
}

export const StreamingText: React.FC<StreamingTextProps> = ({
	text,
	isComplete = false,
	speed = 15,
	className,
	onComplete,
}) => {
	const [displayed, setDisplayed] = useState('');
	const rafRef = useRef<number>(0);
	const idxRef = useRef(0);

	useEffect(() => {
		if (isComplete) {
			setDisplayed(text);
			onComplete?.();
			return;
		}

		idxRef.current = displayed.length;
		const charsPerFrame = Math.max(1, Math.floor(speed / 16));

		const animate = () => {
			if (idxRef.current >= text.length) {
				onComplete?.();
				return;
			}
			idxRef.current = Math.min(idxRef.current + charsPerFrame, text.length);
			setDisplayed(text.slice(0, idxRef.current));
			rafRef.current = requestAnimationFrame(animate);
		};

		rafRef.current = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(rafRef.current);
	}, [text, isComplete, speed]);

	useEffect(() => {
		return () => cancelAnimationFrame(rafRef.current);
	}, []);

	return <span className={className}>{displayed || (isComplete ? text : '')}</span>;
};

// ---- Dot Grid Background (Cursor's animated background pattern) ----

interface DotGridProps {
	size?: number;
	spacing?: number;
	opacity?: number;
	className?: string;
}

export const DotGrid: React.FC<DotGridProps> = ({
	size = 200,
	spacing = 16,
	opacity = 0.06,
	className,
}) => (
	<div
		className={className}
		style={{
			position: 'absolute',
			inset: 0,
			pointerEvents: 'none',
			overflow: 'hidden',
			opacity,
		}}
	>
		<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<pattern id="v3code-dot-grid" x="0" y="0" width={spacing} height={spacing} patternUnits="userSpaceOnUse">
					<circle cx={spacing / 2} cy={spacing / 2} r="1" fill="currentColor" />
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill="url(#v3code-dot-grid)" />
		</svg>
	</div>
);

// ---- Status Pill (Cursor-style colored pill badge) ----

interface PillProps {
	label: string;
	color?: 'magenta' | 'blue' | 'green' | 'orange' | 'red' | 'yellow' | 'purple' | 'cyan';
	size?: 'sm' | 'md';
	className?: string;
}

const PILL_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
	magenta: { bg: 'var(--v3code-bg-magenta-primary)', text: 'var(--v3code-text-magenta-primary)', dot: 'var(--v3code-magenta)' },
	blue: { bg: 'var(--v3code-bg-blue-primary)', text: 'var(--v3code-text-blue-primary)', dot: 'var(--v3code-blue)' },
	green: { bg: 'var(--v3code-bg-green-primary)', text: 'var(--v3code-success)', dot: 'var(--v3code-green)' },
	orange: { bg: 'var(--v3code-bg-orange-primary)', text: 'var(--v3code-orange)', dot: 'var(--v3code-orange)' },
	red: { bg: 'var(--v3code-bg-red-primary)', text: 'var(--v3code-error)', dot: 'var(--v3code-red)' },
	yellow: { bg: 'var(--v3code-bg-yellow-primary)', text: 'var(--v3code-warning)', dot: 'var(--v3code-yellow)' },
	purple: { bg: 'var(--v3code-bg-purple-primary)', text: 'var(--v3code-purple)', dot: 'var(--v3code-purple)' },
	cyan: { bg: 'var(--v3code-bg-cyan-primary)', text: 'var(--v3code-cyan)', dot: 'var(--v3code-cyan)' },
};

export const Pill: React.FC<PillProps> = ({ label, color = 'magenta', size = 'md', className }) => {
	const c = PILL_COLORS[color] ?? PILL_COLORS.magenta;
	const isSm = size === 'sm';

	return (
		<span
			className={className}
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: isSm ? '4px' : '6px',
				padding: isSm ? '1px 6px' : '2px 8px',
				borderRadius: 'var(--v3code-radius-full)',
				background: c.bg,
				color: c.text,
				fontSize: isSm ? 'var(--v3code-font-size-xs)' : 'var(--v3code-font-size-sm)',
				fontWeight: 500,
			}}
		>
			<span style={{
				width: isSm ? '5px' : '6px',
				height: isSm ? '5px' : '6px',
				borderRadius: '50%',
				background: c.dot,
				flexShrink: 0,
			}} />
			{label}
		</span>
	);
};
