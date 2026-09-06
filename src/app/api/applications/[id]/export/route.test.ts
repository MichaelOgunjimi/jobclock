import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSupabaseClient, mockUser } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/applications/export", () => ({ loadApplicationExport: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { loadApplicationExport } from "@/lib/applications/export"
import { GET } from "./route"

const applicationExport = {
  format: "jobclock.application-export",
  version: 1,
  summary: {
    role: "Product Engineer",
    company: "Acme",
  },
}

function callRoute() {
  return GET(new Request("http://localhost/api/applications/app-1/export"), {
    params: Promise.resolve({ id: "app-1" }),
  })
}

describe("GET /api/applications/[id]/export", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(loadApplicationExport).mockResolvedValue(applicationExport as never)
  })

  it("requires authentication", async () => {
    supabaseMock.setUser(null)

    const response = await callRoute()

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
    expect(loadApplicationExport).not.toHaveBeenCalled()
  })

  it("returns not found when the user does not own the application", async () => {
    vi.mocked(loadApplicationExport).mockResolvedValue(null)

    const response = await callRoute()

    expect(loadApplicationExport).toHaveBeenCalledWith(mockUser.id, "app-1")
    expect(response.status).toBe(404)
  })

  it("downloads a formatted JSON attachment without caching it", async () => {
    const response = await callRoute()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("content-disposition")).toContain(
      'filename="Acme - Product Engineer - Application Export.json"',
    )
    expect(await response.json()).toEqual(applicationExport)
  })

  it("does not expose database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.mocked(loadApplicationExport).mockRejectedValue(new Error("database connection string"))

    const response = await callRoute()

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Failed to export application" })
  })
})
