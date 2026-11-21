import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { profiles, userCvs } from "@/lib/db/schema"
import { withPlatformAiKeyAccess, type UserPreferences } from "@/lib/ai"
import { runAiAction } from "@/lib/ai/action"
import { reviewCv } from "@/lib/ai/cv-review"
import { normalizeCvData } from "@/lib/cv-data"
import type { CvData, Json } from "@/lib/supabase/database.types"

/**
 * The same steps as POST /api/cv/[id]/review (one metered `cv_review` action over the saved CV, then the findings replace
 * the stored ones), for callers that have no browser session: the MCP review_cv tool. `actionId` is the billing
 * idempotency key, so a repeated key is refused by runAiAction instead of being charged twice.
 * Returns null when the CV is not this user's.
 */
export async function reviewSavedCvForUser(input: { userId: string; cvId: string; actionId: string }) {
  const [cv] = await db
    .select({ parsedJson: userCvs.parsedJson })
    .from(userCvs)
    .where(and(eq(userCvs.id, input.cvId), eq(userCvs.userId, input.userId)))
    .limit(1)
  if (!cv) return null

  const [profile] = await db
    .select({ preferences: profiles.preferences, allowPlatformAiKey: profiles.allowPlatformAiKey })
    .from(profiles)
    .where(eq(profiles.id, input.userId))
    .limit(1)
  const preferences = withPlatformAiKeyAccess((profile?.preferences ?? {}) as UserPreferences, profile?.allowPlatformAiKey === true)

  const cvData = normalizeCvData(cv.parsedJson as CvData | null)
  const findings = await runAiAction(
    { userId: input.userId, actionId: input.actionId, feature: "cv_review", preferences },
    (ai) => reviewCv(cvData, ai),
  )
  await db
    .update(userCvs)
    .set({ reviewFindings: findings as unknown as Json })
    .where(and(eq(userCvs.id, input.cvId), eq(userCvs.userId, input.userId)))
  return { findings }
}
