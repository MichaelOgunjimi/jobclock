import { NextRequest } from "next/server"
import { pruneOAuth } from "@/lib/oauth/tokens"

export const runtime = "nodejs"

async function prune(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    return Response.json({ ok: true, deleted: await pruneOAuth() })
  } catch (err) {
    console.error("[cron/prune-oauth] error:", err)
    return Response.json({ error: "Internal error" }, { status: 500 })
  }
}

// Vercel Cron calls GET; POST is for manual runs, like the other cron routes.
export const GET = prune
export const POST = prune
