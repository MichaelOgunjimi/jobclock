import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { sendEmail } from "./send"
import { welcomeEmail } from "./templates"

/**
 * Sends the one-time welcome email. The claim on profiles.welcome_sent_at is a single atomic update, so two
 * sign-ins at once cannot both send it; the claim is given back if the provider refuses, so a later sign-in retries.
 * Never throws: it runs next to login and must not break it.
 */
export async function sendWelcomeEmail(userId: string, email: string | undefined): Promise<boolean> {
  try {
    if (!email) return false
    const claimed = await db
      .update(profiles)
      .set({ welcomeSentAt: new Date() })
      .where(and(eq(profiles.id, userId), isNull(profiles.welcomeSentAt)))
      .returning({ id: profiles.id })
    if (claimed.length === 0) return false

    const sent = await sendEmail({ to: email, ...welcomeEmail(), idempotencyKey: `welcome/${userId}` })
    if (!sent) await db.update(profiles).set({ welcomeSentAt: null }).where(eq(profiles.id, userId))
    return sent
  } catch (err) {
    console.error("[email/welcome] failed:", err instanceof Error ? err.message : err)
    return false
  }
}
