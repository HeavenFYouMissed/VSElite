/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';

/**
 * V3Code line-icon set. All 16x16 by default, single stroke, currentColor.
 * Designed to match Trae's "icube" feel but without emoji or external font deps.
 * NO emoji are used anywhere in the V3Code UI — use these icons instead.
 */

interface IconProps {
	size?: number;
	className?: string;
	style?: React.CSSProperties;
}

const wrap = (path: React.ReactNode) =>
	({ size = 16, className, style }: IconProps) =>
		<svg
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			style={style}
			aria-hidden="true"
		>
			{path}
		</svg>;

export const IconPlan = wrap(
	<>
		<rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
		<path d="M5 6h6M5 9h6M5 12h3" />
	</>
);

export const IconBrowser = wrap(
	<>
		<rect x="2" y="3" width="12" height="10" rx="1.5" />
		<path d="M2 6h12" />
		<circle cx="4" cy="4.5" r="0.4" fill="currentColor" stroke="none" />
		<circle cx="5.5" cy="4.5" r="0.4" fill="currentColor" stroke="none" />
	</>
);

export const IconTerminal = wrap(
	<>
		<rect x="2" y="3" width="12" height="10" rx="1.5" />
		<path d="M5 7l2 1.5L5 10" />
		<path d="M8.5 10.5h3" />
	</>
);

export const IconExtensions = wrap(
	<>
		<path d="M4 4h3v3H4zM9 4h3v3H9zM4 9h3v3H4zM9 9h1.5v1.5H9z" />
		<path d="M11.5 11.5h1.5V13H11.5z" />
	</>
);

export const IconFiles = wrap(
	<>
		<path d="M2.5 4.5a1 1 0 0 1 1-1h2.5l1.5 1.5H12a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1z" />
	</>
);

export const IconGit = wrap(
	<>
		<circle cx="4" cy="4" r="1.5" />
		<circle cx="4" cy="12" r="1.5" />
		<circle cx="12" cy="8" r="1.5" />
		<path d="M4 5.5v5M5.3 11l5.4-2" />
	</>
);

export const IconAgents = wrap(
	<>
		<rect x="3" y="5" width="10" height="8" rx="1.5" />
		<path d="M8 5V3M6 8.5h.01M10 8.5h.01" />
		<path d="M6 11h4" />
	</>
);

export const IconMcp = wrap(
	<>
		<rect x="2.5" y="3" width="11" height="8" rx="1" />
		<path d="M5.5 13h5M8 11v2" />
	</>
);

export const IconSettings = wrap(
	<>
		<circle cx="8" cy="8" r="2" />
		<path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
	</>
);

export const IconCamera = wrap(
	<>
		<rect x="2" y="4" width="12" height="9" rx="1.5" />
		<circle cx="8" cy="8.5" r="2.5" />
		<path d="M5.5 4l1-1.5h3l1 1.5" />
	</>
);

export const IconPlus = wrap(<path d="M8 3.5v9M3.5 8h9" />);
export const IconCheck = wrap(<path d="M3 8.5l3 3 7-7" />);
export const IconClose = wrap(<path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />);
export const IconRun = wrap(<path d="M4 3.5v9l8-4.5z" fill="currentColor" stroke="none" />);
export const IconPulse = wrap(<path d="M1.5 8h3l1.5-4 3 8 1.5-4h4" />);
