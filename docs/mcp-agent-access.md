# Connecting an AI agent (MCP)

JobClock exposes a small [Model Context Protocol](https://modelcontextprotocol.io) server at `POST /api/mcp`
(Streamable HTTP, stateless). An AI agent that can already read your email (for example Claude with a Gmail
connector) can use it to keep JobClock up to date: move applications between statuses, set follow-up dates,
record interview times and add notes. JobClock itself never reads your email.

## Connect with OAuth (recommended: no token to copy)

1. In Claude (or any MCP client that supports remote servers and OAuth) add a custom connector / MCP server with the URL
   `https://<your-jobclock-host>/api/mcp`. Leave any token or client-id fields empty. In Claude Code:
   `claude mcp add --transport http jobclock https://<your-jobclock-host>/api/mcp`, then `/mcp` -> authenticate.
2. Your browser opens a JobClock page. Sign in if you are not already, check the app name and the address it will return you to,
   and choose what to allow:
   - **Read your applications** (`applications:read`, always on): list and view applications and see what is due.
   - **Make changes** (`applications:write`, **off by default**, you must tick it): change status, set follow-ups and interview times, add notes.
3. Tap **Allow**. The app is connected. **Deny** sends the app back with `access_denied` and shares nothing.

A read-only connection does not see the write tools at all. To change an app's permissions, revoke it under
**Settings -> AI Agent -> Connected apps** (which shows each app, its permission, when it connected and was last used) and connect again.
Revoking ends both its access and refresh tokens immediately.

### What the server implements

| Piece | Where |
| --- | --- |
| Protected resource metadata (RFC 9728) | `/.well-known/oauth-protected-resource/api/mcp`; an unauthenticated `POST /api/mcp` answers `401` with `WWW-Authenticate: Bearer realm="jobclock", resource_metadata="..."` |
| Authorization server metadata (RFC 8414) | `/.well-known/oauth-authorization-server` |
| Dynamic client registration (RFC 7591), public clients | `POST /api/oauth/register` (https or loopback `http` redirect URIs only; 10 per minute per IP) |
| Authorization (code flow, **PKCE S256 required**, `resource` bound, `state` and `iss` returned) | `/oauth/authorize` (consent page) |
| Token: `authorization_code` and rotating `refresh_token` | `POST /api/oauth/token` |
| Revocation (RFC 7009) | `POST /api/oauth/revoke` |

- Authorization codes are single use and expire after 60 seconds. Access tokens (`jat_...`) last 1 hour. Refresh tokens
  (`jrt_...`) are single use and rotate on every refresh; presenting a used one revokes the whole connection. Codes and tokens are
  stored only as SHA-256 hashes.
- The redirect URI sent to `/oauth/authorize` must exactly equal one registered by the client; JobClock never redirects anywhere else.
- Tokens are bound to the `https://<host>/api/mcp` resource and are rejected anywhere else.
- Existing `jc_` access tokens keep working unchanged and always have full read and write access.
- Expired codes, tokens and old revoked connections are removed daily by `/api/cron/prune-oauth` (needs `CRON_SECRET`, like the other crons).

### Self-hosting

The OAuth server lives inside the app (nothing depends on Supabase's OAuth server or a hosted provider). It needs:

- `NEXT_PUBLIC_APP_URL`: the public origin (e.g. `https://jobs.example.com`, no path). The issuer, every endpoint URL in the
  metadata and the MCP resource identifier are derived from it. It must be the URL the MCP client actually uses.
- The migration `0036_mcp_oauth.sql` (four `oauth_*` tables, RLS on, no policies; read only over the server-side database connection).
- Redis (`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) for the rate limits, as for the rest of the app.
- Supabase auth, which only tells the consent page who is signed in.
- HTTPS in front of the app, since remote MCP clients require it. `/oauth/*` is served with `frame-ancestors 'none'`.

## Connect with a token

1. In JobClock open **Settings -> AI Agent**, name a token (e.g. "Claude on my laptop") and click **Create token**.
   Copy it immediately: it starts with `jc_` and is shown once.
2. Add the server to Claude Code:

   ```sh
   claude mcp add --transport http jobclock https://<your-jobclock-host>/api/mcp \
     --header "Authorization: Bearer jc_YOUR_TOKEN"
   ```

   Any MCP client that supports Streamable HTTP and custom headers works the same way: URL
   `https://<your-jobclock-host>/api/mcp`, header `Authorization: Bearer jc_...`.
3. Ask the agent to go through your inbox and update JobClock, e.g. "Check my unread job emails, update the matching
   applications in JobClock and set follow-ups where a reply is due."

Revoke a token from the same screen at any time; it stops working immediately.

## Tools

Write tools are only available to a `jc_` token or an OAuth connection that was granted **Make changes**.

| Tool | Kind | What it does |
| --- | --- | --- |
| `list_applications` | read | Filter by `status`, `overdue_follow_ups`, `search` (title, company, notes), `limit` (max 50). |
| `get_application` | read | One application with status history, notes, follow-up, `interview_at` and recent activity. |
| `list_due` | read | Overdue follow-ups, follow-ups and interviews in the next `days` (default 7). |
| `update_application_status` | write | Same transition rules and status history as the web app. `intent`: `progress` (default), `correction`, `reopen`. |
| `set_follow_up` | write | Set or clear the follow-up date (ISO timestamp with timezone) and/or note. |
| `set_interview_time` | write | Set or clear `interview_at` (ISO timestamp with timezone). Does not change the status. |
| `add_note` | write | Append a dated note. Never overwrites existing notes. |

Write tools return `before` and `after` so a change can be reversed, and each one adds an entry to the application's
Activity timeline tagged `source: "mcp"`. There are no delete, billing or AI-credit tools.

## Security model

- Tokens (`jc_` and OAuth) are random (256 bits), stored only as a SHA-256 hash, and tied to one user. Every query is filtered by that
  user's id; the agent can never name a different user.
- Authentication failures are rate limited per IP, and requests per user (60 per minute).
- Treat a token like a password: whoever holds it can read and edit your applications (including notes) until you revoke it.
- The agent reads your applications' notes, so anything it reads (including text from emails it summarises) may influence
  what it writes back. Review its changes in the Activity timeline.
