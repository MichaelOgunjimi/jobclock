# Connecting an AI agent (MCP)

JobClock exposes a small [Model Context Protocol](https://modelcontextprotocol.io) server at `POST /api/mcp`
(Streamable HTTP, stateless). An AI agent that can already read your email (for example Claude with a Gmail
connector) can use it to keep JobClock up to date: move applications between statuses, set follow-up dates,
record interview times and add notes. Another agent that finds jobs for you can also add them (see
[Adding jobs found by another agent](#adding-jobs-found-by-another-agent)). JobClock itself never reads your email.

The production server is **`https://jobclock.dev/api/mcp`**. (Self-hosting? Use your own `NEXT_PUBLIC_APP_URL` followed by `/api/mcp`
everywhere this page says `jobclock.dev`; Settings -> AI Agent always shows the exact URL for the site you are on.)

## Connect with OAuth (recommended: no token to copy)

1. In Claude (or any MCP client that supports remote servers and OAuth) add a custom connector / MCP server with the URL
   `https://jobclock.dev/api/mcp`. Leave any token or client-id fields empty. In Claude Code:
   `claude mcp add --transport http jobclock https://jobclock.dev/api/mcp`, then `/mcp` -> authenticate.
2. Your browser opens a JobClock page. Sign in if you are not already, check the app name and the address it will return you to,
   and choose what to allow:
   - **Read your applications** (`applications:read`, always on): list and view applications and see what is due.
   - **Make changes** (`applications:write`, **off by default**, you must tick it): change status, set follow-ups and interview times, add notes, add new saved jobs.
   - **Keep me connected for**: 30 days (default), 90 days, 1 year or until you revoke it. This is the hard end of the connection: it caps how long
     the app can keep refreshing its access. Whatever you choose, a connection that is not used for 30 days also ends (the refresh token's idle window).
3. Tap **Allow**. The app is connected, and JobClock emails you a notice (the app's name, what it may do and when it ends; never a code or token). **Deny** sends the app back with `access_denied` and shares nothing.

A read-only connection does not see the write tools at all. To change an app's permissions, revoke it under
**Settings -> AI Agent -> Connected apps** (which shows each app, its permission, when it ends, when it connected and was last used, its daily limit and its recent activity) and connect again.
Revoking ends both its access and refresh tokens immediately. When the period you chose ends, the app's next refresh is refused with a message telling it to connect again.

### What the server implements

| Piece | Where |
| --- | --- |
| Protected resource metadata (RFC 9728) | `/.well-known/oauth-protected-resource/api/mcp`; an unauthenticated `POST /api/mcp` answers `401` with `WWW-Authenticate: Bearer realm="jobclock", resource_metadata="..."` |
| Authorization server metadata (RFC 8414) | `/.well-known/oauth-authorization-server` |
| Dynamic client registration (RFC 7591), public clients | `POST /api/oauth/register` (https or loopback `http` redirect URIs only; rate limited, see [Limits](#limits)) |
| Authorization (code flow, **PKCE S256 required**, `resource` bound, `state` and `iss` returned) | `/oauth/authorize` (consent page) |
| Token: `authorization_code` and rotating `refresh_token` | `POST /api/oauth/token` |
| Revocation (RFC 7009) | `POST /api/oauth/revoke` |

- Authorization codes are single use and expire after 60 seconds. Access tokens (`jat_...`) last 1 hour. Refresh tokens
  (`jrt_...`) last 30 days from their last use, are single use and rotate on every refresh (never past the end of the period you chose);
  presenting a used one revokes the whole connection. Codes and tokens are stored only as SHA-256 hashes.
- The redirect URI sent to `/oauth/authorize` must exactly equal one registered by the client; JobClock never redirects anywhere else.
- Tokens are bound to the `https://jobclock.dev/api/mcp` resource (your own `NEXT_PUBLIC_APP_URL` when self-hosting) and are rejected anywhere else.
- `jc_` tokens created before the scope and expiry choices existed (migration `0037`) keep full read and write access and never expire; you can revoke them any time.
- Expired codes and tokens, old revoked connections and manual tokens that expired over 30 days ago are removed daily by `/api/cron/prune-oauth` (needs `CRON_SECRET`, like the other crons).

### Self-hosting

The OAuth server lives inside the app (nothing depends on Supabase's OAuth server or a hosted provider). It needs:

- `NEXT_PUBLIC_APP_URL`: the public origin (e.g. `https://jobs.example.com`, no path). The issuer, every endpoint URL in the
  metadata and the MCP resource identifier are derived from it. It must be the URL the MCP client actually uses.
- The migrations `0036_mcp_oauth.sql` (four `oauth_*` tables, RLS on, no policies; read only over the server-side database connection) and `0037_mcp_access_controls.sql` (scope, expiry and daily-limit columns; RLS unchanged).
- Redis (`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) for the rate limits, as for the rest of the app.
- Supabase auth, which only tells the consent page who is signed in.
- HTTPS in front of the app, since remote MCP clients require it. `/oauth/*` is served with `frame-ancestors 'none'`.

## Connect with a token

1. In JobClock open **Settings -> AI Agent**, name a token (e.g. "Claude on my laptop"), choose its **Access** and when it **Expires**, and click **Create token**.
   - **Access**: *Read only* (the default: list and view, duplicate checks, job preferences) or *Read + changes* (also status, follow-ups, interview times, notes, add jobs). The server enforces it exactly like an OAuth grant: a read-only token does not even see the write tools, and a write call is rejected.
   - **Expires**: 7 days, 30 days, **90 days (default)**, 1 year or never. A custom date is not offered.
   Copy the token immediately: it starts with `jc_` and is shown once. JobClock emails you a notice that a token was created (its name, access and expiry; never the token).
2. Add the server to Claude Code. Settings shows this command with your real token filled in once it is created; the only part to replace by hand is the token itself, if you build the command yourself:

   ```sh
   claude mcp add --transport http jobclock https://jobclock.dev/api/mcp \
     --header "Authorization: Bearer jc_YOUR_TOKEN"
   ```

   Any MCP client that supports Streamable HTTP and custom headers works the same way: URL
   `https://jobclock.dev/api/mcp`, header `Authorization: Bearer ` followed by the token.
3. Ask the agent to go through your inbox and update JobClock, e.g. "Check my unread job emails, update the matching
   applications in JobClock and set follow-ups where a reply is due."

Each token in the list shows its access, its expiry ("Expires 11 Feb 2027 (in 83 days)", "Never expires" or a red **Expired** badge), when it was last used, its daily limit for new applications and its recent activity.
Revoke a token from the same screen at any time; it stops working immediately. A token that has expired gets `401` with a message saying when it expired and how to get a new one, not a generic "invalid token".
Tokens created before these choices existed have full access and never expire.

## What each connection did, and notices

- **Recent activity.** Under every token and connected app in Settings -> AI Agent, *Recent activity* lists the last 10 changes it made: the tool
  (`add_application`, `update_application_status`, `set_follow_up`, `set_interview_time`, `add_note`), the application and the time. Changes made through the
  agent already appear in each application's Activity timeline tagged `source: "mcp"`; they now also record which token or connected app made them
  (`connectionKind` and `connectionId` in the event's metadata). Only **changes** are recorded (reads leave no trace), and events from before this was
  added carry no connection, so they are not attributed to anyone.
- **Security notices.** JobClock emails you when a token is created and when you approve an app on the consent page: the name, what it may do and when it ends.
  These are transactional (no unsubscribe) and never contain a token or code. If you did not do it, revoke the token or app in Settings -> AI Agent.

## Limits

Every limit in the MCP endpoint and the OAuth server, and why it exists. The first block is what affects you as the owner (it is also shown in
Settings -> AI Agent -> Limits); the second protects the public endpoints and cannot be changed in the app. When an agent hits one, the error it
receives says which limit it was, why it exists and how to change it (a setting in Settings, or "fixed server limit" with a pointer here).
The numbers live in one file, `src/lib/mcp/limits.ts`; a self-hoster changes a fixed limit there.

| Limit | Value | Why | Status |
| --- | --- | --- | --- |
| Daily new applications | 100 per connection per rolling 24 hours (0 = unlimited) | A safety net against an agent that loops and floods your list. Set per token or connected app, so you decide. | Yours to change (Settings) |
| Requests per minute | 120 per account | Stops a runaway agent loop from hammering the database. Raised from 60 so a full inbox run is not slowed down. | Raised |
| Jobs per batch call | 20 | Keeps one add_applications call inside the server's time limit and its per-job results readable. Send several calls for more. | Kept |
| Request size | 1 MB per request | Raised from 100 KB. Fits the largest legitimate batch (20 jobs at full description length is about 400 KB) and rejects anything absurd. | Raised |
| Stored text length | Title, company, location 200; URL 2,000; note 2,000; follow-up note 1,000; search text 100; token name 60; description 20,000 | Keeps one posting from bloating your list and notes. A longer description is cut to the limit (and flagged); the other fields are rejected with a message. | Kept |
| Duplicate window | 90 days | The same company and title added within this time is reported as a possible duplicate instead of created twice. Pass allow_duplicate to add it anyway. | Kept |
| Results per call | list_applications 50, list_due 50 per section, due window 60 days, notes read back 8,000 characters | Keeps replies small enough for an agent to read. Filter or search to see more. | Kept |
| Status changes per batch call | 25 (update_application_statuses) | Each change writes history and audit rows in one request, so a batch is kept inside the server's time limit. Send the rest in another call. | Kept |
| Snooze length | 1 to 365 days (snooze_follow_up) | A follow-up more than a year away is almost always a typo. Use an explicit date for a deliberate later one. | Kept |
| Company research text | 12,000 characters returned (get_company_research) | Keeps one reply small enough for an agent to read. Longer text is cut and flagged as truncated; the full text stays in JobClock. | Kept |
| Stale and activity list size | 50 per call (list_stale_applications, get_application_activity; deadlines and interviews list at most 50) | Keeps replies readable. Ask for fewer or narrow the question; the web app shows everything. | Kept |
| Token expiry | 7 days, 30 days, 90 days, 1 year or never; you choose per token (default 90 days) | A forgotten token stops working by itself. Tokens created before this setting never expire. | Your choice (Settings) |
| Connected app period | 30 days, 90 days, 1 year or until you revoke; you choose when you connect (default 30 days) | Caps how long a connected app can keep refreshing. A connection that is not used for 30 days also ends. | Your choice (Settings) |
| Batch payload size | no separate limit (was 100,000 characters) | Removed: the request size limit already bounds it, and the old figure rejected a legitimate batch of 20 long descriptions. | Removed |
| Active tokens per account | no limit (was 10) | Removed: tokens are only created by you, signed in, so a cap protected nothing. | Removed |

Protecting the public endpoints (kept; these defend an internet-facing server, so they are not settings):

| Limit | Value | Why | Status |
| --- | --- | --- | --- |
| Failed sign-ins per IP | 20 per minute | Defends the public endpoint against token guessing and database hammering. | Kept |
| Client registrations per IP | 10 per minute | Anyone on the internet can register an app, and each registration writes a row. | Kept |
| OAuth token requests per IP | 30 per minute | Blunts guessing of authorization codes and refresh tokens. | Kept |
| Registration size | Body 10 KB, name 100 characters, 5 redirect URIs of 2,000 characters, state 1,000 characters; token requests 10 KB | Public endpoints without a sign-in: small bodies keep abuse cheap to reject. | Kept |
| Authorization code lifetime | 60 seconds, single use | A code is only needed for the moment between approving and the app exchanging it. | Kept |
| Access token lifetime | 1 hour | A leaked access token is useful for at most an hour; the app refreshes it automatically. | Kept |
| Refresh token lifetime | 30 days since last use, single use, rotating | An app that has not been used for a month has to be connected again; reuse of an old token revokes the connection. | Kept |
| Cleanup | Codes 1 day after they expire; connections 30 days after they were revoked, or over 31 days old once their tokens have expired; manual tokens 30 days after they expired; unused app registrations after 90 days | Deleted daily so the tables stay small. Nothing active is ever removed. | Kept |

## Tools

Write tools are only available to a `jc_` token created as *Read + changes* (or created before the choice existed) or an OAuth connection that was granted **Make changes**.

| Tool | Kind | What it does |
| --- | --- | --- |
| `list_applications` | read | Filter by `status`, `overdue_follow_ups`, `search` (title, company, notes), `limit` (max 50). |
| `get_application` | read | One application with status history, notes, follow-up, `interview_at` and recent activity. |
| `list_due` | read | Overdue follow-ups, follow-ups and interviews in the next `days` (default 7). |
| `update_application_status` | write | Same transition rules and status history as the web app. `intent`: `progress` (default), `correction`, `reopen`. |
| `set_follow_up` | write | Set or clear the follow-up date (ISO timestamp with timezone) and/or note. |
| `set_interview_time` | write | Set or clear `interview_at` (ISO timestamp with timezone). Does not change the status. |
| `add_note` | write | Append a dated note. Never overwrites existing notes. |
| `check_job_exists` | read | Does the user already have this job? By `url` (tracking parameters, fragment, trailing slash, host case and `http` vs `https` are ignored) and/or `company` + `title`. Returns the matching applications with id and status, so jobs already saved, applied to or rejected can be skipped. |
| `get_job_preferences` | read | What the owner is looking for: `desired_roles`, `locations`, `target_salary_min`, `experience_levels`, `right_to_work_uk`, and a short `cv` summary (headline, summary, skills, recent roles, education, languages, certifications) from the primary CV. Never contact details or the CV's name, and anything the owner has not entered is left out. |
| `add_application` | write | Save a job a finding agent supplies, as a `saved` application. Required: `url` (http/https only), `title`, `company`. Optional: `location`, `description` (stored up to 20,000 characters), `salary_min`/`salary_max`/`salary_currency`, `posted_at`, `apply_deadline` (`YYYY-MM-DD`), `remote`, `remote_type`, `source` (e.g. `linkedin`, default `mcp`), `note` (why it suits the owner), `follow_up_due_at`, `allow_duplicate`. |
| `add_applications` | write | The same for up to 20 jobs in one call. One result per job (`created`, duplicate with the existing id, or `error`); a failing job does not stop the others. Counts as one request. |
| `get_pipeline_summary` | read | The weekly digest's numbers: counts by status, saved/applied this week, `response_rate_percent`, plus overdue follow-ups, interviews in the next 7 days, stale applications and saved jobs with a deadline within 2 days. |
| `list_stale_applications` | read | What the stale-application email lists: applied or screening with no status change for 21 days or more, oldest first. `limit` (max 50). |
| `list_upcoming_deadlines` | read | What the deadline email warns about: saved jobs whose apply deadline is after today and at most 2 days away. |
| `list_upcoming_interviews` | read | Interviews in the next `days` (default 7; `1` matches the interview email's "tomorrow"). |
| `get_application_activity` | read | Recent activity for one application with `source` (`mcp` or `web`) per entry. Note text is never included, only its length. `limit` (max 50). |
| `get_company_research` | read | The research the owner already saved for an application (cut at 12,000 characters, with `truncated`). Never generates research. |
| `get_credits` | read | Monthly AI allowance (limit, used, remaining, reset date) and purchased credits. Read only. |
| `list_cvs` | read | `id`, name, `is_primary`, `created_at` of each CV. No contact details or CV text. |
| `update_application_statuses` | write | Up to 25 status changes in one call, same rules and `intent` as `update_application_status`. One result per item; a failing item does not stop the others. |
| `snooze_follow_up` | write | Push the follow-up out by `days` (1-365, counted from the current date or from now if overdue) or to a future `until` timestamp. |
| `complete_follow_up` | write | Clear the follow-up date and reminder note (the follow-up card's Clear button). |
| `update_application_details` | write | Edit `title`, `company`, `location`, `salary` with the web app's validation; `null` goes back to the posting's own value. Not status, ids or anything billing or AI related. |
| `undo_last_change` | write | Reverts the newest agent change (status, follow-up date, interview time, title, company, location, salary) from its recorded before values. Refuses if that field changed since, and cannot restore note text. Call again to step back further. |

Write tools return `before` and `after` so a change can be reversed, and each one adds an entry to the application's
Activity timeline tagged `source: "mcp"`. There are no delete, billing or AI-credit tools.

### Adding jobs found by another agent

A job-finding agent connects with write access, then for each candidate:

1. `get_job_preferences`: judge whether the job suits the owner (roles, locations, salary floor, experience level, skills). The app does
   not record remote preference, industries, excluded companies or visa status beyond UK right to work, so the response says so: ask the owner instead of guessing.
2. `check_job_exists` with the `url` (and `company` + `title`): skip it if the owner already has it, whatever its status.
3. `add_application` (or `add_applications` for a batch) with the fields it found and a short `note` saying why it fits. The application is
   created as `saved`, exactly as an extension import would create it.
4. The owner reviews the new `saved` applications in JobClock and decides what to do. The agent cannot apply, delete or start AI generation.

`add_application` behaviour worth knowing:

- **Duplicates.** If the owner already has the same URL, nothing is created and the response is `created: false, duplicate: "url"` with the existing application.
  If the same company and title was added in the last 90 days, the response is `created: false, duplicate: "company_and_title"` with a hint; pass `allow_duplicate: true` to add it anyway.
- **No fetching, no AI.** JobClock never opens the URL; the agent supplies the fields. Adding a job never starts CV or cover letter generation, even if the owner has "generate on job add" switched on, and never uses AI credits.
- **Stored as data.** Text from a posting is untrusted. It is cleaned (control, zero-width and bidirectional-override characters removed), length-limited
  (title, company and location 200 characters, note 2,000, description 20,000) and stored as plain text, never followed as an instruction.
  The URL is stored without tracking parameters and fragment. An existing cached copy of the same posting is never overwritten.
- **Limits.** See [Limits](#limits): jobs per batch, request size, requests per minute, and a daily limit on new applications that you set per token or connected app (default 100, 0 = unlimited).

## Security model

- Tokens (`jc_` and OAuth) are random (256 bits), stored only as a SHA-256 hash, and tied to one user. Every query is filtered by that
  user's id; the agent can never name a different user.
- Authentication failures are rate limited per IP, and requests per user (see [Limits](#limits)).
- Treat a token like a password: whoever holds it can do what its access allows with your applications (including notes) until it expires or you revoke it. Prefer read-only tokens, and a short expiry.
- `get_job_preferences` is meant to be handed to a job-finding agent, so it returns only roles, locations, salary floor, experience levels, UK right to work and a skills and
  experience summary. It never includes your name, email, phone, address, links, AI keys or billing data.
- The agent reads your applications' notes, so anything it reads (including text from emails it summarises) may influence
  what it writes back. Review its changes in the Activity timeline.
