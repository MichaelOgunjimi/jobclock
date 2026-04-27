import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNotNull, ne, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { jobsCache } from "@/lib/db/schema"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [companiesResult, locationsResult] = await Promise.all([
    db
      .selectDistinct({ company: jobsCache.company })
      .from(jobsCache)
      .where(ne(jobsCache.company, ""))
      .orderBy(asc(jobsCache.company))
      .limit(100),
    db
      .selectDistinct({ location: jobsCache.location })
      .from(jobsCache)
      .where(isNotNull(jobsCache.location))
      .orderBy(asc(jobsCache.location))
      .limit(100),
  ])

  return NextResponse.json({
    companies: companiesResult.map((r) => r.company),
    locations: locationsResult.map((r) => r.location).filter(Boolean),
  })
}
