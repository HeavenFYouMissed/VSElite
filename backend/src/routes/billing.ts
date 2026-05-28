import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateSession } from '../auth/session.js';
import { createCheckoutSession, createPortalSession, handleWebhook } from '../billing/stripe.js';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { loadConfig } from '../config.js';

const cfg = loadConfig();

export async function registerBillingRoutes(app: FastifyInstance): Promise<void> {
	app.post('/billing/checkout', async (req, reply) => {
		const token = req.cookies.v3c_session;
		if (!token) return reply.code(401).send({ error: 'unauthenticated' });
		const user = await validateSession(token);
		if (!user) return reply.code(401).send({ error: 'unauthenticated' });

		const body = z.object({ tier: z.enum(['builder', 'pro', 'unlimited']) }).safeParse(req.body);
		if (!body.success) return reply.code(400).send({ error: 'invalid_request' });

		const { url } = await createCheckoutSession({
			userId: user.id,
			tier: body.data.tier,
			successUrl: `${cfg.PUBLIC_WEB_URL}/dashboard?upgraded=1`,
			cancelUrl: `${cfg.PUBLIC_WEB_URL}/pricing`
		});
		return { url };
	});

	// Customer Portal — user manages payment method, switches plans, cancels.
	// Uses STRIPE_PORTAL_CONFIG_ID when set so V3Code's portal is isolated from other businesses
	// on the same Stripe account.
	app.post('/billing/portal', async (req, reply) => {
		const token = req.cookies.v3c_session;
		if (!token) return reply.code(401).send({ error: 'unauthenticated' });
		const user = await validateSession(token);
		if (!user) return reply.code(401).send({ error: 'unauthenticated' });
		try {
			const { url } = await createPortalSession({
				userId: user.id,
				returnUrl: `${cfg.PUBLIC_WEB_URL}/dashboard`
			});
			return { url };
		} catch (err) {
			req.log.error({ err }, 'stripe portal session failed');
			return reply.code(400).send({ error: 'portal_unavailable', detail: (err as Error).message });
		}
	});

	// Stripe sends webhook with raw body — we need the raw bytes for signature verification.
	app.post('/billing/webhook', {
		config: { rawBody: true }
	}, async (req, reply) => {
		const sig = req.headers['stripe-signature'];
		if (!sig || typeof sig !== 'string') return reply.code(400).send({ error: 'missing_signature' });
		const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
		if (!raw) return reply.code(400).send({ error: 'missing_body' });
		try {
			await handleWebhook(raw, sig);
			return { received: true };
		} catch (err) {
			req.log.error({ err }, 'stripe webhook failed');
			return reply.code(400).send({ error: 'webhook_failed' });
		}
	});

	app.get('/billing/usage', async (req, reply) => {
		const token = req.cookies.v3c_session ?? extractBearer(req.headers.authorization);
		if (!token) return reply.code(401).send({ error: 'unauthenticated' });
		const user = await validateSession(token);
		if (!user) return reply.code(401).send({ error: 'unauthenticated' });

		const now = new Date();
		const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
		const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

		const rows = await db
			.select()
			.from(schema.quotaPeriods)
			.where(eq(schema.quotaPeriods.userId, user.id));

		const current = rows.find(r => r.periodStart.getTime() === periodStart.getTime());
		return {
			period_start: periodStart.toISOString(),
			period_end: periodEnd.toISOString(),
			tier: user.tier,
			input_tokens_used: Number(current?.inputTokensCharged ?? 0),
			output_tokens_used: Number(current?.outputTokensCharged ?? 0),
			request_count: current?.requestCount ?? 0,
			cache_hits: {
				l1: current?.cacheHitL1 ?? 0,
				l2: current?.cacheHitL2 ?? 0,
				l3: current?.cacheHitL3 ?? 0,
				miss: current?.cacheMiss ?? 0
			}
		};
	});
}

function extractBearer(h: string | undefined): string | null {
	if (!h || !h.startsWith('Bearer ')) return null;
	return h.slice(7);
}
