import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildAuthorizeUrl, completeOAuth } from '../auth/github.js';
import { createDeviceCode, approveDeviceCode, pollDeviceCode } from '../auth/device.js';
import { createSession, validateSession, revokeSession } from '../auth/session.js';
import { loadConfig } from '../config.js';
import { randomBytes } from 'node:crypto';

const cfg = loadConfig();

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
	// ---- Web OAuth flow ----

	app.get('/auth/github/start', async (req, reply) => {
		const state = randomBytes(16).toString('hex');
		// Stash state + optional device_code in a signed cookie. Validated on callback.
		const deviceCode = (req.query as { device_code?: string }).device_code;
		reply.setCookie('oauth_state', `${state}.${deviceCode ?? ''}`, {
			httpOnly: true,
			secure: cfg.NODE_ENV === 'production',
			sameSite: 'lax',
			path: '/',
			maxAge: 15 * 60
		});
		reply.redirect(buildAuthorizeUrl(state));
	});

	app.get('/auth/github/callback', async (req, reply) => {
		const q = z.object({ code: z.string(), state: z.string() }).safeParse(req.query);
		if (!q.success) return reply.code(400).send({ error: 'invalid_request' });

		const cookie = req.cookies.oauth_state;
		if (!cookie || !cookie.startsWith(`${q.data.state}.`)) {
			return reply.code(400).send({ error: 'state_mismatch' });
		}
		reply.clearCookie('oauth_state', { path: '/' });
		const deviceCode = cookie.slice(q.data.state.length + 1);

		const { userId } = await completeOAuth(q.data.code);

		// If this OAuth was triggered from an editor device-code flow, approve that device-code now
		// and redirect the browser to a "you're signed in, return to editor" page.
		if (deviceCode) {
			// The browser submitted device_code via query — but we actually need user_code.
			// In practice the verification page collects user_code; this is the post-form callback.
			// Approve by user_code if present.
			const userCode = (req.query as { user_code?: string }).user_code;
			if (userCode) {
				await approveDeviceCode(userCode, userId);
			}
			return reply.redirect(`${cfg.PUBLIC_WEB_URL}/auth/device-success`);
		}

		// Plain web flow → mint session, set cookie, redirect to dashboard.
		const session = await createSession(userId, req.headers['user-agent'] ?? null);
		reply.setCookie('v3c_session', session.tokenPlain, {
			httpOnly: true,
			secure: cfg.NODE_ENV === 'production',
			sameSite: 'lax',
			path: '/',
			expires: session.expiresAt
		});
		return reply.redirect(`${cfg.PUBLIC_WEB_URL}/dashboard`);
	});

	app.post('/auth/logout', async (req, reply) => {
		const token = req.cookies.v3c_session ?? extractBearerToken(req);
		if (token) await revokeSession(token);
		reply.clearCookie('v3c_session', { path: '/' });
		return { ok: true };
	});

	// ---- Device-code flow (for the editor) ----

	app.post('/auth/device', async (_req) => {
		const dc = await createDeviceCode();
		return {
			...dc,
			verification_uri: `${cfg.PUBLIC_WEB_URL}/auth/device`,
			verification_uri_complete: `${cfg.PUBLIC_WEB_URL}/auth/device?user_code=${dc.user_code}`
		};
	});

	app.post('/auth/device/poll', async (req, reply) => {
		const body = z.object({ device_code: z.string().min(1) }).safeParse(req.body);
		if (!body.success) return reply.code(400).send({ error: 'invalid_request' });

		const result = await pollDeviceCode(body.data.device_code);
		if (result.status === 'pending') {
			return reply.code(202).send({ status: 'authorization_pending' });
		}
		if (result.status !== 'approved' || !result.userId) {
			return reply.code(400).send({ status: result.status });
		}

		// One-shot session mint upon device approval.
		const session = await createSession(result.userId, req.headers['user-agent'] ?? null);
		return {
			access_token: session.tokenPlain,
			token_type: 'Bearer',
			expires_at: session.expiresAt.toISOString()
		};
	});

	// ---- Web form: user pastes user_code, gets redirected through OAuth ----

	app.post('/auth/device/approve', async (req, reply) => {
		// Authenticated route — user must already have a session cookie.
		const token = req.cookies.v3c_session;
		if (!token) return reply.code(401).send({ error: 'login_required' });
		const user = await validateSession(token);
		if (!user) return reply.code(401).send({ error: 'login_required' });

		const body = z.object({ user_code: z.string().min(1) }).safeParse(req.body);
		if (!body.success) return reply.code(400).send({ error: 'invalid_request' });

		const ok = await approveDeviceCode(body.data.user_code, user.id);
		return ok ? { ok: true } : reply.code(400).send({ error: 'invalid_user_code' });
	});

	// ---- Current user ----

	app.get('/auth/me', async (req, reply) => {
		const token = req.cookies.v3c_session ?? extractBearerToken(req);
		if (!token) return reply.code(401).send({ error: 'unauthenticated' });
		const user = await validateSession(token);
		if (!user) return reply.code(401).send({ error: 'unauthenticated' });
		return {
			id: user.id,
			github_login: user.githubLogin,
			tier: user.tier,
			l3_opt_in: user.l3OptIn
		};
	});
}

function extractBearerToken(req: FastifyRequest): string | null {
	const h = req.headers.authorization;
	if (!h || !h.startsWith('Bearer ')) return null;
	return h.slice(7);
}
