import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod/v4"
import { SCOPE_READ, SCOPE_WRITE } from "@/lib/oauth/config"
import { APPLICATION_STATUSES } from "@/lib/applications/status-transitions"
import {
  addNote,
  getApplication,
  listApplications,
  listDue,
  setFollowUp,
  setInterviewTime,
  updateApplicationStatus,
  type ToolOutcome,
} from "./tools"

const applicationId = z.uuid().describe("The application id, from list_applications or list_due.")
const status = z.enum(APPLICATION_STATUSES)
// An offset is required so "5pm" can never silently be read in the server's timezone.
const timestamp = z.iso.datetime({ offset: true }).describe("ISO 8601 timestamp with a timezone, e.g. 2026-12-01T14:30:00+00:00.")

function respond(outcome: ToolOutcome): CallToolResult {
  if ("error" in outcome) return { isError: true, content: [{ type: "text", text: outcome.error }] }
  return { content: [{ type: "text", text: JSON.stringify(outcome.data) }] }
}

/**
 * A fresh server per request (stateless). Every tool is bound to the token owner's userId. Write tools are only
 * registered when the credential carries the write scope (a `jc_` token is full access), so a read-only OAuth
 * grant cannot list or call them.
 */
export function createMcpServer(userId: string, scopes: readonly string[] = [SCOPE_READ, SCOPE_WRITE]): McpServer {
  const canWrite = scopes.includes(SCOPE_WRITE)
  const server = new McpServer(
    { name: "jobclock", version: "1.0.0" },
    canWrite ? undefined : { instructions: "This connection is read-only: it can list and view applications but cannot change them. To allow changes, remove the connection in JobClock (Settings -> AI Agent) and connect again with write access ticked." },
  )

  server.registerTool("list_applications", {
    description: "List the user's job applications, newest activity first. Filter by status, by overdue follow-ups, or by text in the title, company or notes.",
    inputSchema: {
      status: status.optional(),
      overdue_follow_ups: z.boolean().optional().describe("Only applications whose follow-up date has passed and that still wait on a reply."),
      search: z.string().trim().max(100).optional(),
      limit: z.number().int().min(1).max(50).default(20),
    },
    annotations: { readOnlyHint: true },
  }, async ({ status, overdue_follow_ups, search, limit }) =>
    respond(await listApplications(userId, { status, overdueFollowUps: overdue_follow_ups, search, limit })))

  server.registerTool("get_application", {
    description: "Full details of one application: status, status history, notes, follow-up date and note, interview time and recent activity.",
    inputSchema: { application_id: applicationId },
    annotations: { readOnlyHint: true },
  }, async ({ application_id }) => respond(await getApplication(userId, application_id)))

  if (canWrite) registerWriteTools(server, userId)

  server.registerTool("list_due", {
    description: "What needs attention: overdue follow-ups, follow-ups due within the next N days, and interviews within the next N days.",
    inputSchema: { days: z.number().int().min(0).max(60).default(7) },
    annotations: { readOnlyHint: true },
  }, async ({ days }) => respond(await listDue(userId, days)))

  return server
}

function registerWriteTools(server: McpServer, userId: string) {
  server.registerTool("update_application_status", {
    description: "Change an application's status the same way the web app does (records status history and an activity entry). "
      + "Use intent \"progress\" (default) to move forward or to rejected/withdrawn/ghosted, \"correction\" to move backward or between outcomes, \"reopen\" to reopen a closed application. "
      + "Returns the status before and after.",
    inputSchema: {
      application_id: applicationId,
      status,
      intent: z.enum(["progress", "correction", "reopen"]).default("progress"),
    },
  }, async ({ application_id, status, intent }) => respond(await updateApplicationStatus(userId, application_id, status, intent)))

  server.registerTool("set_follow_up", {
    description: "Set or clear when to follow up on an application, and optionally the reminder note. Omit a field to leave it unchanged; pass null to clear it. Returns before and after.",
    inputSchema: {
      application_id: applicationId,
      follow_up_due_at: timestamp.nullable().optional(),
      note: z.string().trim().max(1000).nullable().optional(),
    },
  }, async ({ application_id, follow_up_due_at, note }) =>
    respond(await setFollowUp(userId, application_id, { dueAt: follow_up_due_at, note })))

  server.registerTool("set_interview_time", {
    description: "Set or clear the interview time (interview_at). Does not change the status; call update_application_status for that. Returns before and after.",
    inputSchema: { application_id: applicationId, interview_at: timestamp.nullable() },
  }, async ({ application_id, interview_at }) => respond(await setInterviewTime(userId, application_id, interview_at)))

  server.registerTool("add_note", {
    description: "Append a dated note to an application's notes. Existing notes are never overwritten.",
    inputSchema: { application_id: applicationId, note: z.string().trim().min(1).max(2000) },
  }, async ({ application_id, note }) => respond(await addNote(userId, application_id, note)))
}
