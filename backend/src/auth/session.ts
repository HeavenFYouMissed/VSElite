import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';

const SESSION_TTL_DAYS = 90;

export interface SessionInfo {
	userId: string;
	tokenPlain: string;
	expiresAt: Date;
}

/**
 * Create a new session for a user. Returns the plaintext token (to send to the client)
 * and the expiry. The DB stores only the SHA-256 hash of the token.
 */
export async function createSession(userId: string, userAgent: string | null): Promise<SessionInfo> {
	const tokenPlain = `v3c_${randomBytes(32).toString('hex')}`;
	const tokenHash = sha256(tokenPlain);
	const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

	await db.insert(schema.sessions).values({
		userId,
		tokenHash,
		userAgent,
		expiresAt
	});

	return { userId, tokenPlain, expiresAt };
}

export interface AuthedUser {
	id: string;
	githubLogin: string;
	tier: 'free' | 'pro' | 'team' | 'enterprise';
	upstreamUserId: string;
	l3OptIn: boolean;
}

/**
 * Validate a bearer token and return the user. Returns null if invalid or expired.
 */
export async function validateSession(tokenPlain: string): Promise<AuthedUser | null> {
	if (!tokenPlain.startsWith('v3c_')) return null;
	const tokenHash = sha256(tokenPlain);

	const rows = await db
		.select({
			userId: schema.sessions.userId,
			expiresAt: schema.sessions.expiresAt,
			githubLogin: schema.users.githubLogin,
			tier: schema.users.tier,
			upstreamUserId: schema.users.upstreamUserId,
			l3OptIn: schema.users.l3OptIn
		})
		.from(schema.sessions)
		.innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
		.where(eq(schema.sessions.tokenHash, tokenHash))
		.limit(1);

	const row = rows[0];
	if (!row) return null;
	if (row.expiresAt.getTime() <= Date.now()) return null;

	return {
		id: row.userId,
		githubLogin: row.githubLogin,
		tier: row.tier,
		upstreamUserId: row.upstreamUserId,
		l3OptIn: row.l3OptIn
	};
}

export async function revokeSession(tokenPlain: string): Promise<void> {
	const tokenHash = sha256(tokenPlain);
	await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash));
}

function sha256(s: string): string {
	return createHash('sha256').update(s).digest('hex');
}

/**
 * Compute the deterministic anonymized id we pass to DeepSeek as `user_id`.
 *
 * = sha256(userId). Stable across sessions (so KV cache continuity works), no PII.
 */
export function computeUpstreamUserId(userId: string): string {
	return sha256(`v3code-upstream:${userId}`).slice(0, 64);
}
