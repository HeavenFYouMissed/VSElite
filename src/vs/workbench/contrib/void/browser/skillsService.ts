/*--------------------------------------------------------------------------------------
 *  Copyright (c) V3Code. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IPathService } from '../../../services/path/common/pathService.js';

// ---- Types ----

export interface SkillDescriptor {
	name: string;
	description: string;
	triggers: {
		globs?: string[];
		keywords?: string[];
		alwaysApply?: boolean;
	};
	content: string;
	filePath: string;
}

export interface ISkillsService {
	readonly _serviceBrand: undefined;
	getMatchingSkills(activeFilePath: string | undefined, userMessage: string): Promise<string>;
	getAvailableSkillsList(): Promise<Array<{ name: string; description: string }>>;
	invalidateCache(): void;
}

export const ISkillsService = createDecorator<ISkillsService>('skillsService');

// ---- Frontmatter parser ----

function parseSkillFrontmatter(content: string): { meta: Record<string, any>; body: string } {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
	if (!match) return { meta: {}, body: content };

	const raw = match[1];
	const body = match[2];
	const meta: Record<string, any> = {};

	let currentKey = '';
	let currentArray: string[] | null = null;

	for (const line of raw.split('\n')) {
		const trimmed = line.trim();

		// Array continuation
		if (trimmed.startsWith('- ') && currentArray !== null) {
			let val = trimmed.slice(2).trim();
			if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
			currentArray.push(val);
			continue;
		}

		// Save previous array
		if (currentArray !== null) {
			meta[currentKey] = currentArray;
			currentArray = null;
		}

		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		let value: any = line.slice(colonIdx + 1).trim();

		if (value === '' || value === undefined) {
			// Might be start of an array
			currentKey = key;
			currentArray = [];
			continue;
		}

		if (value === 'true') value = true;
		else if (value === 'false') value = false;
		else if (value.startsWith('[') && value.endsWith(']')) {
			try { value = JSON.parse(value); } catch { /* keep as string */ }
		} else if (value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1);
		}
		meta[key] = value;
	}

	// Final array flush
	if (currentArray !== null) {
		meta[currentKey] = currentArray;
	}

	return { meta, body };
}

// ---- Glob matching ----

function matchSkillGlob(pattern: string, filePath: string): boolean {
	const normalized = filePath.replace(/\\/g, '/');
	const regexStr = pattern
		.replace(/\./g, '\\.')
		.replace(/\*\*/g, '{{GLOBSTAR}}')
		.replace(/\*/g, '[^/]*')
		.replace(/\{\{GLOBSTAR\}\}/g, '.*')
		.replace(/\?/g, '[^/]');
	const regex = new RegExp(`(^|/)${regexStr}$`, 'i');
	return regex.test(normalized);
}

// ---- Service ----

const SKILLS_DIR_NAME = '.v3code/skills';
const MAX_TOTAL_SKILLS_CHARS = 16_000;
const MAX_SINGLE_SKILL_CHARS = 4_000;

class SkillsService extends Disposable implements ISkillsService {
	readonly _serviceBrand: undefined;

	private _cachedSkills: SkillDescriptor[] | null = null;
	private _cacheTimestamp = 0;
	private static readonly CACHE_TTL_MS = 30_000;

	constructor(
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IPathService private readonly pathService: IPathService,
		@ILogService _logService: ILogService,
	) {
		super();
	}

	invalidateCache(): void {
		this._cachedSkills = null;
		this._cacheTimestamp = 0;
	}

	async getAvailableSkillsList(): Promise<Array<{ name: string; description: string }>> {
		const skills = await this._loadSkills();
		return skills.map(s => ({ name: s.name, description: s.description }));
	}

	async getMatchingSkills(activeFilePath: string | undefined, userMessage: string): Promise<string> {
		const skills = await this._loadSkills();
		if (skills.length === 0) return '';

		const lowerMessage = userMessage.toLowerCase();
		const sections: string[] = [];
		let totalChars = 0;

		// Priority 1: alwaysApply skills
		for (const skill of skills) {
			if (!skill.triggers.alwaysApply) continue;
			const truncated = skill.content.slice(0, MAX_SINGLE_SKILL_CHARS);
			if (totalChars + truncated.length > MAX_TOTAL_SKILLS_CHARS) break;
			sections.push(`<!-- Skill: ${skill.name} (always) -->\n${truncated}`);
			totalChars += truncated.length;
		}

		// Priority 2: glob-matching skills
		if (activeFilePath) {
			for (const skill of skills) {
				if (skill.triggers.alwaysApply) continue;
				if (!skill.triggers.globs || skill.triggers.globs.length === 0) continue;

				const matches = skill.triggers.globs.some(g => matchSkillGlob(g, activeFilePath));
				if (!matches) continue;

				const truncated = skill.content.slice(0, MAX_SINGLE_SKILL_CHARS);
				if (totalChars + truncated.length > MAX_TOTAL_SKILLS_CHARS) break;
				sections.push(`<!-- Skill: ${skill.name} (file match) -->\n${truncated}`);
				totalChars += truncated.length;
			}
		}

		// Priority 3: keyword-matching skills
		for (const skill of skills) {
			if (skill.triggers.alwaysApply) continue;
			if (!skill.triggers.keywords || skill.triggers.keywords.length === 0) continue;
			if (sections.some(s => s.includes(`Skill: ${skill.name}`))) continue;

			const keywordHit = skill.triggers.keywords.some(kw => lowerMessage.includes(kw.toLowerCase()));
			if (!keywordHit) continue;

			const truncated = skill.content.slice(0, MAX_SINGLE_SKILL_CHARS);
			if (totalChars + truncated.length > MAX_TOTAL_SKILLS_CHARS) break;
			sections.push(`<!-- Skill: ${skill.name} (keyword match) -->\n${truncated}`);
			totalChars += truncated.length;
		}

		if (sections.length === 0) return '';
		return `\n\n<active_skills>\nThe following skills are loaded for this context:\n\n${sections.join('\n\n')}\n</active_skills>`;
	}

	private async _loadSkills(): Promise<SkillDescriptor[]> {
		const now = Date.now();
		if (this._cachedSkills && (now - this._cacheTimestamp) < SkillsService.CACHE_TTL_MS) {
			return this._cachedSkills;
		}

		const skills: SkillDescriptor[] = [];

		// Load from user-level: ~/.v3code/skills/
		try {
			const userHome = this.pathService.userHome({ preferLocal: true });
			const userSkillsDir = URI.joinPath(userHome, '.v3code', 'skills');
			await this._loadSkillsFromDir(userSkillsDir, skills);
		} catch { /* user skills dir doesn't exist */ }

		// Load from workspace-level: .v3code/skills/ (overrides user-level by name)
		const folders = this.workspaceContextService.getWorkspace().folders;
		for (const folder of folders) {
			const wsSkillsDir = URI.joinPath(folder.uri, SKILLS_DIR_NAME);
			await this._loadSkillsFromDir(wsSkillsDir, skills);
		}

		this._cachedSkills = skills;
		this._cacheTimestamp = now;
		return skills;
	}

	private async _loadSkillsFromDir(dir: URI, skills: SkillDescriptor[]): Promise<void> {
		try {
			const stat = await this.fileService.resolve(dir);
			if (!stat.children) return;

			for (const child of stat.children) {
				if (child.isDirectory) {
					// Skill directories contain SKILL.md
					const skillFile = URI.joinPath(child.resource, 'SKILL.md');
					try {
						const content = (await this.fileService.readFile(skillFile)).value.toString();
						const skill = this._parseSkill(content, child.name, skillFile.fsPath);
						if (skill) {
							// Workspace skills override user skills with same name
							const existingIdx = skills.findIndex(s => s.name === skill.name);
							if (existingIdx >= 0) skills[existingIdx] = skill;
							else skills.push(skill);
						}
					} catch { /* SKILL.md doesn't exist in this dir */ }
				} else if (child.name.endsWith('.md') || child.name.endsWith('.mdc')) {
					// Single-file skills
					try {
						const content = (await this.fileService.readFile(child.resource)).value.toString();
						const name = child.name.replace(/\.(md|mdc)$/, '');
						const skill = this._parseSkill(content, name, child.resource.fsPath);
						if (skill) {
							const existingIdx = skills.findIndex(s => s.name === skill.name);
							if (existingIdx >= 0) skills[existingIdx] = skill;
							else skills.push(skill);
						}
					} catch { /* read error */ }
				}
			}
		} catch { /* directory doesn't exist */ }
	}

	private _parseSkill(content: string, fallbackName: string, filePath: string): SkillDescriptor | null {
		const { meta, body } = parseSkillFrontmatter(content);
		if (!body.trim()) return null;

		return {
			name: meta.name || fallbackName,
			description: meta.description || '',
			triggers: {
				globs: Array.isArray(meta.globs) ? meta.globs : (meta.glob ? [meta.glob] : undefined),
				keywords: Array.isArray(meta.keywords) ? meta.keywords : undefined,
				alwaysApply: meta.alwaysApply === true,
			},
			content: body.trim(),
			filePath,
		};
	}
}

registerSingleton(ISkillsService, SkillsService, InstantiationType.Delayed);
