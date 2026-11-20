import { ACCESS_TOKEN_TTL_SECONDS, AUTHORIZATION_CODE_TTL_MS, MAX_CLIENT_NAME_LENGTH, MAX_REDIRECT_URIS, MAX_REGISTRATION_BODY_BYTES, REFRESH_TOKEN_TTL_MS } from "@/lib/oauth/config"

/**
 * Every limit in the MCP endpoint and the OAuth server, in one place. The numbers are used by the code that enforces
 * them, the Settings -> AI Agent "Limits" section is built from LIMITS, and docs/mcp-agent-access.md has the same table
 * (a test keeps the two in step), so a limit can never exist without a stated reason.
 */

/** Requests per minute per account. Raised from 60: an agent triaging a full inbox easily makes more than one call a second. */
export const MCP_REQUESTS_PER_MINUTE = 120
export const MCP_AUTH_FAILURES_PER_MINUTE = 20
/** Sized for the largest legitimate call: a batch of 20 jobs with 20,000-character descriptions is about 400 KB. */
export const MCP_MAX_BODY_BYTES = 1_000_000
export const MAX_BATCH_JOBS = 20
/** What a new token or connection starts with. The owner can change it per token or connection; 0 means unlimited. */
export const DEFAULT_DAILY_CREATE_CAP = 100
export const MAX_DAILY_CREATE_CAP = 1_000_000
/** An application with the same company and title created this recently is reported as a possible duplicate. */
export const DUPLICATE_WINDOW_DAYS = 90
export const MAX_DESCRIPTION_CHARS = 20_000
export const OAUTH_REGISTRATIONS_PER_MINUTE = 10
export const OAUTH_TOKEN_REQUESTS_PER_MINUTE = 30
export const OAUTH_TOKEN_BODY_BYTES = 10_000

const DOCS = "the Limits table in docs/mcp-agent-access.md"

/** The text of an error for a limit that only the server operator can change. It says what the limit is, why it exists and how to change it. */
export function limitMessage(what: string, why: string, change = `This limit is fixed in the JobClock server code (src/lib/mcp/limits.ts), not a setting in your account; see ${DOCS}.`) {
  return `${what}. ${why} ${change}`
}

/** For a text field over its length limit (used as the validation message, so an agent sees what the limit is, why, and that it is fixed). */
export const tooLong = (field: string, max: number) =>
  limitMessage(`${field} is longer than the ${max.toLocaleString("en-GB")}-character limit`, "JobClock stores short text in this field so one posting cannot bloat the owner's list. Shorten it and try again.")

/** For a number over its limit. */
export const tooBig = (field: string, max: number, why: string) => limitMessage(`${field} is above the limit of ${max.toLocaleString("en-GB")}`, why)

export type LimitStatus = "kept" | "raised" | "removed" | "owner-editable" | "owner-chosen"

export interface LimitInfo {
  /** Also the first column of the docs table, so keep it unique and exact. */
  name: string
  value: string
  reason: string
  status: LimitStatus
  /** Affects the owner (shown in Settings), as opposed to protecting the server from the internet. */
  owner: boolean
}

const days = (ms: number) => `${Math.round(ms / 86_400_000)} days`

export const LIMITS: LimitInfo[] = [
  { name: "Daily new applications", value: `${DEFAULT_DAILY_CREATE_CAP} per connection per rolling 24 hours (0 = unlimited)`, reason: "A safety net against an agent that loops and floods your list. Set per token or connected app, so you decide.", status: "owner-editable", owner: true },
  { name: "Requests per minute", value: `${MCP_REQUESTS_PER_MINUTE} per account`, reason: "Stops a runaway agent loop from hammering the database. Raised from 60 so a full inbox run is not slowed down.", status: "raised", owner: true },
  { name: "Jobs per batch call", value: `${MAX_BATCH_JOBS}`, reason: "Keeps one add_applications call inside the server's time limit and its per-job results readable. Send several calls for more.", status: "kept", owner: true },
  { name: "Request size", value: `${MCP_MAX_BODY_BYTES / 1_000_000} MB per request`, reason: "Raised from 100 KB. Fits the largest legitimate batch (20 jobs at full description length is about 400 KB) and rejects anything absurd.", status: "raised", owner: true },
  { name: "Stored text length", value: `Title, company, location 200; URL 2,000; note 2,000; follow-up note 1,000; search text 100; token name 60; description ${MAX_DESCRIPTION_CHARS.toLocaleString("en-GB")}`, reason: "Keeps one posting from bloating your list and notes. A longer description is cut to the limit (and flagged); the other fields are rejected with a message.", status: "kept", owner: true },
  { name: "Duplicate window", value: `${DUPLICATE_WINDOW_DAYS} days`, reason: "The same company and title added within this time is reported as a possible duplicate instead of created twice. Pass allow_duplicate to add it anyway.", status: "kept", owner: true },
  { name: "Results per call", value: "list_applications 50, list_due 50 per section, due window 60 days, notes read back 8,000 characters", reason: "Keeps replies small enough for an agent to read. Filter or search to see more.", status: "kept", owner: true },
  { name: "Status changes per batch call", value: "25 (update_application_statuses)", reason: "Each change writes history and audit rows in one request, so a batch is kept inside the server's time limit. Send the rest in another call.", status: "kept", owner: true },
  { name: "Snooze length", value: "1 to 365 days (snooze_follow_up)", reason: "A follow-up more than a year away is almost always a typo. Use an explicit date for a deliberate later one.", status: "kept", owner: true },
  { name: "Company research text", value: "12,000 characters returned (get_company_research)", reason: "Keeps one reply small enough for an agent to read. Longer text is cut and flagged as truncated; the full text stays in JobClock.", status: "kept", owner: true },
  { name: "Stale and activity list size", value: "50 per call (list_stale_applications, get_application_activity; deadlines and interviews list at most 50)", reason: "Keeps replies readable. Ask for fewer or narrow the question; the web app shows everything.", status: "kept", owner: true },
  { name: "Token expiry", value: "7 days, 30 days, 90 days, 1 year or never; you choose per token (default 90 days)", reason: "A forgotten token stops working by itself. Tokens created before this setting never expire.", status: "owner-chosen", owner: true },
  { name: "Connected app period", value: "30 days, 90 days, 1 year or until you revoke; you choose when you connect (default 30 days)", reason: "Caps how long a connected app can keep refreshing. A connection that is not used for 30 days also ends.", status: "owner-chosen", owner: true },
  { name: "Batch payload size", value: "no separate limit (was 100,000 characters)", reason: "Removed: the request size limit already bounds it, and the old figure rejected a legitimate batch of 20 long descriptions.", status: "removed", owner: true },
  { name: "Active tokens per account", value: "no limit (was 10)", reason: "Removed: tokens are only created by you, signed in, so a cap protected nothing.", status: "removed", owner: true },
  { name: "Failed sign-ins per IP", value: `${MCP_AUTH_FAILURES_PER_MINUTE} per minute`, reason: "Defends the public endpoint against token guessing and database hammering.", status: "kept", owner: false },
  { name: "Client registrations per IP", value: `${OAUTH_REGISTRATIONS_PER_MINUTE} per minute`, reason: "Anyone on the internet can register an app, and each registration writes a row.", status: "kept", owner: false },
  { name: "OAuth token requests per IP", value: `${OAUTH_TOKEN_REQUESTS_PER_MINUTE} per minute`, reason: "Blunts guessing of authorization codes and refresh tokens.", status: "kept", owner: false },
  { name: "Registration size", value: `Body ${MAX_REGISTRATION_BODY_BYTES / 1000} KB, name ${MAX_CLIENT_NAME_LENGTH} characters, ${MAX_REDIRECT_URIS} redirect URIs of 2,000 characters, state 1,000 characters; token requests ${OAUTH_TOKEN_BODY_BYTES / 1000} KB`, reason: "Public endpoints without a sign-in: small bodies keep abuse cheap to reject.", status: "kept", owner: false },
  { name: "Authorization code lifetime", value: `${AUTHORIZATION_CODE_TTL_MS / 1000} seconds, single use`, reason: "A code is only needed for the moment between approving and the app exchanging it.", status: "kept", owner: false },
  { name: "Access token lifetime", value: `${ACCESS_TOKEN_TTL_SECONDS / 3600} hour`, reason: "A leaked access token is useful for at most an hour; the app refreshes it automatically.", status: "kept", owner: false },
  { name: "Refresh token lifetime", value: `${days(REFRESH_TOKEN_TTL_MS)} since last use, single use, rotating`, reason: "An app that has not been used for a month has to be connected again; reuse of an old token revokes the connection.", status: "kept", owner: false },
  { name: "Cleanup", value: "Codes 1 day after they expire; connections 30 days after they were revoked, or over 31 days old once their tokens have expired; manual tokens 30 days after they expired; unused app registrations after 90 days", reason: "Deleted daily so the tables stay small. Nothing active is ever removed.", status: "kept", owner: false },
]
