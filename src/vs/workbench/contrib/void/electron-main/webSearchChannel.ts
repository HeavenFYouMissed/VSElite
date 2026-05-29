/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';

export type WebSearchResult = { title: string; url: string; snippet: string };

const SEARXNG_BASE = (process.env.SEARXNG_BASE_URL || process.env.V3CODE_SEARXNG_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');

async function fetchSearXNG(query: string, maxResults: number): Promise<WebSearchResult[]> {
	const params = new URLSearchParams({ q: query, format: 'json', language: 'en', safesearch: '1' });
	const res = await fetch(`${SEARXNG_BASE}/search?${params}`, {
		signal: AbortSignal.timeout(12_000),
		headers: { Accept: 'application/json', 'User-Agent': 'V3Code/1.0' },
	});
	if (!res.ok) { return []; }
	const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
	if (!Array.isArray(data.results)) { return []; }
	return data.results
		.filter(r => r.url && r.title)
		.slice(0, maxResults)
		.map(r => ({
			title: String(r.title || ''),
			url: String(r.url || ''),
			snippet: String(r.content || '').slice(0, 500),
		}));
}

/** DuckDuckGo lite HTML parse — Node fetch has no CORS. */
async function fetchDuckDuckGoLite(query: string, maxResults: number): Promise<WebSearchResult[]> {
	const encoded = encodeURIComponent(query);
	const url = `https://lite.duckduckgo.com/lite/?q=${encoded}`;
	const res = await fetch(url, {
		signal: AbortSignal.timeout(12_000),
		headers: { 'User-Agent': 'V3Code/1.0', Accept: 'text/html' },
	});
	const html = await res.text();
	const results: WebSearchResult[] = [];
	const linkRegex = /<a[^>]+rel="nofollow"[^>]+href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/gi;
	let match: RegExpExecArray | null;
	while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
		const href = match[1];
		const title = match[2].replace(/<[^>]*>/g, '').trim();
		if (!href || !title || href.startsWith('/') || href.includes('duckduckgo.com')) { continue; }
		results.push({ title, url: href, snippet: '' });
	}
	const snippetRegex = /<td\s+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
	let snippetIdx = 0;
	while ((match = snippetRegex.exec(html)) !== null && snippetIdx < results.length) {
		results[snippetIdx].snippet = match[1].replace(/<[^>]*>/g, '').trim();
		snippetIdx++;
	}
	return results;
}

export class WebSearchChannel implements IServerChannel {
	listen(): never { throw new Error('WebSearchChannel: no events'); }

	async call(_: unknown, command: string, arg?: { query?: string; maxResults?: number }): Promise<any> {
		if (command !== 'search') { throw new Error(`WebSearchChannel: unknown command ${command}`); }
		const query = String(arg?.query ?? '').trim();
		const maxResults = Math.min(10, Math.max(1, Number(arg?.maxResults) || 5));
		if (!query) { return { results: [] }; }

		let results: WebSearchResult[] = [];
		try {
			results = await fetchSearXNG(query, maxResults);
		} catch { /* SearXNG unavailable */ }

		if (results.length === 0) {
			try {
				results = await fetchDuckDuckGoLite(query, maxResults);
			} catch { /* offline */ }
		}

		return { results };
	}
}
