/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { VibeToggleButton } from './VibeToggleButton.js';
import { SidebarChat } from './SidebarChat.js';
import ErrorBoundary from './ErrorBoundary.js';
import { Pill } from './VibeComponents.js';
import { PlanModePanel, AgentTrayRow } from './VibeTodoPlan.js';
import {
	IconPlan, IconBrowser, IconTerminal, IconExtensions, IconFiles,
	IconGit, IconAgents, IconMcp, IconSettings, IconCamera,
} from './V3Icons.js';

// ---- Tool tabs definition ----

type ToolTab = 'plan' | 'browser' | 'terminal' | 'extensions' | 'files' | 'git' | 'agents' | 'mcp' | 'settings';

interface ToolTabDef {
	id: ToolTab;
	label: string;
	icon: React.ReactNode;
	badge?: string;
}

const TOOL_TABS: ToolTabDef[] = [
	{ id: 'plan', label: 'Plan', icon: <IconPlan />, badge: 'new' },
	{ id: 'browser', label: 'Browser', icon: <IconBrowser /> },
	{ id: 'terminal', label: 'Terminal', icon: <IconTerminal /> },
	{ id: 'extensions', label: 'Extensions', icon: <IconExtensions /> },
	{ id: 'files', label: 'Files', icon: <IconFiles /> },
	{ id: 'git', label: 'Git', icon: <IconGit /> },
	{ id: 'agents', label: 'Agents', icon: <IconAgents /> },
	{ id: 'mcp', label: 'MCP', icon: <IconMcp /> },
	{ id: 'settings', label: 'Settings', icon: <IconSettings /> },
];

// ---- Panel content components (stubs — wired to real data later) ----

const BrowserPanel: React.FC = () => {
	const [url, setUrl] = useState('http://localhost:3000');
	const [screenshots, setScreenshots] = useState<string[]>([]);

	const takeScreenshot = () => {
		setScreenshots(prev => [...prev, `Screenshot at ${new Date().toLocaleTimeString()}`]);
	};

	return (
		<div style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
			<div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
				<input
					className="v3code-input"
					style={{ flex: 1 }}
					placeholder="https://..."
					value={url}
					onChange={e => setUrl(e.target.value)}
					onKeyDown={e => e.key === 'Enter' && setUrl(url)}
				/>
				<button className="v3code-btn v3code-btn--primary v3code-btn--sm" onClick={() => setUrl(url)}>Go</button>
				<button className="v3code-btn v3code-btn--secondary v3code-btn--sm" onClick={takeScreenshot} title="Take screenshot" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
					<IconCamera />
				</button>
			</div>
			<iframe
				src={url}
				style={{ flex: 1, border: '1px solid var(--v3code-border)', borderRadius: 'var(--v3code-radius-md)', background: '#fff' }}
				title="Browser Preview"
			/>
			{screenshots.length > 0 && (
				<div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
					{screenshots.map((s, i) => (
						<div key={i} style={{
							padding: '8px 12px', borderRadius: 'var(--v3code-radius-sm)',
							background: 'var(--v3code-bg-tertiary)', border: '1px solid var(--v3code-border)',
							fontSize: '11px', color: 'var(--v3code-fg-secondary)',
						}}>{s}</div>
					))}
				</div>
			)}
		</div>
	);
};

const TerminalPanel: React.FC = () => (
	<div style={{ padding: '16px', height: '100%', fontFamily: 'monospace', fontSize: '13px', color: '#34D399' }}>
		<div style={{ marginBottom: '8px', color: 'var(--v3code-fg-secondary)' }}>Terminal output will appear here...</div>
		<div style={{ color: 'var(--v3code-fg)' }}>$ npm run dev</div>
		<div style={{ color: '#34D399' }}>compiled successfully</div>
		<div style={{ color: 'var(--v3code-fg-secondary)' }}>Local: http://localhost:3000</div>
	</div>
);

const ExtensionsPanel: React.FC = () => (
	<div style={{ padding: '16px' }}>
		<div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--v3code-fg)' }}>Integrations</div>
		{['Supabase', 'Vercel', 'OpenAI', 'Anthropic', 'Gemini', 'Stripe'].map(name => (
			<div key={name} style={{
				display: 'flex', alignItems: 'center', justifyContent: 'space-between',
				padding: '10px 12px', marginBottom: '6px',
				borderRadius: '6px', border: '1px solid var(--v3code-border)',
				background: 'var(--v3code-bg-secondary)',
			}}>
				<span style={{ fontSize: '13px', color: 'var(--v3code-fg)' }}>{name}</span>
				<button style={{
					padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--v3code-accent)',
					background: 'transparent', color: 'var(--v3code-accent)', cursor: 'pointer', fontSize: '12px',
				}}>Configure</button>
			</div>
		))}
	</div>
);

const FilesPanel: React.FC = () => (
	<div style={{ padding: '16px', color: 'var(--v3code-fg-secondary)', fontSize: '13px' }}>
		File explorer — coming soon
	</div>
);

const GitPanel: React.FC = () => (
	<div style={{ padding: '16px', color: 'var(--v3code-fg-secondary)', fontSize: '13px' }}>
		Git panel — coming soon
	</div>
);

const AgentsPanel: React.FC = () => {
	const [agents] = useState([
		{ name: 'Code Reviewer', type: 'subagent' as const, status: 'completed' as const },
		{ name: 'Test Writer', type: 'skill' as const, status: 'running' as const },
		{ name: 'Doc Generator', type: 'command' as const, status: 'pending' as const },
		{ name: 'Refactor Agent', type: 'mode' as const, status: 'needs_attention' as const },
	]);

	return (
		<div style={{ padding: '16px' }}>
			<div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--v3code-fg)' }}>
				Agent Tray
			</div>
			{agents.map(agent => (
				<AgentTrayRow
					key={agent.name}
					name={agent.name}
					type={agent.type}
					status={agent.status}
				/>
			))}
			<button style={{
				width: '100%', padding: '10px', marginTop: '8px', borderRadius: '6px',
				border: '1px dashed var(--v3code-border)', background: 'transparent',
				color: 'var(--v3code-fg-secondary)', cursor: 'pointer', fontSize: '13px',
			}}>+ Add Agent</button>
		</div>
	);
};

const MCPPanel: React.FC = () => (
	<div style={{ padding: '16px', color: 'var(--v3code-fg-secondary)', fontSize: '13px' }}>
		MCP Servers — coming soon
	</div>
);

const SettingsPanel: React.FC = () => (
	<div style={{ padding: '16px', color: 'var(--v3code-fg-secondary)', fontSize: '13px' }}>
		Settings — coming soon
	</div>
);

const PANEL_MAP: Record<ToolTab, React.FC> = {
	plan: () => <PlanModePanel />,
	browser: BrowserPanel,
	terminal: TerminalPanel,
	extensions: ExtensionsPanel,
	files: FilesPanel,
	git: GitPanel,
	agents: AgentsPanel,
	mcp: MCPPanel,
	settings: SettingsPanel,
};

// ---- Main VIBE Panel Layout ----

/**
 * Full-screen VIBE agent panel.
 * Layout: Tools sidebar (left) + Chat (right)
 * Reversed from Trae's layout (they have chat left, tools right).
 */
export const VibeAgentPanel: React.FC = () => {
	const [activeTab, setActiveTab] = useState<ToolTab>('plan');
	const [toolsExpanded, setToolsExpanded] = useState(true);

	const ActivePanel = PANEL_MAP[activeTab];

	return (
		<div className="@@void-scope dark" style={{
			display: 'flex',
			width: '100%',
			height: '100%',
			background: 'var(--v3code-bg, #0f0f1a)',
			color: 'var(--v3code-fg, #e0e0e0)',
			fontFamily: 'system-ui, -apple-system, sans-serif',
			overflow: 'hidden',
		}}>
			{/* ===== LEFT: Tools Sidebar (icon-rail by default, expandable) ===== */}
			<div style={{
				display: 'flex',
				flexDirection: 'column',
				width: toolsExpanded ? '240px' : '48px',
				minWidth: toolsExpanded ? '220px' : '48px',
				flexShrink: 0,
				borderRight: '1px solid var(--v3code-border, #2a2a3a)',
				background: 'var(--v3code-bg-secondary, #13132b)',
				transition: 'width 0.2s ease',
				overflow: 'hidden',
			}}>
				{/* Tools header with toggle */}
				<div style={{
					display: 'flex', alignItems: 'center', justifyContent: 'space-between',
					padding: '12px', borderBottom: '1px solid var(--v3code-border, #2a2a3a)',
				}}>
					{toolsExpanded && (
						<span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--v3code-fg-secondary)' }}>
							Tools
						</span>
					)}
					<button
						onClick={() => setToolsExpanded(!toolsExpanded)}
						style={{
							background: 'none', border: 'none', color: 'var(--v3code-fg-secondary)',
							cursor: 'pointer', padding: '4px', borderRadius: '4px',
						}}
						title={toolsExpanded ? 'Collapse tools' : 'Expand tools'}
					>
						{toolsExpanded ? '◀' : '▶'}
					</button>
				</div>

				{/* Tab buttons */}
				<div style={{
					display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px',
					flex: 1, overflow: 'auto',
				}}>
					{TOOL_TABS.map(tab => {
						const isActive = activeTab === tab.id;
						return (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								title={tab.label}
								style={{
									display: 'flex', alignItems: 'center', gap: toolsExpanded ? '10px' : '0',
									justifyContent: toolsExpanded ? 'flex-start' : 'center',
									padding: toolsExpanded ? '10px 12px' : '10px 4px',
									borderRadius: '6px',
									border: 'none',
									background: isActive ? 'var(--v3code-bg-active, rgba(139, 92, 246, 0.15))' : 'transparent',
									color: isActive ? 'var(--v3code-fg, #e0e0e0)' : 'var(--v3code-fg-secondary, #666)',
									cursor: 'pointer',
									fontSize: '13px',
									fontWeight: isActive ? 600 : 400,
									transition: 'all 0.15s ease',
									whiteSpace: 'nowrap',
								}}
							>
								{tab.icon}
								{toolsExpanded && tab.label}
							</button>
						);
					})}
				</div>

				{/* VIBE/DEV toggle at bottom of tools */}
				{toolsExpanded && (
					<div style={{ padding: '12px', borderTop: '1px solid var(--v3code-border, #2a2a3a)' }}>
						<VibeToggleButton />
					</div>
				)}
			</div>

			{/* ===== RIGHT: Chat Panel ===== */}
			<div style={{
				flex: 1,
				display: 'flex',
				flexDirection: 'column',
				minWidth: 0,
				overflow: 'hidden',
			}}>
				{/* Chat header */}
				<div style={{
					display: 'flex', alignItems: 'center', gap: '12px',
					padding: '12px 16px', borderBottom: '1px solid var(--v3code-border, #2a2a3a)',
				}}>
					{!toolsExpanded && (
						<VibeToggleButton />
					)}
					<div style={{ flex: 1 }} />
					{/* Model badge */}
					<div style={{
						padding: '4px 10px', borderRadius: '4px',
						background: 'var(--v3code-bg-secondary)', fontSize: '12px',
						color: 'var(--v3code-fg-secondary)',
					}}>
						Claude 4 · Opus
					</div>
				</div>

				{/* Chat area */}
				<div style={{ flex: 1, overflow: 'hidden' }}>
					<ErrorBoundary>
						<SidebarChat />
					</ErrorBoundary>
				</div>
			</div>

			{/* ===== Collapsed tools: show active panel as overlay ===== */}
			{!toolsExpanded && activeTab !== 'browser' && (
				<div style={{
					position: 'absolute', left: '56px', top: 0, bottom: 0,
					width: '320px', zIndex: 10,
					background: 'var(--v3code-bg-secondary, #13132b)',
					borderRight: '1px solid var(--v3code-border, #2a2a3a)',
					boxShadow: '4px 0 20px rgba(0,0,0,0.5)',
				}}>
					<ActivePanel />
				</div>
			)}
		</div>
	);
};
