import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  await db.execute(sql`SELECT 1`)

  return Response.json({ ok: true, ts: new Date().toISOString() })
}
