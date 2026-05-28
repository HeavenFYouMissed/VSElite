import { z } from 'zod';

const EnvSchema = z.object({
	PORT: z.coerce.number().int().positive().default(8787),
	HOST: z.string().default('0.0.0.0'),
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

	DATABASE_URL: z.string().url(),

	DEEPSEEK_API_KEY: z.string().min(1),
	DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),
	DEEPSEEK_MODEL_PRO: z.string().default('deepseek-v4-pro'),
	DEEPSEEK_MODEL_FLASH: z.string().default('deepseek-v4-flash'),

	EMBEDDINGS_PROVIDER: z.enum(['openai']).default('openai'),
	EMBEDDINGS_API_KEY: z.string().min(1),
	EMBEDDINGS_MODEL: z.string().default('text-embedding-3-small'),
	EMBEDDINGS_DIM: z.coerce.number().int().positive().default(1536),

	CACHE_L1_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
	CACHE_L1_MAX_BYTES_PER_USER: z.coerce.number().int().positive().default(10_737_418_240),
	CACHE_L2_COSINE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.93),
	CACHE_L3_COSINE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.96),
	CACHE_L3_MIN_OCCURRENCES: z.coerce.number().int().positive().default(20),
	CACHE_L3_QUARANTINE_HOURS: z.coerce.number().int().nonnegative().default(24),
	CACHE_L3_ENABLED: z.coerce.boolean().default(false),

	SESSION_SECRET: z.string().min(32),
	GITHUB_CLIENT_ID: z.string().min(1),
	GITHUB_CLIENT_SECRET: z.string().min(1),
	GITHUB_OAUTH_REDIRECT: z.string().url(),

	STRIPE_SECRET_KEY: z.string().min(1),
	STRIPE_WEBHOOK_SECRET: z.string().min(1),
	STRIPE_PRICE_BUILDER: z.string().min(1),
	STRIPE_PRICE_PRO: z.string().min(1),
	STRIPE_PRICE_UNLIMITED: z.string().min(1),
	STRIPE_TRIAL_DAYS_BUILDER: z.coerce.number().int().nonnegative().default(7),
	STRIPE_TRIAL_DAYS_PRO: z.coerce.number().int().nonnegative().default(7),
	STRIPE_TRIAL_DAYS_UNLIMITED: z.coerce.number().int().nonnegative().default(0),
	// Optional: pin Customer Portal to a V3Code-specific config so the default dashboard portal
	// (which may be shared/overridden by other businesses on the same Stripe account) can't conflict.
	// Create via `npm run setup:portal` once, then paste the returned bpc_... id here.
	STRIPE_PORTAL_CONFIG_ID: z.string().optional(),
	// Product IDs (used by setup:portal script + future admin tools; runtime billing doesn't need them).
	STRIPE_PRODUCT_BUILDER: z.string().optional(),
	STRIPE_PRODUCT_PRO: z.string().optional(),
	STRIPE_PRODUCT_UNLIMITED: z.string().optional(),

	PUBLIC_API_URL: z.string().url(),
	PUBLIC_WEB_URL: z.string().url()
});

export type AppConfig = z.infer<typeof EnvSchema>;

let cached: AppConfig | undefined;

export function loadConfig(): AppConfig {
	if (cached) return cached;
	const parsed = EnvSchema.safeParse(process.env);
	if (!parsed.success) {
		const issues = parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
		throw new Error(`Invalid environment configuration:\n${issues}`);
	}
	cached = parsed.data;
	return cached;
}
