# Connecting an AI agent (MCP)

JobClock exposes a small [Model Context Protocol](https://modelcontextprotocol.io) server at `POST /api/mcp`
(Streamable HTTP, stateless). An AI agent that can already read your email (for example Claude with a Gmail
connector) can use it to keep JobClock up to date: move applications between statuses, set follow-up dates,
record interview times and add notes. JobClock itself never reads your email.

## Connect Claude

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

- Tokens are random (256 bits), stored only as a SHA-256 hash, and tied to one user. Every query is filtered by that
  user's id; the agent can never name a different user.
- Authentication failures are rate limited per IP, and requests per user (60 per minute).
- Treat a token like a password: whoever holds it can read and edit your applications (including notes) until you revoke it.
- The agent reads your applications' notes, so anything it reads (including text from emails it summarises) may influence
  what it writes back. Review its changes in the Activity timeline.
