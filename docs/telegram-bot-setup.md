# Telegram bot setup

JobClock can pair one Telegram account with one JobClock account and import
public job links sent to a private bot conversation. Pairing tokens expire after
15 minutes and are consumed once.

## 1. Create the bot

1. Open a Telegram conversation with `@BotFather`.
2. Run `/newbot` and follow the prompts.
3. Choose the bot name and a username ending in `bot`.
4. Keep the returned bot token private. Do not commit it or send it in support
   messages.

The username, without the leading `@`, becomes `TELEGRAM_BOT_USERNAME`.

## 2. Generate a webhook secret

Generate a separate random value for Telegram's webhook header:

```bash
openssl rand -hex 32
```

Keep this value separate from `ENCRYPTION_SECRET`. Telegram accepts letters,
numbers, underscores, and hyphens for `secret_token`; hexadecimal output meets
that requirement.

## 3. Configure the environment

Add these server-side values to the local and deployed environments:

```dotenv
TELEGRAM_BOT_TOKEN=replace-with-the-token-from-botfather
TELEGRAM_BOT_USERNAME=replace-with-the-bot-username
TELEGRAM_WEBHOOK_SECRET=replace-with-the-random-webhook-secret
```

`ENCRYPTION_SECRET` must also be configured because Telegram user IDs and
pairing tokens are stored only as keyed digests. Do not prefix any Telegram
variable with `NEXT_PUBLIC_`.

## 4. Apply the database migration and deploy

Apply the Drizzle migration before enabling the webhook:

```bash
npm run db:migrate
```

Deploy the application with the three Telegram variables and the existing
JobClock, database, encryption, AI-provider, and optional QStash variables.
The public webhook is:

```text
POST https://YOUR_JOBLOCK_HOST/api/telegram/webhook
```

## 5. Register the production webhook

Export the production values in the shell, then call Telegram's `setWebhook`
method. This is an operator step; JobClock deliberately has no configuration
endpoint.

```bash
curl --request POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=https://YOUR_JOBLOCK_HOST/api/telegram/webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message"]'
```

Telegram must return an `ok: true` response. Register the webhook with the same
bot token represented by `TELEGRAM_BOT_USERNAME`; webhook updates are bound to
that bot token, and JobClock additionally verifies the secret header.

## 6. Pair a JobClock account

1. Sign in to JobClock.
2. Open **Settings → Telegram**.
3. Select **Connect Telegram**.
4. Select **Open Telegram and connect** before the link expires.
5. Select **Start** in the private bot conversation.
6. Wait for the bot's confirmation.

Pairing is required only once. Future job links do not include a token. Use
**Disconnect Telegram** in Settings before pairing a different Telegram
account.

## 7. Test a job import

Send or share one public `https://` job-listing URL to the private bot
conversation. The bot first acknowledges the import, then replies with the role,
company, and a JobClock application link. Sending the same resolved URL again
returns the already-saved application.

Pages that require a login, block automated access, are too large, or resolve
to a private network are rejected by the existing secure job-page fetcher.

## 8. Rotate or revoke credentials

- If the bot token is compromised, use BotFather's `/revoke` command, replace
  `TELEGRAM_BOT_TOKEN`, deploy, and register the webhook again with the new
  token.
- If the webhook secret is compromised, replace `TELEGRAM_WEBHOOK_SECRET`,
  deploy, and call `setWebhook` again with the new `secret_token`.
- To disable delivery immediately, call Telegram's `deleteWebhook` method or
  revoke the bot token in BotFather.
- Rotating `ENCRYPTION_SECRET` invalidates stored Telegram identity digests, so
  connected users must disconnect and pair again.

Never log or publish bot tokens, webhook secrets, pairing tokens, or full
Telegram user identifiers.
