/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { useIsDark } from '../util/services.js';
import { SidebarChat } from './SidebarChat.js';
import ErrorBoundary from './ErrorBoundary.js';
import '../styles.css';
import './v3code-design-tokens.css';

export const Sidebar = ({ className }: { className: string }) => {
	const isDark = useIsDark();

	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ width: '100%', height: '100%' }}>
			<div className="w-full h-full bg-void-bg-2 text-void-fg-1" style={{ display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<ErrorBoundary>
						<SidebarChat />
					</ErrorBoundary>
				</div>
			</div>
		</div>
	);
};

