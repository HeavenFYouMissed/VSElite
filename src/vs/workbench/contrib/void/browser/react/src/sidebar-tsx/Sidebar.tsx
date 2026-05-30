/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { useIsDark } from '../util/services.js';
import { SidebarChat } from './SidebarChat.js';
import { AgentSessionsPanel } from './AgentSessionsPanel.js';
import ErrorBoundary from './ErrorBoundary.js';
import '../styles.css';
import './v3code-design-tokens.css';

export const Sidebar = ({ className }: { className: string }) => {
	const isDark = useIsDark();
	const [showAgentPanel, setShowAgentPanel] = useState(false);

	const togglePanel = useCallback(() => setShowAgentPanel(v => !v), []);

	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ width: '100%', height: '100%' }}>
			<div className="w-full h-full bg-void-bg-2 text-void-fg-1" style={{ display: 'flex', flexDirection: 'row' }}>
				{/* Main chat area */}
				<div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
					<div style={{ flex: 1, minHeight: 0 }}>
						<ErrorBoundary>
							<SidebarChat toggleAgentPanel={togglePanel} showAgentPanel={showAgentPanel} />
						</ErrorBoundary>
					</div>
				</div>

				{/* Agent sessions panel (collapsible right side) */}
				{showAgentPanel && (
					<div style={{
						width: '280px', minWidth: '280px', flexShrink: 0,
						borderLeft: '1px solid var(--vscode-sideBar-border, var(--vscode-commandCenter-inactiveBorder, rgba(128,128,128,0.2)))',
					}}>
						<ErrorBoundary>
							<AgentSessionsPanel onClose={togglePanel} />
						</ErrorBoundary>
					</div>
				)}
			</div>
		</div>
	);
};
