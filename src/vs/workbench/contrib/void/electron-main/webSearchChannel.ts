/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';

export type WebSearchResult = { title: string; url: string; snippet: string };

// Hosted SearXNG on Railway (free-ai-search stack) — works for all users, no setup
const HOSTED_SEARXNG = 'https://searxng-production-8888.up.railway.app';

// Optional local/self-hosted SearXNG override via env var
const LOCAL_SEARXNG = (process.env.SEARXNG_BASE_URL || process.env.V3CODE_SEARXNG_URL || '').replace(/\/$/, '');

// In-memory cache to avoid hammering search on repeat queries
const cache = new Map<string, { results: WebSearchResult[]; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCached(query: string, maxResults: number): WebSearchResult[] | null {
	const key = query.toLowerCase().trim();
	const entry = cache.get(key);
	if (!entry) return null;
	if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
	return entry.results.slice(0, maxResults);
}

function setCache(query: string, results: WebSearchResult[]): void {
	const key = query.toLowerCase().trim();
	cache.set(key, { results, ts: Date.now() });
	// Lazy cleanup: prune old entries when cache gets large
	if (cache.size > 500) {
		const now = Date.now();
		for (const [k, v] of cache) { if (now - v.ts > CACHE_TTL) cache.delete(k); }
	}
}

async function fetchSearXNG(base: string, query: string, maxResults: number, timeoutMs = 10_000): Promise<WebSearchResult[]> {
	const params = new URLSearchParams({ q: query, format: 'json', language: 'en', safesearch: '1' });
	try {
		const res = await fetch(`${base}/search?${params}`, {
			signal: AbortSignal.timeout(timeoutMs),
			headers: { Accept: 'application/json' },
		});
		if (res.status === 200) {
			const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
			if (Array.isArray(data.results) && data.results.length > 0) {
				return data.results
					.filter(r => r.url && r.title)
					.slice(0, maxResults)
					.map(r => ({
						title: String(r.title || ''),
						url: String(r.url || ''),
						snippet: String(r.content || '').slice(0, 500),
					}));
			}
		}
	} catch { /* JSON format may be disabled — fall through to HTML */ }

	// Fallback: fetch as HTML and parse <article> blocks (works even when format=json is 403)
	const htmlParams = new URLSearchParams({ q: query, language: 'en', safesearch: '1' });
	const res = await fetch(`${base}/search?${htmlParams}`, {
		signal: AbortSignal.timeout(timeoutMs),
		headers: { Accept: 'text/html' },
	});
	if (res.status !== 200) return [];
	const html = await res.text();
	return parseSearXNGHTML(html, maxResults);
}

function parseSearXNGHTML(html: string, maxResults: number): WebSearchResult[] {
	const results: WebSearchResult[] = [];
	// Each result: <article class="result result-default ..."><h3><a href="URL">TITLE</a></h3><p class="content">SNIPPET</p>
	const articleRegex = /<article[^>]+class="result[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
	let match: RegExpExecArray | null;
	while ((match = articleRegex.exec(html)) !== null && results.length < maxResults) {
		const block = match[1];
		// Extract URL + title from <h3><a href="...">...</a></h3>
		const h3Match = /<h3[^>]*><a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a><\/h3>/i.exec(block);
		if (!h3Match) continue;
		const url = h3Match[1];
		const title = h3Match[2].replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'").replace(/&#34;/g, '"').replace(/&amp;/g, '&').trim();
		if (!url || !title || url.startsWith('/')) continue;
		// Extract snippet from <p class="content">...</p>
		const snippetMatch = /<p\s+class="content"[^>]*>([\s\S]*?)<\/p>/i.exec(block);
		const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
		results.push({ title, url, snippet });
	}
	return results;
}

/** DuckDuckGo HTML POST — last-resort offline fallback. */
async function fetchDuckDuckGoPost(query: string, maxResults: number): Promise<WebSearchResult[]> {
	const res = await fetch('https://html.duckduckgo.com/html/', {
		method: 'POST',
		signal: AbortSignal.timeout(10_000),
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
			'Accept': 'text/html',
			'Accept-Language': 'en-US,en;q=0.9',
			'Referer': 'https://duckduckgo.com/',
		},
		body: `q=${encodeURIComponent(query)}`,
	});
	if (res.status !== 200) return [];
	const html = await res.text();
	const results: WebSearchResult[] = [];
	const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
	let match: RegExpExecArray | null;
	while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
		let href = match[1];
		const title = match[2].replace(/<[^>]*>/g, '').trim();
		if (!href || !title) continue;
		if (href.includes('uddg=')) {
			const decoded = decodeURIComponent(href.split('uddg=')[1]?.split('&')[0] ?? '');
			if (decoded) href = decoded;
		}
		if (href.startsWith('/') || href.includes('duckduckgo.com')) continue;
		results.push({ title, url: href, snippet: '' });
	}
	const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
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

		// Check cache first
		const cached = getCached(query, maxResults);
		if (cached) return { results: cached };

		let results: WebSearchResult[] = [];

		// 1. Hosted SearXNG (Railway — always available, no setup)
		try {
			results = await fetchSearXNG(HOSTED_SEARXNG, query, maxResults);
		} catch { /* hosted instance unreachable */ }

		// 2. Local/self-hosted SearXNG (if user configured one)
		if (results.length === 0 && LOCAL_SEARXNG) {
			try {
				results = await fetchSearXNG(LOCAL_SEARXNG, query, maxResults);
			} catch { /* local instance unavailable */ }
		}

		// 3. DDG HTML POST (offline/last resort — may get 202 bot page)
		if (results.length === 0) {
			try {
				results = await fetchDuckDuckGoPost(query, maxResults);
			} catch { /* DDG blocked or offline */ }
		}

		if (results.length > 0) { setCache(query, results); }
		return { results };
	}
}
