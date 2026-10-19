import { and, asc, eq, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { interviewProfileFacts } from "@/lib/db/schema"

export interface ConfirmedProfileFact {
  category: string
  label: string
  detail: string
}

export function formatConfirmedProfileEvidence(facts: ConfirmedProfileFact[]): string {
  return facts
    .slice(0, 80)
    .map((fact) => `- [${fact.category}] ${fact.label}: ${fact.detail}`)
    .join("\n")
    .slice(0, 20_000)
}

export async function loadConfirmedProfileFacts(userId: string): Promise<ConfirmedProfileFact[]> {
  return db
    .select({
      category: interviewProfileFacts.category,
      label: interviewProfileFacts.label,
      detail: interviewProfileFacts.detail,
    })
    .from(interviewProfileFacts)
    .where(
      and(
        eq(interviewProfileFacts.userId, userId),
        isNotNull(interviewProfileFacts.confirmedAt),
      ),
    )
    .orderBy(asc(interviewProfileFacts.category), asc(interviewProfileFacts.createdAt))
}
