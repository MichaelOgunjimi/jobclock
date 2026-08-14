import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSupabaseClient, mockUser } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("@/lib/generation/enqueue", () => ({
  enqueueGeneration: vi.fn(),
}))
vi.mock("@/lib/jobs/persist-job", () => ({
  updateApplicationStatusForUser: vi.fn(),
}))

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { enqueueGeneration } from "@/lib/generation/enqueue"
import { updateApplicationStatusForUser } from "@/lib/jobs/persist-job"
import {
  deleteApplication,
  generateCoverLetter,
  updateCoverLetter,
  updateCv,
  updateDescription,
  updateJobDetail,
  updateNotes,
  updateStatus,
  updateWritingStyle,
} from "./actions"

function makeFormData(values: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) {
    formData.append(key, value)
  }
  return formData
}

describe("application actions", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(enqueueGeneration).mockResolvedValue({ jobId: "j-default", deduped: false })
  })

  it("updateStatus delegates status changes to the transition recorder", async () => {
    await updateStatus(makeFormData({ applicationId: "app-1", status: "applied" }))

    expect(updateApplicationStatusForUser).toHaveBeenCalledWith(mockUser.id, "app-1", "applied")
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
    expect(revalidatePath).toHaveBeenCalledWith("/applications")
  })

  it("updateStatus accepts ghosted as a closed outcome", async () => {
    await updateStatus(makeFormData({ applicationId: "app-1", status: "ghosted" }))

    expect(updateApplicationStatusForUser).toHaveBeenCalledWith(mockUser.id, "app-1", "ghosted")
  })

  it("updateStatus ignores invalid status", async () => {
    await updateStatus(makeFormData({ applicationId: "app-1", status: "invalid" }))

    expect(
      supabaseMock
        .getQueryCalls()
        .some((call) => call.table === "applications" && call.operation === "update")
    ).toBe(false)
    expect(updateApplicationStatusForUser).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("updateNotes updates notes", async () => {
    await updateNotes(makeFormData({ applicationId: "app-1", notes: "new notes" }))

    const call = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "applications" && query.operation === "update")
    expect(call?.payload).toEqual({ notes: "new notes" })
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
  })

  it("updateNotes returns early when applicationId is missing", async () => {
    await updateNotes(makeFormData({ notes: "new notes" }))
    expect(
      supabaseMock
        .getQueryCalls()
        .some((query) => query.table === "applications" && query.operation === "update")
    ).toBe(false)
  })

  it("updateCv converts empty cv id to null", async () => {
    await updateCv(makeFormData({ applicationId: "app-1", cvId: "" }))

    const call = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "applications" && query.operation === "update")
    expect(call?.payload).toEqual({ selected_cv_id: null })
  })

  it("updateCoverLetter converts empty id to null", async () => {
    await updateCoverLetter(makeFormData({ applicationId: "app-1", coverLetterId: "" }))

    const call = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "applications" && query.operation === "update")
    expect(call?.payload).toEqual({ cover_letter_id: null })
  })

  it("updateWritingStyle writes nullable structure and tone", async () => {
    await updateWritingStyle(
      makeFormData({ applicationId: "app-1", structureId: "", tone: "" })
    )

    const call = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "applications" && query.operation === "update")
    expect(call?.payload).toEqual({ structure_id: null, cover_letter_tone: null })
  })

  it("deleteApplication deletes record and redirects", async () => {
    await deleteApplication("app-1")

    const deleteCall = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "applications" && query.operation === "delete")
    expect(deleteCall).toBeTruthy()
    expect(revalidatePath).toHaveBeenCalledWith("/applications")
    expect(redirect).toHaveBeenCalledWith("/applications")
  })

  it("updateDescription returns validation and db errors, then success", async () => {
    expect(await updateDescription(makeFormData({ description: "desc" }))).toEqual({
      error: "Missing application ID",
    })

    supabaseMock.setQueryResult("applications.update", {
      error: { message: "write failed" },
    })
    expect(
      await updateDescription(
        makeFormData({ applicationId: "app-1", description: "desc" })
      )
    ).toEqual({ error: "write failed" })

    supabaseMock.setQueryResult("applications.update", { error: null })
    expect(
      await updateDescription(
        makeFormData({ applicationId: "app-1", description: "desc" })
      )
    ).toEqual({ success: true })
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
  })

  it("updateJobDetail updates only the allowlisted correction field", async () => {
    expect(
      await updateJobDetail(makeFormData({
        applicationId: "app-1",
        field: "company",
        value: "Correct Company",
      })),
    ).toEqual({ success: true })

    const call = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "applications" && query.operation === "update")
    expect(call?.payload).toEqual({ custom_company: "Correct Company" })
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
    expect(revalidatePath).toHaveBeenCalledWith("/applications")
  })

  it("updateJobDetail can restore the extracted value", async () => {
    expect(
      await updateJobDetail(makeFormData({
        applicationId: "app-1",
        field: "salary",
        value: "ignored",
        useExtracted: "true",
      })),
    ).toEqual({ success: true })

    const call = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "applications" && query.operation === "update")
    expect(call?.payload).toEqual({ custom_salary_text: null })
  })

  it("updateJobDetail rejects unknown fields and empty required values", async () => {
    expect(
      await updateJobDetail(makeFormData({ applicationId: "app-1", field: "url", value: "bad" })),
    ).toEqual({ error: "Invalid job detail field" })
    expect(
      await updateJobDetail(makeFormData({ applicationId: "app-1", field: "title", value: " " })),
    ).toEqual({ error: "Role is required" })
    expect(supabaseMock.getQueryCalls()).toHaveLength(0)
  })

  it("generateCoverLetter enqueues a cover_letter job for the authenticated user", async () => {
    vi.mocked(enqueueGeneration).mockResolvedValue({ jobId: "j-1", deduped: false })

    const result = await generateCoverLetter("app-1")

    expect(enqueueGeneration).toHaveBeenCalledWith({
      kind: "cover_letter",
      userId: mockUser.id,
      applicationId: "app-1",
    })
    expect(result).toEqual({ jobId: "j-1" })
  })

  it("generateCoverLetter returns the enqueue error when rate-limited or otherwise rejected", async () => {
    vi.mocked(enqueueGeneration).mockResolvedValue({
      error: "Too many requests. Please wait a moment before trying again.",
    })

    const result = await generateCoverLetter("app-1")

    expect(result).toEqual({
      error: "Too many requests. Please wait a moment before trying again.",
    })
  })

  it("generateCoverLetter returns the existing job id when the job is deduped", async () => {
    vi.mocked(enqueueGeneration).mockResolvedValue({ jobId: "j-existing", deduped: true })

    const result = await generateCoverLetter("app-1")

    expect(result).toEqual({ jobId: "j-existing" })
  })

  it("returns early for config and auth guards", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    await updateCv(makeFormData({ applicationId: "app-1", cvId: "cv-1" }))
    expect(supabaseMock.getQueryCalls()).toHaveLength(0)

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    supabaseMock.setUser(null)
    expect(await updateDescription(makeFormData({ applicationId: "app-1", description: "d" }))).toEqual({
      error: "Unauthorized",
    })
    expect(await generateCoverLetter("app-1")).toEqual({ error: "Not authenticated." })
  })
})
