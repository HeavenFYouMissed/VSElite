import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { loadConfig } from '../config.js';
import type { Tier } from './quota.js';

const cfg = loadConfig();

export const stripe = new Stripe(cfg.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

/**
 * Create a Stripe Checkout session for tier upgrade.
 *
 * Trial days are applied per tier via `subscription_data.trial_period_days`. Stripe handles
 * the trial-to-paid transition automatically; our webhook handler picks up the subscription
 * status changes and updates `users.subscriptionStatus`. The user gets full feature access
 * during trial (tier flips to paid on `checkout.session.completed`, not on first payment).
 */
export async function createCheckoutSession(opts: {
	userId: string;
	tier: 'builder' | 'pro' | 'unlimited';
	successUrl: string;
	cancelUrl: string;
}): Promise<{ url: string }> {
	const priceId =
		opts.tier === 'builder' ? cfg.STRIPE_PRICE_BUILDER :
			opts.tier === 'pro' ? cfg.STRIPE_PRICE_PRO :
				cfg.STRIPE_PRICE_UNLIMITED;

	const trialDays =
		opts.tier === 'builder' ? cfg.STRIPE_TRIAL_DAYS_BUILDER :
			opts.tier === 'pro' ? cfg.STRIPE_TRIAL_DAYS_PRO :
				cfg.STRIPE_TRIAL_DAYS_UNLIMITED;

	const user = await db
		.select({ stripeCustomerId: schema.users.stripeCustomerId, email: schema.users.email })
		.from(schema.users)
		.where(eq(schema.users.id, opts.userId))
		.limit(1);

	let customerId = user[0]?.stripeCustomerId ?? undefined;
	if (!customerId) {
		const customer = await stripe.customers.create({
			email: user[0]?.email ?? undefined,
			metadata: { user_id: opts.userId }
		});
		customerId = customer.id;
		await db
			.update(schema.users)
			.set({ stripeCustomerId: customerId })
			.where(eq(schema.users.id, opts.userId));
	}

	const session = await stripe.checkout.sessions.create({
		customer: customerId,
		mode: 'subscription',
		line_items: [{ price: priceId, quantity: 1 }],
		success_url: opts.successUrl,
		cancel_url: opts.cancelUrl,
		client_reference_id: opts.userId,
		metadata: { user_id: opts.userId, tier: opts.tier },
		subscription_data: trialDays > 0
			? { trial_period_days: trialDays, metadata: { user_id: opts.userId, tier: opts.tier } }
			: { metadata: { user_id: opts.userId, tier: opts.tier } },
		// Don't require card up-front during trial (better conversion).
		// Stripe will email the user before trial ends to collect payment.
		...(trialDays > 0 ? { payment_method_collection: 'if_required' as const } : {})
	});

	if (!session.url) throw new Error('stripe: checkout session missing url');
	return { url: session.url };
}

/**
 * Create a Stripe Billing Portal session so the user can manage their subscription.
 *
 * If `STRIPE_PORTAL_CONFIG_ID` is set we pin the session to that V3Code-specific config.
 * This matters when V3Code shares a Stripe account with other businesses — without pinning,
 * Stripe uses the account-wide "default" portal which other businesses can change/override,
 * and your V3Code customers could see wrong branding or wrong product list. With pinning,
 * V3Code's portal is isolated regardless of what else is on the account.
 *
 * Run `npm run setup:portal` once to create the config and get the bpc_... id.
 */
export async function createPortalSession(opts: {
	userId: string;
	returnUrl: string;
}): Promise<{ url: string }> {
	const rows = await db
		.select({ stripeCustomerId: schema.users.stripeCustomerId })
		.from(schema.users)
		.where(eq(schema.users.id, opts.userId))
		.limit(1);
	const customerId = rows[0]?.stripeCustomerId;
	if (!customerId) throw new Error('stripe: user has no stripe customer (must check out at least once)');

	const session = await stripe.billingPortal.sessions.create({
		customer: customerId,
		return_url: opts.returnUrl,
		...(cfg.STRIPE_PORTAL_CONFIG_ID ? { configuration: cfg.STRIPE_PORTAL_CONFIG_ID } : {})
	});
	return { url: session.url };
}


/**
 * Handle a Stripe webhook event. Verifies signature, updates user tier on subscription lifecycle.
 *
 * Tier-changing events:
 *   - checkout.session.completed         → upgrade tier (also fires during trial)
 *   - customer.subscription.updated      → sync status; may also change tier (plan switch)
 *   - customer.subscription.deleted      → downgrade to free
 *   - customer.subscription.trial_will_end → no-op (Stripe emails the user; we don't need to act)
 */
export async function handleWebhook(payload: Buffer, signature: string): Promise<void> {
	const event = stripe.webhooks.constructEvent(payload, signature, cfg.STRIPE_WEBHOOK_SECRET);

	switch (event.type) {
		case 'checkout.session.completed': {
			const session = event.data.object as Stripe.Checkout.Session;
			const userId = session.client_reference_id ?? session.metadata?.user_id;
			const tier = session.metadata?.tier as Tier | undefined;
			if (userId && tier && session.subscription) {
				await db.update(schema.users)
					.set({
						tier,
						stripeSubscriptionId: session.subscription as string,
						// trialing | active — we treat both as "tier active" for feature gating.
						subscriptionStatus: 'active',
						// Builder+ tiers opt user into L3 by default (ToS-mandated for hosted inference).
						// Free has no hosted inference, so the field is irrelevant there.
						l3OptIn: tier !== 'free'
					})
					.where(eq(schema.users.id, userId));
			}
			break;
		}
		case 'customer.subscription.updated':
		case 'customer.subscription.deleted': {
			const sub = event.data.object as Stripe.Subscription;
			const customer = sub.customer as string;
			const rows = await db
				.select({ id: schema.users.id })
				.from(schema.users)
				.where(eq(schema.users.stripeCustomerId, customer))
				.limit(1);
			if (rows[0]) {
				// `trialing` and `active` keep paid features. Anything else (past_due, canceled,
				// unpaid, incomplete_expired, paused) downgrades to free.
				const keepPaid = sub.status === 'active' || sub.status === 'trialing';
				const downgrade = !keepPaid;

				// Detect plan switch within the same subscription (e.g. Builder -> Pro upgrade).
				let newTier: Tier | undefined;
				const priceId = sub.items.data[0]?.price.id;
				if (priceId === cfg.STRIPE_PRICE_BUILDER) newTier = 'builder';
				else if (priceId === cfg.STRIPE_PRICE_PRO) newTier = 'pro';
				else if (priceId === cfg.STRIPE_PRICE_UNLIMITED) newTier = 'unlimited';

				await db.update(schema.users)
					.set({
						subscriptionStatus: sub.status,
						...(downgrade
							? { tier: 'free' as Tier, l3OptIn: false }
							: newTier
								? { tier: newTier, l3OptIn: true }
								: {})
					})
					.where(eq(schema.users.id, rows[0].id));
			}
			break;
		}
	}
}
