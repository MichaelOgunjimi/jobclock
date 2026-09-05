import "server-only"

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications } from "@/lib/db/schema"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ResolvedApplicationRoute {
  id: string
  slug: string
}

export async function resolveApplicationRoute(
  userId: string,
  routeKey: string,
): Promise<ResolvedApplicationRoute | null> {
  const lookup = UUID_PATTERN.test(routeKey)
    ? eq(applications.id, routeKey)
    : eq(applications.slug, routeKey)

  const [application] = await db
    .select({ id: applications.id, slug: applications.slug })
    .from(applications)
    .where(and(eq(applications.userId, userId), lookup))
    .limit(1)

  return application ?? null
}
