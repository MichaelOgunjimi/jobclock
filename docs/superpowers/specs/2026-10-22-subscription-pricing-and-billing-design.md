# Subscription Pricing and Billing Design

**Date:** 2026-10-22

**Status:** Proposed for implementation

**Scope:** Two-plan pricing, Stripe subscriptions, entitlements, hosted-AI allowances, and the changes required across JobClock

## Executive Decision

JobClock will launch with two plans only:

- **Free — £0 forever.** The complete core job-search workspace remains usable. AI generation requires the user's own OpenAI or Anthropic API key.
- **Pro — £12 monthly or £120 annually.** Everything in Free, plus 300 JobClock AI credits per billing month so AI generation works without the user supplying a provider key.

The annual price is the same Pro plan on a different billing cadence, not a third plan. It is equivalent to £10 per month and gives two months free compared with monthly billing.

JobClock must not sell “unlimited AI.” Pro has a visible credit allowance and a separate internal provider-cost ceiling. There are no overage charges at launch. When the allowance is exhausted, the user can wait for renewal or switch to their own API key.

This model preserves the current bring-your-own-key workflow, avoids taking features away from existing users, and gives Pro one clear value proposition: the app works out of the box without separate AI-provider billing.

## Goals

- Offer a simple paid upgrade with only one paid product.
- Keep the core application useful without payment.
- Make AI generation work for Pro users without asking them to obtain an API key.
- Keep AI-provider costs predictable even when model prices and request sizes vary.
- Preserve all existing BYOK behaviour and existing user data.
- Let users upgrade, manage billing, cancel, and return to Free without support intervention.
- Make Stripe webhooks, not browser redirects, authoritative for subscription access.
- Provide a complete, auditable record of subscription state and platform-funded AI usage.

## Non-Goals

- More than two plans, team accounts, seats, enterprise contracts, or lifetime pricing.
- Usage-based overage invoices.
- A prepaid credit shop or one-off credit purchases.
- Coupon, referral, affiliate, or gift-card systems at launch.
- A free Pro trial. The Free plan is the evaluation path and avoids trial abuse.
- Building a custom card-management or invoice interface; Stripe Customer Portal owns those tasks.
- Paywalling existing job tracking, CV storage, document storage, application history, exports, or BYOK generation.
- Building the About page. It is separate from subscription launch.

## Pricing

| | Free | Pro |
|---|---:|---:|
| Price | £0 | £12/month or £120/year |
| Core job search and application tracking | Included | Included |
| CVs, cover letters, profile evidence, interview prep, exports | Included | Included |
| AI with a personal OpenAI or Anthropic key | Included | Included |
| AI without a personal provider key | Not included | 300 JobClock AI credits per billing month |
| Premium AI models | Available with personal key | Available with personal key |
| Automatic generation on save | Available with personal key | Available with personal key or JobClock credits |
| Billing management | — | Stripe Customer Portal |

### Public Pricing Copy

Free:

> Organise your search, tailor applications, and prepare for interviews. Connect your own OpenAI or Anthropic key whenever you want AI generation.

Pro:

> Everything in Free, plus 300 JobClock AI credits each month. Generate tailored CVs, cover letters, research, and interview answers without setting up a separate AI account.

Required clarifier below the plan cards:

> No overage charges. If you use your monthly JobClock allowance, you can keep working with your own AI-provider key or wait for the allowance to renew.

Tax copy must remain “Taxes calculated at checkout” until the accountant-approved Stripe Tax configuration and price tax behaviour are confirmed. Do not claim that VAT is included before that decision is implemented and verified.

### Why £12 / £120

- £12 is high enough to fund payment fees, infrastructure, support, and a controlled hosted-AI allowance.
- £120 creates a meaningful annual commitment without creating a separate product tier.
- The annual discount is 16.7%, which is easy to communicate as two months free.
- A Free user can continue indefinitely with BYOK, so Pro does not need a trial.

Pricing should be reviewed after at least 30 paying customers or three complete billing cycles, whichever comes later. The review uses observed conversion, churn, actual AI cost per subscriber, and support load—not token-price estimates alone.

## AI Allowance

### User-Facing Credits

Pro includes **300 JobClock AI credits per billing month**. Credits reset at the start of the Stripe subscription period. They do not roll over, transfer, or have cash value.

Credits are charged per user-visible operation, not per underlying provider call:

| AI operation | Credits |
|---|---:|
| Import or extract one job | 1 |
| Extract one qualification/profile document | 2 |
| Parse and review one uploaded CV | 5 |
| Generate one application-chat reply | 2 |
| Generate or evaluate one interview answer | 2 |
| Generate interview preparation | 4 |
| Generate one cover letter | 4 |
| Generate company research | 6 |
| Tailor one CV | 10 |

One tailored CV remains 10 credits even though the current tailoring pipeline makes four provider calls. A QStash retry uses the original action identifier and must not charge credits twice.

The weights live in one server-only plan configuration module and may change for future billing periods. A completed action is always charged at the weight reserved when it started. Existing historical rows therefore remain understandable after pricing changes.

### Provider-Cost Safety Ceiling

Credits are the customer promise; the provider-cost ceiling is a private risk control. Each Pro billing period has a **$4.00 USD platform-AI cost ceiling** in addition to the 300-credit limit.

Before a platform-funded request starts, JobClock atomically reserves both:

- the operation's fixed credits; and
- a conservative estimated provider cost.

After the request finishes, JobClock commits the credits and replaces the estimated cost with the actual token/tool cost. On a failure, it releases the credit reservation. Any provider cost already incurred by a failed request remains in the internal cost total but does not consume customer credits.

If either ceiling would be exceeded, JobClock does not call the provider. The UI explains the limit and offers three actions: use a personal key, switch to a lower-cost workflow where applicable, or wait for renewal.

The $4 ceiling is intentionally not marketing copy. It protects gross margin from unusually long inputs, retries, tool calls, provider price changes, and exchange-rate movement. Alert thresholds are 50%, 75%, 90%, and 100% of the ceiling.

### Model Policy

Personal-key mode keeps the current exact provider/model picker and supports every model JobClock exposes:

- OpenAI: GPT-6.1 Sol, GPT-6 Astra, and GPT-6 Luna.
- Anthropic: Claude Sonnet 5.5, Claude Opus 5.5, Claude Fable 5.1, and Claude Haiku 5.5.

JobClock-funded mode uses automatic model routing:

- GPT-6 Luna or Claude Haiku for extraction, classification, and other high-volume structured tasks.
- GPT-6.1 Sol or Claude Sonnet for tailored documents, research synthesis, and substantive interview work.
- GPT-6 Astra, Claude Opus, and Claude Fable are personal-key only at launch.

The user may choose OpenAI, Anthropic, or Automatic as a provider preference in JobClock-funded mode, but may not force a premium model onto the platform account. Automatic is the default and lets JobClock choose the supported model for the operation.

Provider pricing is not assumed from brand alone. As of this specification, GPT-6.1 Sol and Claude Sonnet 5.5 both list $2 input / $10 output per million tokens, while GPT-6 Luna and Claude Haiku 5.5 both start at $0.10 / $0.50. Premium tiers differ. The routing and cost ledger therefore use a versioned price registry instead of a blanket “Claude costs more” rule.

### Billing Source Preference

Add one preference:

```ts
type AiBillingSource = "jobclock" | "personal"
```

- Free users are always resolved to `personal`.
- A new Pro subscriber with no personal key defaults to `jobclock`.
- A Pro subscriber who already has a personal key keeps `personal` until they explicitly switch, preventing a surprise change in model or quota behaviour.
- If `jobclock` becomes unavailable because of cancellation, payment failure, or allowance exhaustion, JobClock falls back to a configured personal key only after clearly telling the user. It never silently bills a provider key the user did not select.

## Entitlement Rules

Entitlements are computed server-side from the local subscription projection. The browser never decides whether a user is Pro or whether a platform key may be used.

| Local subscription state | App plan | Hosted AI | Notes |
|---|---|---|---|
| No subscription | Free | No | BYOK remains available |
| `active` | Pro | Yes, while allowance remains | Normal paid state |
| `trialing` | Pro | Yes | Supported by state mapping even though launch has no trial |
| `past_due` | Pro UI for 7 days | No | Keep data/features accessible; stop new platform cost immediately |
| `unpaid`, `paused`, `incomplete`, `incomplete_expired` | Free | No | Show billing recovery action where applicable |
| `canceled` | Free after paid-through period | No after paid-through period | Stripe normally leaves status active until period end when cancellation is scheduled |

`profiles.allow_platform_ai_key` remains a temporary staff/beta override so existing allowlisted users do not lose access during rollout. The entitlement rule is `active Pro OR explicit override`. The override is not exposed to customers, does not make an account Pro, and still uses the same credit and provider-cost controls once those controls ship.

### Upgrade, Downgrade, and Cancellation

- Upgrades start immediately after Stripe confirms payment.
- Monthly/annual cadence changes and cancellation are managed in Customer Portal.
- Cancellation is scheduled for the end of the paid period; access continues until then.
- A canceled or downgraded user keeps all data and returns to Free/BYOK behaviour.
- There is no automatic deletion, archival, or export restriction on downgrade.
- Refunds are not automated in the application. The refund policy and UK consumer-rights wording require legal/accounting review before launch.

## User Journeys

### Free User Upgrades

1. The user visits `/pricing` or the Billing tab in Settings.
2. They choose monthly or annual Pro.
3. `POST /api/billing/checkout` creates or reuses their Stripe Customer and creates a hosted Checkout Session for an allowlisted Price ID.
4. Checkout returns to `/settings?tab=billing&checkout=success`.
5. The return page shows “Confirming your subscription” until the webhook-updated local record is active.
6. Once active, the Billing tab shows Pro, renewal date, current allowance, and “Manage billing.”

The success redirect does not grant access by itself.

### Pro User Manages Billing

1. The user selects “Manage billing.”
2. `POST /api/billing/portal` creates a short-lived Customer Portal session.
3. The portal handles payment methods, invoices, cadence changes, and cancellation.
4. Webhooks update JobClock after every material change.

### Allowance Exhaustion

1. The server rejects the action before calling the provider.
2. The action returns a typed `ai_allowance_exhausted` error with reset date and current usage.
3. The UI keeps the user's inputs intact.
4. The UI links to AI Settings to use a personal key and to Billing to inspect the allowance.

### Failed Renewal

1. `invoice.payment_failed` marks hosted AI unavailable immediately and records a seven-day grace deadline for the Pro UI entitlement.
2. The app shows a persistent, dismissible billing-recovery banner linked to Customer Portal.
3. `invoice.paid` restores the active state and clears the grace deadline.
4. If the subscription becomes unpaid or canceled, the account resolves to Free. No user data is changed.

## Stripe Design

### Stripe Objects

- One Product: `JobClock Pro`.
- Two recurring Prices on that Product: GBP monthly and GBP yearly.
- One Stripe Customer per JobClock user, created lazily on the first checkout attempt.
- One active subscription per JobClock user.
- Hosted Stripe Checkout for purchase.
- Stripe Customer Portal for invoices, payment methods, cadence changes, and cancellation.

Separate Stripe sandboxes must be used for development/staging and production. Do not build a new integration in a shared test-mode account.

### Environment Configuration

```text
BILLING_ENABLED=false
STRIPE_RESTRICTED_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_ANNUAL_PRICE_ID=
```

Use a restricted Stripe key with only the resources needed for Customers, Checkout Sessions, Billing Portal Sessions, Subscriptions, Invoices, and webhook processing. Store all values as sensitive Vercel environment variables. A publishable key is not required for hosted Checkout and Portal redirects.

The implementation adds the official `stripe` Node package at the current supported version (`23.0.1` is installed), creates one server-only client instance, and pins Stripe API version `2026-09-30.endive`. It does not use the deprecated global API-key pattern, `plan`, or an explicit `payment_method_types` list. Dynamic payment methods remain managed in Stripe.

### Checkout Session

`POST /api/billing/checkout`:

- requires an authenticated user;
- validates the body against `monthly | annual` and maps it to server-owned Price IDs;
- creates and persists the Stripe Customer before creating Checkout;
- rejects a duplicate purchase when the local user already has an active subscription;
- sets `mode: "subscription"`;
- passes the existing Customer ID, one recurring Price, and quantity 1;
- enables promotion codes only when a separate launch decision explicitly turns them on;
- uses a success and cancel URL on the configured application origin;
- sets `client_reference_id` to the JobClock user ID for diagnostic correlation only;
- supplies Stripe's required `integration_identifier` with an eight-letter random suffix; and
- returns only the hosted Checkout URL.

The Price comes from the server allowlist, never from a client-provided arbitrary ID.

### Customer Portal

Configure one portal configuration for JobClock Pro:

- update payment methods;
- view/download invoices;
- switch monthly/annual cadence;
- cancel at period end; and
- return to `/settings?tab=billing`.

`POST /api/billing/portal` requires authentication and resolves the Customer ID from `billing_customers`. It never accepts a Customer ID from the browser.

### Webhook Endpoint

`POST /api/billing/webhook` reads the raw request body and verifies `Stripe-Signature` before parsing or performing any write.

Process at least:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `customer.subscription.created`;
- `customer.subscription.updated`;
- `customer.subscription.deleted`;
- `invoice.paid`; and
- `invoice.payment_failed`.

For Checkout completion, paid access is only granted when payment status is paid or no payment is required. The subscription events remain the canonical source for ongoing state.

Events are idempotent by Stripe Event ID. Webhook processing must tolerate duplicate delivery, delayed delivery, and out-of-order events. A stale event may be recorded as processed but must not overwrite a newer subscription projection. Compare Stripe object timestamps and, when necessary, fetch the current Subscription before updating local state.

Return `2xx` only after the event is durably recorded and the required local update succeeds. Do not put email, analytics, or other slow side effects on the webhook's critical path.

## Data Model

All new tables use first-class columns, not `profiles.preferences`. Money is stored as integer minor units or micro-USD; never as floating point. Stripe identifiers remain text.

### `billing_customers`

| Column | Type | Constraint |
|---|---|---|
| `user_id` | uuid | PK, FK `profiles.id`, cascade delete |
| `stripe_customer_id` | text | unique, not null |
| `created_at` | timestamptz | not null, default now |
| `updated_at` | timestamptz | not null, default now |

### `billing_subscriptions`

| Column | Type | Constraint |
|---|---|---|
| `user_id` | uuid | PK, FK `profiles.id`, cascade delete |
| `stripe_subscription_id` | text | unique, not null |
| `stripe_product_id` | text | not null |
| `stripe_price_id` | text | not null |
| `status` | text | not null; validated against supported Stripe statuses |
| `billing_interval` | text | `month | year` |
| `current_period_start` | timestamptz | not null |
| `current_period_end` | timestamptz | not null |
| `cancel_at_period_end` | boolean | not null, default false |
| `canceled_at` | timestamptz | nullable |
| `past_due_at` | timestamptz | nullable |
| `grace_ends_at` | timestamptz | nullable |
| `stripe_updated_at` | timestamptz | used to reject stale events |
| `created_at` / `updated_at` | timestamptz | not null |

### `billing_webhook_events`

| Column | Type | Constraint |
|---|---|---|
| `stripe_event_id` | text | PK |
| `type` | text | not null |
| `stripe_object_id` | text | nullable |
| `stripe_created_at` | timestamptz | not null |
| `processed_at` | timestamptz | nullable |
| `status` | text | `processing | processed | failed | ignored` |
| `error` | text | nullable; sanitized |
| `created_at` | timestamptz | not null, default now |

Do not persist the complete Stripe payload unless an actual debugging need is demonstrated; it creates unnecessary personal-data retention.

### `ai_usage_periods`

| Column | Type | Constraint |
|---|---|---|
| `user_id` | uuid | FK `profiles.id`, cascade delete |
| `period_start` | timestamptz | composite PK |
| `period_end` | timestamptz | not null |
| `credit_limit` | integer | not null |
| `credits_reserved` | integer | not null, default 0 |
| `credits_used` | integer | not null, default 0 |
| `cost_limit_microusd` | bigint | not null |
| `cost_reserved_microusd` | bigint | not null, default 0 |
| `cost_used_microusd` | bigint | not null, default 0 |
| `updated_at` | timestamptz | not null |

Primary key: `(user_id, period_start)`. Check constraints keep every counter non-negative and keep reserved + used at or below its configured limit.

### `ai_usage_actions`

| Column | Type | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `idempotency_key` | text | unique, not null |
| `user_id` | uuid | FK `profiles.id`, cascade delete |
| `period_start` | timestamptz | not null |
| `feature` | text | not null; validated application feature |
| `credential_source` | text | `personal | jobclock` |
| `status` | text | `reserved | completed | failed` |
| `credits` | integer | not null |
| `estimated_cost_microusd` | bigint | not null, default 0 |
| `actual_cost_microusd` | bigint | not null, default 0 |
| `input_tokens` / `cached_input_tokens` / `output_tokens` | bigint | not null, default 0 |
| `created_at` / `settled_at` | timestamptz | timestamps |

Personal-key actions may be recorded for product analytics with zero JobClock credits/cost, but the user can opt out of non-essential analytics. They never affect the Pro allowance.

### `ai_usage_events`

One row per provider call so a multi-stage action remains auditable.

| Column | Type | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `action_id` | uuid | FK `ai_usage_actions.id`, cascade delete |
| `provider_request_id` | text | nullable, unique when supplied |
| `provider` / `model` | text | not null |
| token counts | bigint | non-negative |
| `tool_cost_microusd` | bigint | non-negative |
| `total_cost_microusd` | bigint | non-negative |
| `price_version` | text | not null |
| `created_at` | timestamptz | not null |

### RLS and Access

- Enable RLS on every new public-schema table.
- Users may read their own subscription summary, allowance period, and usage actions.
- Users may not insert, update, or delete billing, webhook, or allowance rows through Supabase client APIs.
- `billing_customers` and `billing_webhook_events` have no client-readable policy.
- Server routes validate the authenticated user even when the database connection can bypass RLS.
- UPDATE policies, if any are later added, require both `USING` and `WITH CHECK` plus the corresponding SELECT policy.

The active migration system is Drizzle in `drizzle/migrations`; `supabase/legacy-migrations` is historical only. Generate the migration from `src/lib/db/schema.ts`, add any RLS/check-constraint SQL that Drizzle does not express, regenerate `src/lib/supabase/database.types.ts`, and run database advisors after applying it in the sandbox.

## Application Architecture

### Billing Modules

Add the smallest set of dedicated modules:

```text
src/lib/billing/plans.ts          plan IDs, credit weights, hosted model policy
src/lib/billing/stripe.ts         server-only Stripe client
src/lib/billing/entitlements.ts   subscription-to-entitlement mapping
src/lib/billing/usage.ts          reserve, settle, release, and summaries
src/app/api/billing/checkout/route.ts
src/app/api/billing/portal/route.ts
src/app/api/billing/webhook/route.ts
```

Do not introduce a generic billing framework or provider abstraction. Stripe is the only subscription provider in scope.

### AI Chokepoint

The current code exposes `resolveAiConfig`, `generateText`, and `generateTextWithWebSearch`, while many routes and generation handlers independently attach `allow_platform_ai_key`. Subscription enforcement must move into one server-side AI execution path so a new call site cannot accidentally bypass usage accounting.

The central path receives:

```ts
type AiActionRequest = {
  userId: string
  actionId: string
  feature: AiFeature
  preferences: UserPreferences | null
  system: string
  user: string
  maxTokens?: number
  webSearch?: boolean
}
```

It then:

1. resolves the requested billing source;
2. resolves the active entitlement;
3. chooses the provider/model under the relevant personal or hosted policy;
4. reserves credits and estimated cost only for JobClock-funded requests;
5. calls the provider;
6. captures token and tool usage from the provider response;
7. calculates cost using the versioned server price registry;
8. records each call and settles the action; and
9. returns the generated text without exposing a platform key.

The low-level provider adapters must return text plus normalized usage. They must not remain publicly callable from application routes after the migration.

### Existing Call Sites to Migrate

The implementation is incomplete until every current platform-key path uses the chokepoint:

- async generation handlers: CV tailoring, cover letters, company research, interview preparation, and interview answers;
- application chat;
- interview answer generation, discovery drafting, practice evaluation, and application interview evaluation;
- CV upload parsing/review;
- profile qualification-document extraction;
- job import/extraction;
- standalone CV review and parsing helpers; and
- any automatic generation triggered when saving a job.

The async `generation_jobs.id` is the stable AI action ID. Direct routes create a UUID action ID per accepted user operation and carry it through retries. Multi-stage CV tailoring records multiple provider events under one action and one credit charge.

### Automatic Generation

The existing preferences `auto_generate_cv_on_job_add` and `auto_generate_cover_letter_on_job_add` remain plan-agnostic:

- personal-key mode works on Free and Pro;
- JobClock-funded mode requires active Pro and enough remaining credits;
- each generated document uses its normal credit weight; and
- if credits are insufficient, the job import still succeeds and reports that automatic generation was skipped.

A quota failure must never roll back or delete a saved job.

## UI Changes

### `/pricing`

Add a public pricing page with two cards only, a monthly/annual cadence control, the plan matrix above, the no-overage explanation, and FAQ answers for API keys, credits, cancellation, and retained data.

When signed in:

- Free users see “Upgrade to Pro.”
- Pro users see “Current plan” and “Manage billing.”
- A signed-out checkout attempt redirects through authentication and returns to pricing.

### Settings → Billing

Add `billing` to the existing Settings tabs rather than creating a separate dashboard section. The tab shows:

- current plan and status;
- monthly or annual price;
- next renewal or cancellation date;
- credits used and remaining with reset date;
- a payment-recovery warning when relevant;
- “Upgrade to Pro” for Free; and
- “Manage billing” for Pro or recoverable subscriptions.

### Settings → AI

The AI tab gains a billing-source control:

- **JobClock allowance** — visible/enabled for active Pro or explicit beta override;
- **My provider key** — current provider/model/key controls.

In JobClock mode, show provider preference and automatic routing; do not show premium models as selectable. In personal-key mode, keep the current exact model picker.

### In-Flow States

- Near 80 credits used: non-blocking allowance warning.
- At 300 credits or internal ceiling: blocking message that preserves user input.
- Missing personal key on Free: current configure-key message plus a secondary “See Pro” action.
- Premium model selected without a matching personal key: explain that the model requires the user's own key.
- Checkout pending webhook: neutral pending state, never an optimistic Pro badge.

### Existing Copy to Update

The landing page and dashboard currently say the workspace is free and requires the user's own key. Update those statements so they remain true for Free while acknowledging Pro. Global search should add “Manage subscription” linking to `/settings?tab=billing`.

## Security and Privacy

- Verify Stripe signatures against the raw body before any parsing.
- Use a restricted Stripe secret and separate secrets for sandbox and production.
- Accept only server-defined Price IDs and redirect origins.
- Never expose platform OpenAI, Anthropic, or Stripe secret keys to the client.
- Do not authorize from Stripe metadata, email address, query parameters, or client-reported plan status.
- Rate-limit checkout, portal, and hosted-AI action creation.
- Make reservation and settlement atomic so concurrent requests cannot exceed allowance.
- Encrypt personal provider keys using the existing application mechanism; billing does not change key storage.
- Sanitize webhook errors and logs. Do not log provider keys, prompts, generated documents, payment details, or raw webhook payloads.
- Add payment processing and AI usage/accounting disclosures to Privacy and Terms before public launch.
- Configure a webhook IP allowlist as defense in depth only; signature verification remains mandatory.

## Tax and Legal Readiness

Before production sales:

- confirm the selling entity, business address, support contact, refund policy, and cancellation wording;
- confirm whether GBP prices are tax-inclusive or tax-exclusive for each target market;
- identify required tax registrations with an accountant;
- select the correct current Stripe product tax code from Stripe's canonical list;
- configure registrations independently in sandbox and live mode; and
- test invoices and Checkout for at least UK domestic, EU, and non-UK customer addresses.

Do not enable Stripe automatic tax before registrations are confirmed. Enabling it without an active registration can produce a zero-tax calculation and false confidence.

## Observability

Record structured, privacy-safe events for:

- checkout created, completed, canceled, and failed;
- portal session created;
- webhook received, processed, ignored, and failed;
- subscription state transitions;
- credit reservation, settlement, release, and rejection;
- provider/model/feature token and cost totals; and
- hosted-AI denials by reason.

Dashboard metrics:

- Free-to-Pro conversion;
- monthly versus annual mix;
- active, past-due, canceled, and recovered subscriptions;
- monthly recurring revenue and churn;
- average and p95 AI cost per Pro subscriber;
- credits used per feature; and
- gross margin after Stripe, AI, and hosting costs.

Alerts:

- webhook processing failures or events pending over five minutes;
- subscription state divergence found by reconciliation;
- AI cost above 75% or 100% of a user's ceiling;
- aggregate AI cost above the configured daily threshold; and
- unknown Stripe Price/Product IDs in a production event.

Add a daily reconciliation job that compares locally active subscriptions with Stripe and repairs drift. It should be safe to run repeatedly and should report, not silently ignore, unknown products or customers.

## Testing

### Unit Tests

- Price/cadence allowlist and plan configuration.
- Stripe-status-to-entitlement mapping, including past-due grace.
- Credit weights for every AI feature.
- Hosted model routing and premium-model rejection.
- Provider token/cached-token/tool-cost calculation for every supported model.
- Reservation, settlement, release, exhaustion, and concurrent reservation behaviour.
- Personal-key requests never consume JobClock credits.
- Multi-call CV tailoring charges one action.

### Route and Webhook Tests

- Checkout and Portal reject unauthenticated requests.
- Checkout rejects arbitrary Price IDs and duplicate active subscriptions.
- Portal never accepts a browser-supplied Customer ID.
- Webhook rejects invalid signatures.
- Duplicate events are idempotent.
- Older events cannot overwrite newer subscription state.
- Async Checkout grants access only after confirmed payment.
- Invoice failure disables hosted AI and invoice payment restores it.

### Integration Tests

- Stripe sandbox monthly upgrade, annual upgrade, cadence change, cancellation, payment failure, and recovery.
- Local subscription projection matches Stripe after each event.
- Pro hosted generation decrements the correct billing period.
- Renewal opens a new usage period without mutating the old one.
- Cancellation/downgrade preserves all user content.
- QStash retries do not double-charge credits.

### End-to-End Tests

- Free → Checkout → pending → Pro.
- Pro Billing tab → Portal → cancellation at period end.
- Pro user generates through JobClock allowance and sees the updated meter.
- Exhausted user switches to personal key and continues.
- Free user with personal key retains existing generation behaviour.

Use Stripe test clocks for renewal, failed-payment, grace-period, and cancellation timing. Run `make check` before each implementation commit and the relevant browser/Stripe sandbox flow before deployment.

## Development Plan

### Phase 0 — Commercial and Stripe Setup

1. Approve £12 monthly, £120 annual, 300 credits, and the fixed credit weights.
2. Complete tax/legal decisions.
3. Create dedicated Stripe sandbox and live accounts/configuration.
4. Create the Pro Product and monthly/yearly Prices.
5. Configure Customer Portal and webhook destinations.
6. Add environment variables with `BILLING_ENABLED=false`.

**Exit:** Product/Price IDs, tax behaviour, Portal configuration, and legal copy are approved in sandbox.

### Phase 1 — Database and Subscription Projection

1. Add the six tables and constraints to the Drizzle schema.
2. Generate the migration and add RLS policies.
3. Regenerate Supabase database types.
4. Add plan configuration and entitlement mapping.
5. Add unit tests for state transitions and constraints.

**Exit:** The app can derive Free/Pro/hosted-AI entitlement entirely from local records without changing current users.

### Phase 2 — Stripe Purchase and Management

1. Add the Stripe package and server client.
2. Implement Checkout, Portal, and verified webhook routes.
3. Implement idempotent event storage and stale-event protection.
4. Add the Billing Settings tab with pending/recovery states.
5. Complete sandbox integration tests.

**Exit:** A sandbox user can subscribe, manage, cancel, fail payment, recover, and see the correct local state.

### Phase 3 — Hosted-AI Accounting

1. Add the central AI action executor and normalized provider usage responses.
2. Implement atomic credit/cost reservation and settlement.
3. Migrate every AI call site listed above.
4. Add JobClock/personal billing-source controls and model-policy UI.
5. Test retries, multi-stage generation, concurrent requests, and allowance exhaustion.

**Exit:** No application route can use a platform provider key without entitlement and usage accounting.

### Phase 4 — Pricing and Launch Surface

1. Add `/pricing` and update landing/dashboard copy.
2. Add allowance banners, typed error states, and global-search entry.
3. Update Privacy and Terms.
4. Add billing and AI-cost monitoring.
5. Run accessibility, responsive, browser, and production-like sandbox verification.

**Exit:** The full user journey is clear before, during, and after payment.

### Phase 5 — Controlled Rollout

1. Deploy with billing disabled.
2. Apply and verify migrations.
3. Configure production Stripe webhook and secrets.
4. Enable staff accounts and reconcile existing `allow_platform_ai_key` users.
5. Enable billing for a small beta cohort.
6. Monitor conversion, webhook health, provider cost, failures, and support issues.
7. Enable public pricing after at least one complete monthly renewal test.

**Exit:** Public launch is reversible by hiding new checkout entry points while leaving existing subscriptions and webhooks operational.

## Acceptance Criteria

- Exactly two plans are presented: Free and Pro.
- Pro is purchasable monthly at £12 or annually at £120 in GBP.
- A Free user can use all current core features and can generate with a personal key.
- An active Pro user can generate without a personal key while allowance remains.
- Premium models use personal keys only.
- No user is charged an overage.
- Concurrent or retried AI operations cannot double-charge or exceed the allowance.
- A Checkout redirect alone cannot grant Pro.
- Duplicate or out-of-order Stripe events do not corrupt local state.
- Cancellation or payment failure never deletes or hides user data.
- Billing, Stripe Customer IDs, and usage counters cannot be mutated from the browser.
- Every platform-funded AI call has an attributable user, feature, provider/model, usage record, and cost.
- Existing `allow_platform_ai_key` users retain controlled access during migration.
- The app passes `make check`, route tests, migration verification, and the documented Stripe sandbox journeys.

## Launch Decisions

Resolved 2026-10-23. These are working defaults for launch; items 1-3 should be confirmed with an accountant before production sales.

1. **Selling entity:** a UK sole trader trading under the owner's name, with the Stripe account held in the same name. Move to a limited company later if needed.
2. **Tax:** assume annual turnover stays under the UK VAT registration threshold (GBP 90,000). JobClock is not VAT-registered and charges no VAT, so displayed prices are final. Stripe automatic tax stays off. Review at GBP 85,000 of trailing-12-month turnover.
3. **Territory:** launch for UK customers only. Selling digital services to EU consumers from outside the EU carries separate VAT obligations (EU OSS non-Union scheme), so non-UK sales are out of scope until an accountant has confirmed the position.
4. **Refunds and cancellation:** cancel any time from Settings -> Billing; access continues to the end of the paid period. A refund is offered within 14 days of purchase if fewer than 10 credits have been used. No other pro-rata refunds.
5. **Credit weights:** unchanged until measured. Only `cv_tailoring` has real data (about USD 0.075 per run, 10 credits, so roughly USD 0.0075 per credit against the USD 0.04 per-credit ceiling). Run one full application (import, CV, cover letter, research), re-run `make usage-report`, then set final weights and allowance. At current weights one application without interview prep is 21 credits, so Pro covers about 4 applications a month; this is likely too few for the price.
6. **Promotional codes:** disabled at launch. Beta users get a one-off 100% Stripe coupon applied by hand.

## Sources

- [OpenAI GPT-6.1 Sol model and pricing](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [Anthropic model pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Stripe subscription integration design](https://docs.stripe.com/billing/subscriptions/design-an-integration)
- [Stripe Customer Portal integration](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe sandboxes](https://docs.stripe.com/sandboxes)
- [Stripe Tax](https://docs.stripe.com/tax)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
