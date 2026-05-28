import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { loadConfig } from './config.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerBillingRoutes } from './routes/billing.js';

const cfg = loadConfig();

const app = Fastify({
	logger: {
		level: cfg.LOG_LEVEL,
		transport: cfg.NODE_ENV === 'development'
			? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' } }
			: undefined
	},
	trustProxy: true,
	// Stripe webhooks need raw body for signature verification.
	bodyLimit: 2 * 1024 * 1024
});

await app.register(helmet, {
	contentSecurityPolicy: false // app is API-only, no HTML to protect
});
await app.register(cors, {
	origin: [cfg.PUBLIC_WEB_URL],
	credentials: true
});
await app.register(cookie, {
	secret: cfg.SESSION_SECRET
});
await app.register(rateLimit, {
	global: true,
	max: 600,
	timeWindow: '1 minute',
	skip: (req) => {
		// Don't rate-limit Stripe webhooks — Stripe will retry but we don't want to drop them.
		return req.url.startsWith('/billing/webhook');
	}
});

// Capture raw body for Stripe webhook signature verification.
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
	(req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
	try {
		const json = body.length === 0 ? {} : JSON.parse((body as Buffer).toString('utf-8'));
		done(null, json);
	} catch (err) {
		done(err as Error, undefined);
	}
});

app.get('/health', async () => ({ ok: true, service: 'v3code-backend', env: cfg.NODE_ENV }));

await registerAuthRoutes(app);
await registerChatRoutes(app);
await registerBillingRoutes(app);

const shutdown = async (signal: string) => {
	app.log.info({ signal }, 'shutting down');
	await app.close();
	process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
	await app.listen({ port: cfg.PORT, host: cfg.HOST });
} catch (err) {
	app.log.fatal({ err }, 'failed to start');
	process.exit(1);
}
