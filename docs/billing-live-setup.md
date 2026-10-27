# Going live with billing: Stripe and Vercel checklist

Everything below was proven in the Stripe **sandbox** (see PR #152). Live mode is a separate Stripe environment, so each setting has to be repeated by hand. Work top to bottom, and keep `BILLING_ENABLED` off until step 7.

Design reference: `docs/superpowers/specs/2026-10-22-subscription-pricing-and-billing-design.md`.

## 1. Stripe account (live mode)
- [ ] Finish account activation: sole-trader details, bank account for payouts, support email and URL.
- [ ] Settings → Business → Public details: name **JobClock**, statement descriptor (for example `JOBCLOCK`), support email.
- [ ] Settings → Branding: logo and colours, so Checkout and the portal look like JobClock.
- [ ] Leave **Stripe Tax off** (not VAT-registered, prices are final). Revisit at £85,000 trailing-12-month turnover.

## 2. Product and prices
Create one product, **JobClock Pro**, with two recurring prices in GBP:
- [ ] £12.00 every month → copy its price ID into `STRIPE_PRO_MONTHLY_PRICE_ID`
- [ ] £120.00 every year → copy its price ID into `STRIPE_PRO_ANNUAL_PRICE_ID`

Credit packs need no Stripe product; the app creates them inline (50 credits for £4, 150 for £10).

## 3. Customer portal (Settings → Billing → Customer portal)
This is the setting that bit us in the sandbox; check every line.
- [ ] Customers can **update payment methods** and view **invoice history**.
- [ ] Customers can **update subscriptions**: allow switching between the two JobClock Pro prices (monthly and yearly).
- [ ] **Proration: "Prorate charges and credits", charge timing "Invoice prorations immediately at the time of the update".** Without it, switching to yearly shows about £228 due instead of £108.
- [ ] Customers can **cancel subscriptions**: cancel **at the end of the billing period**.
- [ ] Links to the terms (`/terms`) and privacy policy (`/privacy`) on the live domain.
- [ ] Save, then confirm it is the **default** configuration.

## 4. Webhook
- [ ] Developers → Webhooks → Add endpoint: `https://<production domain>/api/billing/webhook`
- [ ] Events to send:
  - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
  - `checkout.session.completed`, `checkout.session.async_payment_succeeded`
  - `invoice.paid`, `invoice.payment_failed`
- [ ] Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## 5. Restricted API key
- [ ] Developers → API keys → Create restricted key (live). Permissions: **Customers (write)**, **Checkout Sessions (write)**, **Customer portal (write)**, **Subscriptions (write)**, **Invoices (read)**.
- [ ] Subscriptions **write** is needed because Resume cancels the cancellation in place.
- [ ] Copy it into `STRIPE_RESTRICTED_KEY`. If any call later fails with "does not have the required permissions", Stripe's message names the exact permission to add.

## 6. Billing emails and retries
- [ ] Settings → Billing → Subscriptions and emails: send **successful payment receipts**, and **upcoming renewal reminders** (important for yearly renewals).
- [ ] Revenue recovery → retries: keep retries inside about 7 days, to match the app's 7-day grace period; after the last retry, mark the subscription **unpaid** or cancel it (both are handled).

## 7. Vercel production environment, then deploy
Existing production values (database, AI keys, `ENCRYPTION_SECRET`, `CRON_SECRET`) stay as they are.
- [ ] Confirm production `DATABASE_URL` points at the project that has migrations **0027 to 0030** (`make migrate` against it if unsure; 0030 is additive and safe).
- [ ] Add: `STRIPE_RESTRICTED_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`. Mark all as sensitive.
- [ ] Check `NEXT_PUBLIC_APP_URL` is the real production origin (used for Checkout and portal return links).
- [ ] Merge PR #152 and let the production deploy finish **with `BILLING_ENABLED` still false**.
- [ ] Set `BILLING_ENABLED=true` and redeploy. This flag only switches on the four billing API routes (checkout, portal, resume, credit packs). Until then they answer "Billing is not available", while the pricing page and Billing tab are still visible, so don't announce pricing before this step.

## 8. Live acceptance test with a real card
Use your own card; the cost is £12 and is refunded.
- [ ] Sign up with a fresh email and buy **monthly Pro**. Billing shows Pro, 300 credits, and the right renewal date.
- [ ] Developers → Webhooks: every delivery shows 200.
- [ ] Generate one CV, then confirm the credit count drops (6 credits for a CV).
- [ ] Buy the **50-credit pack** (£4) and confirm +50 extra credits.
- [ ] Cancel from Billing and check it shows "Cancels on …", then **Resume** and check it flips back.
- [ ] Refund both charges: `make refund-quote EMAIL=<test email>` gives the amount, then Stripe → Payments → the charge → Refund. Cancel the subscription afterwards.

## 9. Reconcile cron
- [ ] Vercel runs `GET /api/cron/reconcile-billing` daily at 04:00 (see `vercel.json`), using `CRON_SECRET`.
- [ ] Run it once by hand: `curl -X POST https://<production domain>/api/cron/reconcile-billing -H "Authorization: Bearer $CRON_SECRET"`. Expect `{"checked":N,"failed":0,...}` and an empty `duplicates` list.

## 10. Day to day
- **Refund:** `make refund-quote EMAIL=...`, then refund by hand in Stripe. Within 14 days: paid minus credits used at the per-credit price; after 14 days none, apart from legal exceptions or errors.
- **Free Pro for you or a tester:** `make grant-plan ARGS="you@example.com --kind=lifetime"` (dry run unless `--yes`). Applying to production needs `ALLOW_PRODUCTION=<project ref>` in front, otherwise the script refuses.
- **Roll back:** set `BILLING_ENABLED=false` and redeploy. New checkouts, portal links, Resume and credit packs stop working (pages stay visible and show an error). Existing subscribers stay subscribed in Stripe, and the webhook and reconcile cron keep their records correct.
- **Open questions:** selling outside the UK (tax route) and enabling promo codes are both deliberately off. See the spec's Launch Decisions.
