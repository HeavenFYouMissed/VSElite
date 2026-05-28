# V3Code — Stripe Setup Spec

Hand this to the Claude that has Stripe MCP access. Everything below is what the backend code expects. If you change anything (price names, currency, trial lengths), update both Stripe AND the corresponding env vars in `.env`.

Do **all** of this in **Test mode first**. We switch to Live mode at launch, not before.

---

## 1. Products + Prices (3 products, 3 recurring monthly prices)

Free is not a Stripe product — it's the default state in our DB. Don't create anything for Free.

| Product name      | Price (USD)   | Billing       | Trial      | Notes |
|-------------------|---------------|---------------|------------|-------|
| V3Code Builder    | **$5.00 / mo** | recurring monthly | 7 days | Stripe-native trial via `trial_period_days` |
| V3Code Pro        | **$19.00 / mo**| recurring monthly | 7 days | Stripe-native trial via `trial_period_days` |
| V3Code Unlimited  | **$99.00 / mo**| recurring monthly | none   | Goes straight to paid |

- Currency: **USD**
- Tax behavior on each price: **exclusive** (we'll enable Stripe Tax later; leave off for now)
- Billing scheme: **per_unit**
- After creating each price, copy the **price ID** (`price_xxxxx`) — those go into env vars below.

**Output you need to return to me:**

```
STRIPE_PRICE_BUILDER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_UNLIMITED=price_...
```

---

## 2. Webhook endpoint

- URL: `https://api.v3code.dev/billing/webhook`
  - For local testing use `stripe listen --forward-to localhost:3000/billing/webhook` and use its signing secret.
- Events to subscribe to (exactly these, nothing else):
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- After creating the endpoint, copy the **signing secret** (`whsec_...`).

**Output you need to return:**

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 3. Customer Portal (so users can self-serve cancels / plan switches)

In Dashboard → Settings → Billing → Customer Portal:

- Enable the portal
- **Allow customers to:**
  - Update payment methods: yes
  - Update billing address: yes
  - View invoice history: yes
  - Cancel subscriptions: yes (immediate, prorated)
  - Switch plans: yes — list all three V3Code products (Builder, Pro, Unlimited)
- Business information: V3Code (placeholder is fine for test mode)
- Branding: skip for now, we'll do it at launch

No env var needed — we redirect to the portal via the Stripe API at runtime.

---

## 4. API keys

From Dashboard → Developers → API keys (test mode):

```
STRIPE_SECRET_KEY=sk_test_...
```

Do **not** put the publishable key anywhere in the backend — we don't need it; checkout is server-driven.

---

## 5. Final env block to hand back

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BUILDER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_UNLIMITED=price_...
STRIPE_TRIAL_DAYS_BUILDER=7
STRIPE_TRIAL_DAYS_PRO=7
STRIPE_TRIAL_DAYS_UNLIMITED=0
```

---

## 6. Sanity checks (run these once products exist)

1. **Checkout works** — call `POST /billing/checkout` with `{ "tier": "builder" }` from an authed session, follow the URL, complete a card payment with `4242 4242 4242 4242`, confirm webhook fires and DB shows `tier='builder', subscription_status='trialing'`.
2. **Plan switch works** — in the customer portal, switch Builder → Pro, confirm webhook updates `tier='pro'`.
3. **Cancel works** — cancel via portal, confirm `tier='free'` after `customer.subscription.deleted` fires.
4. **Webhook signature verification** — try posting a junk body to `/billing/webhook` with a fake signature, should get 400.

---

## 7. What we are NOT doing right now (don't set up)

- Stripe Tax — defer until launch when we know jurisdictions
- Promo codes / coupons — defer
- One-time purchases — none, everything is subscription
- Usage-based billing / metered prices — no, we cap via quota table
- Multiple currencies — USD only for v1
- Annual prices — defer, monthly only

If anything in this spec is ambiguous, **ask before creating** — easier to set up clean than fix later.
