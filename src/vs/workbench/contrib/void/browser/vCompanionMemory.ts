/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';

export type JournalEntry = { ts: string; scope: 'user' | 'project'; project?: string; tags: string[]; text: string; salience: number };

const JOURNAL_MAX = 200;
const TOP_K = 8;

export class VCompanionMemory {
	constructor(
		private readonly fileService: IFileService,
		private readonly environmentService: IEnvironmentService,
		private readonly workspaceContextService: IWorkspaceContextService,
	) { }

	globalHome(): URI {
		return URI.joinPath(this.environmentService.userRoamingDataHome, 'v-memory');
	}

	async projectId(): Promise<string> {
		const folder = this.workspaceContextService.getWorkspace().folders[0]?.uri;
		if (!folder) { return 'no-workspace'; }
		try {
			const gitConfig = URI.joinPath(folder, '.git', 'config');
			if (await this.fileService.exists(gitConfig)) {
				const text = (await this.fileService.readFile(gitConfig)).value.toString();
				const m = text.match(/url\s*=\s*(.+)/);
				if (m) { return m[1].trim().replace(/[^\w.-]+/g, '_').slice(0, 120); }
			}
		} catch { /* no git */ }
		const path = folder.fsPath.replace(/\\/g, '/');
		let h = 0;
		for (let i = 0; i < path.length; i++) { h = ((h << 5) - h + path.charCodeAt(i)) | 0; }
		return 'path_' + Math.abs(h).toString(36);
	}

	private async ensureGlobal(): Promise<void> {
		const home = this.globalHome();
		for (const sub of ['projects']) {
			const d = URI.joinPath(home, sub);
			if (!(await this.fileService.exists(d))) { await this.fileService.createFolder(d); }
		}
		for (const f of ['profile.md', 'journal.jsonl']) {
			const u = URI.joinPath(home, f);
			if (!(await this.fileService.exists(u))) {
				await this.fileService.writeFile(u, VSBuffer.fromString(f.endsWith('.jsonl') ? '' : '# V remembers you\n'));
			}
		}
	}

	async remember(scope: 'user' | 'project', text: string, tags: string[] = []): Promise<void> {
		await this.ensureGlobal();
		const pid = await this.projectId();
		const entry: JournalEntry = {
			ts: new Date().toISOString(),
			scope,
			project: scope === 'project' ? pid : undefined,
			tags,
			text: text.trim(),
			salience: 1,
		};
		const journalUri = URI.joinPath(this.globalHome(), 'journal.jsonl');
		let prev = '';
		try { prev = (await this.fileService.readFile(journalUri)).value.toString(); } catch { /* empty */ }
		await this.fileService.writeFile(journalUri, VSBuffer.fromString(prev + JSON.stringify(entry) + '\n'));

		if (scope === 'project') {
			await this._appendProjectMd(pid, text);
			await this._mirrorToRepo(text);
		}
		await this.compactIfNeeded();
	}

	private async _appendProjectMd(projectId: string, text: string): Promise<void> {
		const uri = URI.joinPath(this.globalHome(), 'projects', `${projectId}.md`);
		let body = '';
		try { body = (await this.fileService.readFile(uri)).value.toString(); } catch {
			await this.fileService.createFolder(URI.joinPath(this.globalHome(), 'projects'));
		}
		const line = `- ${new Date().toISOString().slice(0, 10)}: ${text}\n`;
		await this.fileService.writeFile(uri, VSBuffer.fromString(body + line));
	}

	private async _mirrorToRepo(text: string): Promise<void> {
		const folder = this.workspaceContextService.getWorkspace().folders[0]?.uri;
		if (!folder) { return; }
		const memDir = URI.joinPath(folder, '.v', 'memory');
		if (!(await this.fileService.exists(memDir))) { await this.fileService.createFolder(memDir); }
		const decisions = URI.joinPath(memDir, 'decisions.md');
		let prev = '';
		try { prev = (await this.fileService.readFile(decisions)).value.toString(); } catch { prev = '# decisions\n\n'; }
		await this.fileService.writeFile(decisions, VSBuffer.fromString(prev + `- ${text}\n`));

		const agents = URI.joinPath(folder, 'AGENTS.md');
		if (await this.fileService.exists(agents)) {
			let ag = (await this.fileService.readFile(agents)).value.toString();
			const marker = '## Session Memory';
			const bullet = `- ${text}`;
			if (ag.includes(marker)) {
				const idx = ag.indexOf(marker) + marker.length;
				ag = ag.slice(0, idx) + '\n' + bullet + ag.slice(idx);
			} else {
				ag += `\n\n${marker}\n${bullet}\n`;
			}
			await this.fileService.writeFile(agents, VSBuffer.fromString(ag));
		}
	}

	async compactIfNeeded(): Promise<void> {
		const journalUri = URI.joinPath(this.globalHome(), 'journal.jsonl');
		let raw = '';
		try { raw = (await this.fileService.readFile(journalUri)).value.toString(); } catch { return; }
		const lines = raw.split('\n').filter(Boolean);
		if (lines.length <= JOURNAL_MAX) { return; }

		const toSummarize = lines.slice(0, lines.length - JOURNAL_MAX + 40);
		const kept = lines.slice(lines.length - JOURNAL_MAX + 40);
		const summary = toSummarize.map(l => {
			try { const e = JSON.parse(l) as JournalEntry; return e.text; } catch { return ''; }
		}).filter(Boolean).join('; ').slice(0, 2000);

		const profileUri = URI.joinPath(this.globalHome(), 'profile.md');
		let profile = '';
		try { profile = (await this.fileService.readFile(profileUri)).value.toString(); } catch { profile = '# profile\n'; }
		await this.fileService.writeFile(profileUri, VSBuffer.fromString(profile + `\n\n(compacted ${new Date().toISOString().slice(0, 10)})\n${summary}\n`));

		const pid = await this.projectId();
		const projUri = URI.joinPath(this.globalHome(), 'projects', `${pid}.md`);
		let proj = '';
		try { proj = (await this.fileService.readFile(projUri)).value.toString(); } catch { proj = `# ${pid}\n`; }
		await this.fileService.writeFile(projUri, VSBuffer.fromString(proj + `\n(compacted) ${summary.slice(0, 800)}\n`));

		await this.fileService.writeFile(journalUri, VSBuffer.fromString(kept.join('\n') + (kept.length ? '\n' : '')));
	}

	async memoryBlock(userMessage: string): Promise<string> {
		await this.ensureGlobal();
		const lines: string[] = ['# what V remembers'];
		const pid = await this.projectId();

		try {
			const profile = (await this.fileService.readFile(URI.joinPath(this.globalHome(), 'profile.md'))).value.toString().trim();
			if (profile) { lines.push('## you (global)', profile.slice(0, 4000)); }
		} catch { /* */ }

		try {
			const proj = (await this.fileService.readFile(URI.joinPath(this.globalHome(), 'projects', `${pid}.md`))).value.toString().trim();
			if (proj) { lines.push(`## this project (${pid})`, proj.slice(0, 3000)); }
		} catch { /* */ }

		const journal = await this._readJournal();
		const relevant = this._rankJournal(journal, userMessage, pid).slice(0, TOP_K);
		if (relevant.length) {
			lines.push('## recent memories');
			for (const e of relevant) {
				lines.push(`- [${e.scope}${e.project ? ':' + e.project : ''}] ${e.text}`);
			}
		}
		return lines.join('\n\n');
	}

	private async _readJournal(): Promise<JournalEntry[]> {
		try {
			const raw = (await this.fileService.readFile(URI.joinPath(this.globalHome(), 'journal.jsonl'))).value.toString();
			return raw.split('\n').filter(Boolean).map(l => {
				try { return JSON.parse(l) as JournalEntry; } catch { return null; }
			}).filter((e): e is JournalEntry => !!e && !!e.text);
		} catch { return []; }
	}

	private _rankJournal(entries: JournalEntry[], query: string, projectId: string): JournalEntry[] {
		const tokens = new Set(query.toLowerCase().split(/\W+/).filter(w => w.length > 2));
		const score = (e: JournalEntry) => {
			let s = e.salience;
			if (e.scope === 'project' && e.project === projectId) { s += 2; }
			const words = e.text.toLowerCase().split(/\W+/);
			for (const w of words) { if (tokens.has(w)) { s += 1; } }
			for (const t of e.tags) { if (tokens.has(t.toLowerCase())) { s += 2; } }
			return s;
		};
		return [...entries].sort((a, b) => score(b) - score(a));
	}

	async recall(topic: string): Promise<JournalEntry[]> {
		const journal = await this._readJournal();
		const pid = await this.projectId();
		return this._rankJournal(journal, topic, pid).slice(0, 15);
	}

	async summary(): Promise<{ profileLines: number; journalEntries: number; projectId: string }> {
		const journal = await this._readJournal();
		let profileLines = 0;
		try {
			profileLines = (await this.fileService.readFile(URI.joinPath(this.globalHome(), 'profile.md'))).value.toString().split('\n').length;
		} catch { /* */ }
		return { profileLines, journalEntries: journal.length, projectId: await this.projectId() };
	}
}
