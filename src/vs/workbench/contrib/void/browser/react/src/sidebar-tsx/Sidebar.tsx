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
import { PanelRight } from 'lucide-react';

export const Sidebar = ({ className }: { className: string }) => {
	const isDark = useIsDark();
	const [showAgentPanel, setShowAgentPanel] = useState(false);

	const togglePanel = useCallback(() => setShowAgentPanel(v => !v), []);

	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ width: '100%', height: '100%' }}>
			<div className="w-full h-full bg-void-bg-2 text-void-fg-1" style={{ display: 'flex', flexDirection: 'row' }}>
				{/* Main chat area */}
				<div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
					{/* Agent panel toggle button (top-right) */}
					<div style={{
						display: 'flex', justifyContent: 'flex-end',
						padding: '4px 6px 0',
						position: 'absolute', top: 0, right: showAgentPanel ? '280px' : 0,
						zIndex: 5,
					}}>
						<button
							onClick={togglePanel}
							style={{
								background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
								color: showAgentPanel
									? 'var(--vscode-focusBorder, var(--vscode-progressBar-background, #0078d4))'
									: 'var(--vscode-descriptionForeground)',
								opacity: showAgentPanel ? 1 : 0.6,
								borderRadius: '3px',
							}}
							title={showAgentPanel ? 'Hide agents panel' : 'Show agents panel'}
							className='hover:opacity-100'
						>
							<PanelRight size={14} />
						</button>
					</div>
					<div style={{ flex: 1, minHeight: 0 }}>
						<ErrorBoundary>
							<SidebarChat />
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
