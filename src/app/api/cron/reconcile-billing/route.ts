import { NextRequest, NextResponse } from "next/server"
import { reconcileSubscriptions } from "@/lib/billing/reconcile"

// Called by Vercel Cron (see vercel.json) or manually with the secret header.
// POST /api/cron/reconcile-billing
// Header: Authorization: Bearer <CRON_SECRET>
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return NextResponse.json(await reconcileSubscriptions())
  } catch (err) {
    console.error("Billing reconciliation failed:", err)
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 })
  }
}

// Vercel Cron also supports GET for scheduled invocations
export async function GET(request: NextRequest) {
  return POST(request)
}
