import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { z } from "zod/v4"

vi.mock("@/lib/personal-api-tokens", () => ({
  authenticatePersonalApiToken: vi.fn(),
  touchPersonalApiToken: vi.fn(),
}))
vi.mock("@/lib/jobs/import-job", () => ({
  JobImportError: class JobImportError extends Error {
    status: number

    constructor(message: string, status = 422) {
      super(message)
      this.status = status
    }
  },
  jobImportPreviewSchema: z.object({
    url: z.string().url(),
    source: z.string(),
    title: z.string(),
    company: z.string(),
    location: z.string().nullable(),
    description: z.string().nullable(),
    salaryMin: z.number().nullable(),
    salaryMax: z.number().nullable(),
    salaryCurrency: z.string().nullable(),
    postedAt: z.string().nullable(),
    isEasyApply: z.boolean().nullable(),
  }),
  jobImportHintsSchema: z.object({
    title: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    salaryText: z.string().nullable().optional(),
    metadata: z.array(z.string()).optional(),
  }),
  parseImportedJobPreview: vi.fn(),
}))
vi.mock("@/lib/jobs/persist-job", () => ({
  findExistingApplicationByUrl: vi.fn(),
  listRecentApplicationsForUser: vi.fn(),
  persistJobForUser: vi.fn(),
  updateApplicationStatusForUser: vi.fn(),
}))

import { authenticatePersonalApiToken, touchPersonalApiToken } from "@/lib/personal-api-tokens"
import { JobImportError, parseImportedJobPreview } from "@/lib/jobs/import-job"
import {
  findExistingApplicationByUrl,
  listRecentApplicationsForUser,
  persistJobForUser,
  updateApplicationStatusForUser,
} from "@/lib/jobs/persist-job"
import { GET, OPTIONS, PATCH, POST } from "./route"

function createRequest(body: unknown, token = "test-token") {
  return new NextRequest("https://app.example.com/api/jobs/import", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function createGetRequest(token = "test-token", query = "") {
  return new NextRequest(`https://app.example.com/api/jobs/import${query}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
}

function createPatchRequest(body: unknown, token = "test-token") {
  return new NextRequest("https://app.example.com/api/jobs/import", {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

describe("POST /api/jobs/import", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authenticatePersonalApiToken).mockResolvedValue({
      tokenId: "token-1",
      userId: "user-1",
    })
  })

  it("returns 401 for missing or invalid bearer token", async () => {
    vi.mocked(authenticatePersonalApiToken).mockResolvedValueOnce(null)
    const response = await POST(createRequest({ mode: "preview", url: "https://example.com", pageText: "body" }, "bad"))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 400 for malformed request bodies", async () => {
    const response = await POST(createRequest({ nope: true }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid request" })
  })

  it("returns parsed preview data and existing application summary", async () => {
    vi.mocked(parseImportedJobPreview).mockResolvedValue({
      url: "https://example.com/job-1",
      source: "indeed",
      title: "Engineer",
      company: "Acme",
      location: "London",
      description: "A good role",
      salaryMin: 50000,
      salaryMax: 70000,
      salaryCurrency: "GBP",
      postedAt: null,
      isEasyApply: false,
    })
    vi.mocked(findExistingApplicationByUrl).mockResolvedValue({
      applicationId: "app-1",
      title: "Engineer",
      company: "Acme",
      status: "saved",
      createdAt: "2026-04-23T10:00:00.000Z",
      location: "London",
      applicationUrl: "https://app.example.com/applications/app-1",
      postingUrl: "https://example.com/job-1",
    })

    const response = await POST(
      createRequest({
        mode: "preview",
        url: "https://example.com/job-1",
        pageTitle: "Engineer",
        pageText: "job page body",
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      preview: {
        url: "https://example.com/job-1",
        source: "indeed",
        title: "Engineer",
        company: "Acme",
        location: "London",
        description: "A good role",
        salaryMin: 50000,
        salaryMax: 70000,
        salaryCurrency: "GBP",
        postedAt: null,
        isEasyApply: false,
      },
      alreadySaved: true,
      existingApplicationId: "app-1",
      existingApplication: {
        applicationId: "app-1",
        title: "Engineer",
        company: "Acme",
        status: "saved",
        createdAt: "2026-04-23T10:00:00.000Z",
        location: "London",
        applicationUrl: "https://app.example.com/applications/app-1",
        postingUrl: "https://example.com/job-1",
      },
    })
    expect(touchPersonalApiToken).toHaveBeenCalledWith("token-1")
  })

  it("saves a validated preview into applications", async () => {
    vi.mocked(persistJobForUser).mockResolvedValue({
      applicationId: "app-2",
      alreadySaved: false,
    })

    const response = await POST(
      createRequest({
        mode: "save",
        preview: {
          url: "https://example.com/job-2",
          source: "linkedin",
          title: "Engineer",
          company: "Acme",
          location: null,
          description: "desc",
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: "GBP",
          postedAt: null,
          isEasyApply: true,
        },
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      alreadySaved: false,
      applicationId: "app-2",
      applicationUrl: "https://app.example.com/applications/app-2",
    })
    expect(persistJobForUser).toHaveBeenCalledWith("user-1", expect.objectContaining({
      url: "https://example.com/job-2",
      source: "linkedin",
    }))
    expect(touchPersonalApiToken).toHaveBeenCalledWith("token-1")
  })

  it("returns 422 when the AI parser raises a user-facing error", async () => {
    vi.mocked(parseImportedJobPreview).mockRejectedValue(new JobImportError("No AI key configured", 422))

    const response = await POST(
      createRequest({
        mode: "preview",
        url: "https://example.com/job-1",
        pageTitle: "Engineer",
        pageText: "job page body",
      })
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: "No AI key configured" })
  })
})

describe("OPTIONS /api/jobs/import", () => {
  it("returns CORS headers for preflight", async () => {
    const response = await OPTIONS()

    expect(response.status).toBe(204)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization")
  })
})

describe("GET /api/jobs/import", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authenticatePersonalApiToken).mockResolvedValue({
      tokenId: "token-1",
      userId: "user-1",
    })
  })

  it("returns recent applications for the authenticated token owner", async () => {
    vi.mocked(listRecentApplicationsForUser).mockResolvedValue([
      {
        applicationId: "app-1",
        title: "Engineer",
        company: "Acme",
        status: "saved",
        createdAt: "2026-04-23T10:00:00.000Z",
        location: "London",
        applicationUrl: "https://app.example.com/applications/app-1",
        postingUrl: "https://example.com/job-1",
      },
    ])

    const response = await GET(createGetRequest("test-token", "?limit=5"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      recentApplications: [
        {
          applicationId: "app-1",
          title: "Engineer",
          company: "Acme",
          status: "saved",
          createdAt: "2026-04-23T10:00:00.000Z",
          location: "London",
          applicationUrl: "https://app.example.com/applications/app-1",
          postingUrl: "https://example.com/job-1",
        },
      ],
    })
    expect(listRecentApplicationsForUser).toHaveBeenCalledWith("user-1", "https://app.example.com", 5)
    expect(touchPersonalApiToken).toHaveBeenCalledWith("token-1")
  })
})

describe("PATCH /api/jobs/import", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authenticatePersonalApiToken).mockResolvedValue({
      tokenId: "token-1",
      userId: "user-1",
    })
  })

  it("updates the stage and returns the refreshed recent list", async () => {
    vi.mocked(updateApplicationStatusForUser).mockResolvedValue(true)
    vi.mocked(listRecentApplicationsForUser).mockResolvedValue([
      {
        applicationId: "app-1",
        title: "Engineer",
        company: "Acme",
        status: "interview",
        createdAt: "2026-04-23T10:00:00.000Z",
        location: "London",
        applicationUrl: "https://app.example.com/applications/app-1",
        postingUrl: "https://example.com/job-1",
      },
    ])

    const response = await PATCH(
      createPatchRequest({
        applicationId: "550e8400-e29b-41d4-a716-446655440000",
        status: "interview",
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      recentApplications: [
        {
          applicationId: "app-1",
          title: "Engineer",
          company: "Acme",
          status: "interview",
          createdAt: "2026-04-23T10:00:00.000Z",
          location: "London",
          applicationUrl: "https://app.example.com/applications/app-1",
          postingUrl: "https://example.com/job-1",
        },
      ],
    })
    expect(updateApplicationStatusForUser).toHaveBeenCalledWith(
      "user-1",
      "550e8400-e29b-41d4-a716-446655440000",
      "interview"
    )
    expect(touchPersonalApiToken).toHaveBeenCalledWith("token-1")
  })
})
