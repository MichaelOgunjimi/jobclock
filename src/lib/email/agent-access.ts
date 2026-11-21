import { describeAccess, describeExpiry } from "@/lib/mcp/access-policy"
import { sendEmail } from "./send"
import { agentAccessEmail } from "./templates"

/**
 * Tells the owner that a token was created or an app was connected, so a connection they did not make is noticed.
 * Transactional (no opt-out) and it never includes the token. Never throws: it runs after the action succeeded.
 */
export async function sendAgentAccessNotice(
  email: string | undefined,
  notice: { kind: "token" | "app"; name: string; scopes: readonly string[]; expiresAt: string | null; idempotencyKey?: string },
): Promise<boolean> {
  try {
    if (!email) return false
    const expiry = describeExpiry(notice.expiresAt, new Date(), notice.kind === "token" ? "It never expires" : "It stays connected until you revoke it")
    return await sendEmail({
      to: email,
      // An app chooses its own name, so keep it on one line.
      ...agentAccessEmail({ kind: notice.kind, name: notice.name.replace(/\s+/g, " ").trim(), access: describeAccess(notice.scopes), expires: expiry.text }),
      idempotencyKey: notice.idempotencyKey,
    })
  } catch (err) {
    console.error("[email/agent-access] failed:", err instanceof Error ? err.message : err)
    return false
  }
}
