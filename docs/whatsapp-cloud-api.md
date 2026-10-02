# WhatsApp Cloud API setup

JobClock uses Meta's WhatsApp Cloud API as a mobile job-intake channel. Users
pair once in **Settings → WhatsApp**, then send job links without including an
API token in each message.

## What the account owner needs

- A Meta developer account and a Meta Business portfolio.
- A Meta app with the WhatsApp product added.
- A WhatsApp business phone number. Meta's test number is sufficient for the
  first private test; use a production number before opening the bot to users.
- Permission to configure production environment variables and apply the
  JobClock database migration.

Meta's dashboard and labels change periodically. Use the current
[WhatsApp Cloud API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
and the **API Setup** screen inside the app as the source of truth.

## 1. Create the Meta app

1. Open [Meta for Developers](https://developers.facebook.com/apps/) and create
   a Business app, or use an existing suitable app.
2. Add the **WhatsApp** product.
3. In **WhatsApp → API Setup**, note the phone number ID and test business
   number. Add your personal number as an allowed recipient for initial tests.
4. Copy the app secret from the app's basic settings.
5. Use the temporary access token for the first test. Before production, follow
   Meta's current guidance to provision an appropriate non-temporary token with
   WhatsApp messaging access.
6. Note the Graph API version shown by the current documentation/dashboard.
   JobClock requires this value explicitly so an API-version change is an
   intentional deployment change.

## 2. Configure JobClock secrets

Generate a webhook verification token. This is a private random value you
choose; it is not the Meta access token.

```bash
openssl rand -hex 32
```

Add these server-side variables to the JobClock deployment:

```dotenv
WHATSAPP_APP_SECRET=<Meta app secret>
WHATSAPP_VERIFY_TOKEN=<the random webhook token you generated>
WHATSAPP_ACCESS_TOKEN=<Meta access token>
WHATSAPP_PHONE_NUMBER_ID=<phone number ID from API Setup>
WHATSAPP_GRAPH_API_VERSION=<current version, for example vXX.X>
WHATSAPP_BUSINESS_NUMBER=<full international number, digits only>
```

`ENCRYPTION_SECRET` and `NEXT_PUBLIC_APP_URL` must also be configured. Keep all
WhatsApp credentials server-side; none use the `NEXT_PUBLIC_` prefix.

QStash is strongly recommended in production because job extraction can take
longer than a webhook request. Configure `QSTASH_TOKEN`,
`QSTASH_CURRENT_SIGNING_KEY`, and `QSTASH_NEXT_SIGNING_KEY`. Local development
falls back to Next.js post-response work when QStash is absent.

## 3. Apply and deploy

Apply the new Drizzle migration, then deploy the application:

```bash
npm run db:migrate
npm test
npm run build
```

The public callback URL is:

```text
https://<your-jobclock-domain>/api/whatsapp/webhook
```

## 4. Configure the webhook

1. In the Meta app's WhatsApp webhook configuration, set the callback URL to
   the public URL above.
2. Enter the exact value of `WHATSAPP_VERIFY_TOKEN` in Meta's **Verify token**
   field.
3. Complete verification. JobClock returns Meta's `hub.challenge` only when the
   token matches.
4. Subscribe the WhatsApp business account to the `messages` webhook field.

Incoming POST payloads are accepted only when the `X-Hub-Signature-256` header
matches an HMAC produced with `WHATSAPP_APP_SECRET`.

## 5. Pair and test

1. Sign in to JobClock and open **Settings → WhatsApp**.
2. Select **Connect WhatsApp** and then **Open WhatsApp and connect**.
3. Send the prepared pairing message. The bot should confirm the connection.
4. Send a public job-listing URL.
5. Confirm that WhatsApp returns the extracted role and a JobClock application
   link, and that only one application exists if the same URL is sent again.
6. Test **Disconnect WhatsApp**, generate another code, and reconnect.

Some job sites require a logged-in browser or block server-side access. The bot
reports these imports as unreadable instead of saving fabricated details. The
Chrome extension remains the fallback for those pages.

## Security and operational notes

- Pairing codes expire after 15 minutes and are deleted when consumed.
- One WhatsApp sender can be connected to only one JobClock user, and each user
  can have only one connected WhatsApp sender.
- The full sender ID is not stored. JobClock stores an HMAC digest for lookup
  and the final four digits for display.
- Meta webhook message IDs are recorded to make webhook retries idempotent.
- User-controlled URLs are limited to HTTP(S), custom ports and credentials are
  rejected, DNS targets are checked for private addresses, redirects are
  revalidated, and response size is capped.
- Rotate a leaked Meta access token or app secret immediately. Changing
  `ENCRYPTION_SECRET` also changes WhatsApp identity digests, so existing users
  must pair again after such a rotation.

