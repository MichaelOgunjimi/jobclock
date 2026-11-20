# Connecting an AI agent (MCP)

JobClock exposes a small [Model Context Protocol](https://modelcontextprotocol.io) server at `POST /api/mcp`
(Streamable HTTP, stateless). An AI agent that can already read your email (for example Claude with a Gmail
connector) can use it to keep JobClock up to date: move applications between statuses, set follow-up dates,
record interview times and add notes. Another agent that finds jobs for you can also add them (see
[Adding jobs found by another agent](#adding-jobs-found-by-another-agent)). JobClock itself never reads your email.

## Connect with OAuth (recommended: no token to copy)

1. In Claude (or any MCP client that supports remote servers and OAuth) add a custom connector / MCP server with the URL
   `https://<your-jobclock-host>/api/mcp`. Leave any token or client-id fields empty. In Claude Code:
   `claude mcp add --transport http jobclock https://<your-jobclock-host>/api/mcp`, then `/mcp` -> authenticate.
2. Your browser opens a JobClock page. Sign in if you are not already, check the app name and the address it will return you to,
   and choose what to allow:
   - **Read your applications** (`applications:read`, always on): list and view applications and see what is due.
   - **Make changes** (`applications:write`, **off by default**, you must tick it): change status, set follow-ups and interview times, add notes, add new saved jobs.
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
- **Limits.** At most 20 jobs per batch call and about 100 KB per request, the 60 requests per minute that apply to every tool, and **100 new applications per user per rolling 24 hours** through the agent connection.

## Security model

- Tokens (`jc_` and OAuth) are random (256 bits), stored only as a SHA-256 hash, and tied to one user. Every query is filtered by that
  user's id; the agent can never name a different user.
- Authentication failures are rate limited per IP, and requests per user (60 per minute).
- Treat a token like a password: whoever holds it can read and edit your applications (including notes) until you revoke it.
- `get_job_preferences` is meant to be handed to a job-finding agent, so it returns only roles, locations, salary floor, experience levels, UK right to work and a skills and
  experience summary. It never includes your name, email, phone, address, links, AI keys or billing data.
- The agent reads your applications' notes, so anything it reads (including text from emails it summarises) may influence
  what it writes back. Review its changes in the Activity timeline.
