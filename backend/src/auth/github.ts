import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { loadConfig } from '../config.js';
import { computeUpstreamUserId } from './session.js';

const cfg = loadConfig();

interface GitHubTokenResponse {
	access_token?: string;
	token_type?: string;
	scope?: string;
	error?: string;
	error_description?: string;
}

interface GitHubUser {
	id: number;
	login: string;
	email: string | null;
	avatar_url: string;
}

/**
 * Build the GitHub OAuth authorize URL for web flow.
 */
export function buildAuthorizeUrl(state: string): string {
	const url = new URL('https://github.com/login/oauth/authorize');
	url.searchParams.set('client_id', cfg.GITHUB_CLIENT_ID);
	url.searchParams.set('redirect_uri', cfg.GITHUB_OAUTH_REDIRECT);
	url.searchParams.set('scope', 'read:user user:email');
	url.searchParams.set('state', state);
	return url.toString();
}

/**
 * Exchange OAuth code for access token, fetch user, upsert into DB.
 */
export async function completeOAuth(code: string): Promise<{ userId: string }> {
	const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
		body: JSON.stringify({
			client_id: cfg.GITHUB_CLIENT_ID,
			client_secret: cfg.GITHUB_CLIENT_SECRET,
			code,
			redirect_uri: cfg.GITHUB_OAUTH_REDIRECT
		})
	});
	if (!tokenResp.ok) throw new Error(`github token exchange ${tokenResp.status}`);
	const tokenJson = (await tokenResp.json()) as GitHubTokenResponse;
	if (!tokenJson.access_token) {
		throw new Error(`github oauth error: ${tokenJson.error_description ?? tokenJson.error ?? 'no token'}`);
	}

	const ghUser = await fetchGitHubUser(tokenJson.access_token);
	const userId = await upsertGitHubUser(ghUser);
	return { userId };
}

async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
	const resp = await fetch('https://api.github.com/user', {
		headers: {
			'Authorization': `Bearer ${accessToken}`,
			'Accept': 'application/vnd.github+json',
			'User-Agent': 'v3code-backend'
		}
	});
	if (!resp.ok) throw new Error(`github /user ${resp.status}`);
	return (await resp.json()) as GitHubUser;
}

export async function upsertGitHubUser(gh: GitHubUser): Promise<string> {
	const githubId = String(gh.id);
	const existing = await db
		.select({ id: schema.users.id })
		.from(schema.users)
		.where(eq(schema.users.githubId, githubId))
		.limit(1);

	if (existing[0]) {
		await db
			.update(schema.users)
			.set({
				githubLogin: gh.login,
				email: gh.email,
				avatarUrl: gh.avatar_url,
				updatedAt: new Date()
			})
			.where(eq(schema.users.id, existing[0].id));
		return existing[0].id;
	}

	// New user — insert with placeholder upstreamUserId, then update with derived value.
	// (Two-step because upstreamUserId depends on the just-generated UUID.)
	const inserted = await db
		.insert(schema.users)
		.values({
			githubId,
			githubLogin: gh.login,
			email: gh.email,
			avatarUrl: gh.avatar_url,
			upstreamUserId: 'pending'
		})
		.returning({ id: schema.users.id });

	const userId = inserted[0]!.id;
	const upstreamUserId = computeUpstreamUserId(userId);
	await db
		.update(schema.users)
		.set({ upstreamUserId })
		.where(eq(schema.users.id, userId));

	return userId;
}
