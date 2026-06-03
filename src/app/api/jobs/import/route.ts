import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"
import {
  JobImportError,
  jobImportHintsSchema,
  jobImportPreviewSchema,
  parseImportedJobPreview,
} from "@/lib/jobs/import-job"
import {
  findExistingApplicationByUrl,
  listRecentApplicationsForUser,
  persistJobForUser,
  updateApplicationStatusForUser,
} from "@/lib/jobs/persist-job"
import type { ApplicationStatus } from "@/lib/supabase/database.types"
import { authenticatePersonalApiToken, touchPersonalApiToken } from "@/lib/personal-api-tokens"

const previewRequestSchema = z.object({
  mode: z.literal("preview"),
  url: z.string().url(),
  pageTitle: z.string().trim().max(300).optional(),
  pageHints: jobImportHintsSchema.optional(),
  pageText: z.string().trim().min(1).max(200_000),
})

const saveRequestSchema = z.object({
  mode: z.literal("save"),
  preview: jobImportPreviewSchema,
})

const requestSchema = z.discriminatedUnion("mode", [previewRequestSchema, saveRequestSchema])

const IMPORT_RATE_LIMIT_WINDOW_MS = 60_000
const IMPORT_RATE_LIMIT_MAX_REQUESTS = 30

const importRequestCounts = new Map<string, { count: number; resetAt: number }>()

function getConfiguredOrigins(): Set<string> {
  return new Set(
    [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.APP_URL,
      process.env.EXTENSION_ALLOWED_ORIGINS,
    ]
      .filter(Boolean)
      .flatMap((value) => value!.split(","))
      .map((value) => value.trim().replace(/\/$/, ""))
      .filter(Boolean)
  )
}

function isAllowedOrigin(origin: string | null, requestOrigin: string): boolean {
  if (!origin) return true

  const normalizedOrigin = origin.replace(/\/$/, "")
  if (normalizedOrigin === requestOrigin) return true
  if (normalizedOrigin.startsWith("chrome-extension://")) return true

  return getConfiguredOrigins().has(normalizedOrigin)
}

function corsHeadersFor(request: NextRequest) {
  const origin = request.headers.get("origin")
  const requestOrigin = request.nextUrl.origin
  const allowOrigin = origin && isAllowedOrigin(origin, requestOrigin) ? origin : requestOrigin

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  }
}

function rateLimitToken(tokenId: string): boolean {
  const now = Date.now()
  const current = importRequestCounts.get(tokenId)

  if (!current || current.resetAt <= now) {
    importRequestCounts.set(tokenId, {
      count: 1,
      resetAt: now + IMPORT_RATE_LIMIT_WINDOW_MS,
    })
    return true
  }

  if (current.count >= IMPORT_RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  current.count += 1
  return true
}

const fallbackCorsHeaders = {
  "Access-Control-Allow-Origin": "null",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
}

function json(request: NextRequest, data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...corsHeadersFor(request),
      ...(init?.headers ?? {}),
    },
  })
}

async function authenticateRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
  if (!token) return null
  return authenticatePersonalApiToken(token)
}

export async function OPTIONS(request: NextRequest) {
  if (!isAllowedOrigin(request.headers.get("origin"), request.nextUrl.origin)) {
    return new NextResponse(null, {
      status: 403,
      headers: fallbackCorsHeaders,
    })
  }

  return new NextResponse(null, {
    status: 204,
    headers: corsHeadersFor(request),
  })
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth) return json(request, { error: "Unauthorized" }, { status: 401 })
  if (!rateLimitToken(auth.tokenId)) return json(request, { error: "Too many requests" }, { status: 429 })

  const limit = Math.min(
    10,
    Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "5", 10) || 5)
  )

  try {
    const recentApplications = await listRecentApplicationsForUser(
      auth.userId,
      request.nextUrl.origin,
      limit
    )
    await touchPersonalApiToken(auth.tokenId)

    return json(request, { recentApplications })
  } catch (error) {
    console.error("Recent applications error:", error)
    return json(request, { error: "Unexpected server error" }, { status: 500 })
  }
}

const updateStatusSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn", "ghosted"]),
})

export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth) return json(request, { error: "Unauthorized" }, { status: 401 })
  if (!rateLimitToken(auth.tokenId)) return json(request, { error: "Too many requests" }, { status: 429 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(request, { error: "Invalid request" }, { status: 400 })
  }

  const parsedBody = updateStatusSchema.safeParse(body)
  if (!parsedBody.success) {
    return json(request, { error: "Invalid request" }, { status: 400 })
  }

  try {
    const updated = await updateApplicationStatusForUser(
      auth.userId,
      parsedBody.data.applicationId,
      parsedBody.data.status as ApplicationStatus
    )

    if (!updated) {
      return json(request, { error: "Not found" }, { status: 404 })
    }

    const recentApplications = await listRecentApplicationsForUser(
      auth.userId,
      request.nextUrl.origin,
      5
    )
    await touchPersonalApiToken(auth.tokenId)

    return json(request, { success: true, recentApplications })
  } catch (error) {
    console.error("Status update error:", error)
    return json(request, { error: "Unexpected server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth) return json(request, { error: "Unauthorized" }, { status: 401 })
  if (!rateLimitToken(auth.tokenId)) return json(request, { error: "Too many requests" }, { status: 429 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(request, { error: "Invalid request" }, { status: 400 })
  }

  const parsedBody = requestSchema.safeParse(body)
  if (!parsedBody.success) {
    return json(request, { error: "Invalid request" }, { status: 400 })
  }

  try {
    if (parsedBody.data.mode === "preview") {
      const preview = await parseImportedJobPreview({
        userId: auth.userId,
        url: parsedBody.data.url,
        pageTitle: parsedBody.data.pageTitle,
        pageHints: parsedBody.data.pageHints,
        pageText: parsedBody.data.pageText,
      })
      const existingApplication = await findExistingApplicationByUrl(
        auth.userId,
        preview.url,
        request.nextUrl.origin
      )
      await touchPersonalApiToken(auth.tokenId)

      return json(request, {
        preview,
        alreadySaved: !!existingApplication,
        existingApplicationId: existingApplication?.applicationId ?? undefined,
        existingApplication: existingApplication ?? undefined,
      })
    }

    const result = await persistJobForUser(auth.userId, parsedBody.data.preview)
    await touchPersonalApiToken(auth.tokenId)

    return json(request, {
      success: true,
      alreadySaved: result.alreadySaved,
      applicationId: result.applicationId,
      applicationUrl: new URL(`/applications/${result.applicationId}`, request.nextUrl.origin).toString(),
    })
  } catch (error) {
    if (error instanceof JobImportError) {
      return json(request, { error: error.message }, { status: error.status })
    }

    console.error("Job import error:", error)
    return json(request, { error: "Unexpected server error" }, { status: 500 })
  }
}
