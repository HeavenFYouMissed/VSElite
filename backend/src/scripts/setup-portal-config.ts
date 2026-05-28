/**
 * One-time bootstrap: in test OR live mode (auto-detected from the key prefix),
 * create the 3 V3Code products + monthly USD prices if they don't exist,
 * then create the V3Code-specific Customer Portal configuration.
 *
 * Prints a block of env values to paste into .env.
 *
 * Run: `npm run setup:portal`
 */
import 'dotenv/config';
import Stripe from 'stripe';

interface TierSpec {
	envSuffix: 'BUILDER' | 'PRO' | 'UNLIMITED';
	name: string;
	description: string;
	unitAmount: number;
}

const TIERS: TierSpec[] = [
	{ envSuffix: 'BUILDER', name: 'V3Code Builder', description: 'Hosted DeepSeek-Flash, 2M tokens/mo, 7-day trial.', unitAmount: 500 },
	{ envSuffix: 'PRO', name: 'V3Code Pro', description: 'Hosted DeepSeek-Pro, 8M tokens/mo, 7-day trial.', unitAmount: 1900 },
	{ envSuffix: 'UNLIMITED', name: 'V3Code Unlimited', description: 'Hosted DeepSeek-Pro, soft-unlimited tokens.', unitAmount: 9900 }
];

function req(name: string): string {
	const v = process.env[name];
	if (!v || v.trim() === '') throw new Error(`Missing required env: ${name} — set it in vselite/backend/.env`);
	return v;
}

async function findOrCreateProduct(stripe: Stripe, tier: TierSpec): Promise<{ product: string; price: string }> {
	const search = await stripe.products.search({ query: `metadata['v3code_tier']:'${tier.envSuffix}' AND active:'true'`, limit: 1 });
	let product = search.data[0];
	if (!product) {
		product = await stripe.products.create({
			name: tier.name,
			description: tier.description,
			metadata: { v3code_tier: tier.envSuffix }
		});
		console.log(`  + Created product ${tier.name} → ${product.id}`);
	} else {
		console.log(`  = Reusing product ${tier.name} → ${product.id}`);
	}

	const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
	let price = prices.data.find(p => p.unit_amount === tier.unitAmount && p.currency === 'usd' && p.recurring?.interval === 'month');
	if (!price) {
		price = await stripe.prices.create({
			product: product.id,
			unit_amount: tier.unitAmount,
			currency: 'usd',
			recurring: { interval: 'month' }
		});
		console.log(`  + Created price $${tier.unitAmount / 100}/mo → ${price.id}`);
	} else {
		console.log(`  = Reusing price $${tier.unitAmount / 100}/mo → ${price.id}`);
	}
	return { product: product.id, price: price.id };
}

async function main(): Promise<void> {
	const secretKey = req('STRIPE_SECRET_KEY');
	const mode = secretKey.includes('_test_') ? 'TEST' : secretKey.includes('_live_') ? 'LIVE' : 'UNKNOWN';
	const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

	console.log(`\n[setup:portal] Stripe mode: ${mode}\n`);
	console.log('Step 1/2 — ensuring products + prices exist...');
	const results: Record<string, { product: string; price: string }> = {};
	for (const tier of TIERS) {
		results[tier.envSuffix] = await findOrCreateProduct(stripe, tier);
	}

	console.log('\nStep 2/2 — creating Customer Portal configuration...');
	const config = await stripe.billingPortal.configurations.create({
		business_profile: { headline: 'V3Code — Manage your subscription' },
		features: {
			subscription_update: {
				enabled: true,
				default_allowed_updates: ['price', 'promotion_code'],
				proration_behavior: 'create_prorations',
				products: TIERS.map(t => ({ product: results[t.envSuffix].product, prices: [results[t.envSuffix].price] }))
			},
			subscription_cancel: { enabled: true, mode: 'immediately', proration_behavior: 'create_prorations' },
			payment_method_update: { enabled: true },
			invoice_history: { enabled: true },
			customer_update: { enabled: true, allowed_updates: ['email', 'address', 'phone', 'tax_id'] }
		}
	});
	console.log(`  + Created portal config → ${config.id}`);

	console.log('\n========================================================');
	console.log(`✓ V3Code Stripe bootstrap complete (${mode} mode).`);
	console.log('========================================================');
	console.log('\nPaste these into vselite/backend/.env (replacing any existing values):\n');
	console.log(`STRIPE_PRODUCT_BUILDER=${results.BUILDER.product}`);
	console.log(`STRIPE_PRODUCT_PRO=${results.PRO.product}`);
	console.log(`STRIPE_PRODUCT_UNLIMITED=${results.UNLIMITED.product}`);
	console.log(`STRIPE_PRICE_BUILDER=${results.BUILDER.price}`);
	console.log(`STRIPE_PRICE_PRO=${results.PRO.price}`);
	console.log(`STRIPE_PRICE_UNLIMITED=${results.UNLIMITED.price}`);
	console.log(`STRIPE_PORTAL_CONFIG_ID=${config.id}`);
	console.log('');
}

main().catch(err => {
	console.error('\nsetup:portal failed:', err instanceof Error ? err.message : err);
	process.exit(1);
});
