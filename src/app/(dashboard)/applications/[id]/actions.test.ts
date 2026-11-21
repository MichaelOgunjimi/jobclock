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
vi.mock("@/lib/applications/manage", () => ({
  archiveApplicationForUser: vi.fn(),
  restoreApplicationForUser: vi.fn(),
  setApplicationTagsForUser: vi.fn(),
  setApplicationSourceForUser: vi.fn(),
  setApplicationAppliedAtForUser: vi.fn(),
}))
vi.mock("@/lib/applications/audit", () => ({
  updateApplicationWithAuditForUser: vi.fn(),
  deleteApplicationWithAuditForUser: vi.fn(),
}))

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { enqueueGeneration } from "@/lib/generation/enqueue"
import { updateApplicationStatusForUser } from "@/lib/jobs/persist-job"
import {
  deleteApplicationWithAuditForUser,
  updateApplicationWithAuditForUser,
} from "@/lib/applications/audit"
import {
  archiveApplicationForUser,
  restoreApplicationForUser,
  setApplicationAppliedAtForUser,
  setApplicationSourceForUser,
  setApplicationTagsForUser,
} from "@/lib/applications/manage"
import {
  archiveApplication,
  deleteApplication,
  generateCoverLetter,
  updateCoverLetter,
  updateCv,
  updateDescription,
  updateFollowUp,
  restoreApplication,
  updateAppliedAt,
  updateInterviewAt,
  updateJobDetail,
  updateSource,
  updateTags,
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
    vi.mocked(updateApplicationWithAuditForUser).mockResolvedValue(true)
    vi.mocked(deleteApplicationWithAuditForUser).mockResolvedValue(true)
  })

  it("updateStatus delegates status changes to the transition recorder", async () => {
    await updateStatus(makeFormData({ applicationId: "app-1", status: "applied" }))

    expect(updateApplicationStatusForUser).toHaveBeenCalledWith(
      mockUser.id,
      "app-1",
      "applied",
      "progress"
    )
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
    expect(revalidatePath).toHaveBeenCalledWith("/applications")
  })

  it("updateStatus accepts ghosted as a closed outcome", async () => {
    await updateStatus(makeFormData({ applicationId: "app-1", status: "ghosted" }))

    expect(updateApplicationStatusForUser).toHaveBeenCalledWith(
      mockUser.id,
      "app-1",
      "ghosted",
      "progress"
    )
  })

  it("updateStatus passes explicit correction intent", async () => {
    await updateStatus(makeFormData({
      applicationId: "app-1",
      status: "screening",
      intent: "correction",
    }))

    expect(updateApplicationStatusForUser).toHaveBeenCalledWith(
      mockUser.id,
      "app-1",
      "screening",
      "correction"
    )
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

    expect(updateApplicationWithAuditForUser).toHaveBeenCalledWith(
      mockUser.id,
      "app-1",
      { notes: "new notes" },
      "application.notes_updated",
    )
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
  })

  it("updateNotes returns early when applicationId is missing", async () => {
    await updateNotes(makeFormData({ notes: "new notes" }))
    expect(updateApplicationWithAuditForUser).not.toHaveBeenCalled()
  })

  it("updateCv converts empty cv id to null", async () => {
    await updateCv(makeFormData({ applicationId: "app-1", cvId: "" }))

    expect(updateApplicationWithAuditForUser).toHaveBeenCalledWith(
      mockUser.id,
      "app-1",
      { selectedCvId: null },
      "application.cv_selected",
    )
  })

  it("updateCoverLetter converts empty id to null", async () => {
    await updateCoverLetter(makeFormData({ applicationId: "app-1", coverLetterId: "" }))

    expect(updateApplicationWithAuditForUser).toHaveBeenCalledWith(
      mockUser.id,
      "app-1",
      { coverLetterId: null },
      "application.cover_letter_selected",
    )
  })

  it("updateWritingStyle writes nullable structure and tone", async () => {
    await updateWritingStyle(
      makeFormData({ applicationId: "app-1", structureId: "", tone: "" })
    )

    expect(updateApplicationWithAuditForUser).toHaveBeenCalledWith(
      mockUser.id,
      "app-1",
      { structureId: null, coverLetterTone: null },
      "application.writing_style_updated",
    )
  })

  it("updateFollowUp records due date and safe notes through the audited mutation path", async () => {
    await updateFollowUp("app-1", {
      followUpDueAt: "2026-10-10T09:00:00.000Z",
      followUpNotes: "Ask about the role",
    })

    expect(updateApplicationWithAuditForUser).toHaveBeenCalledWith(
      mockUser.id,
      "app-1",
      {
        followUpDueAt: new Date("2026-10-10T09:00:00.000Z"),
        followUpNotes: "Ask about the role",
      },
      "application.follow_up_updated",
    )
  })

  it("updateInterviewAt stores a valid instant as a UTC Date and revalidates", async () => {
    expect(await updateInterviewAt("app-1", "2026-12-01T14:30:00.000Z")).toEqual({})

    expect(updateApplicationWithAuditForUser).toHaveBeenCalledWith(
      mockUser.id,
      "app-1",
      { interviewAt: new Date("2026-12-01T14:30:00.000Z") },
      "application.interview_scheduled",
    )
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
  })

  it("updateInterviewAt clears the date with null", async () => {
    await updateInterviewAt("app-1", null)

    expect(updateApplicationWithAuditForUser).toHaveBeenCalledWith(
      mockUser.id,
      "app-1",
      { interviewAt: null },
      "application.interview_scheduled",
    )
  })

  it("updateInterviewAt rejects invalid input without writing", async () => {
    for (const bad of ["", "tomorrow", "2026-12-01", "1999-01-01T00:00:00.000Z"]) {
      expect((await updateInterviewAt("app-1", bad)).error).toBeTruthy()
    }
    expect(await updateInterviewAt("", null)).toEqual({ error: "Missing application ID" })
    expect(updateApplicationWithAuditForUser).not.toHaveBeenCalled()
  })

  it("updateInterviewAt reports a missing application and write failures", async () => {
    vi.mocked(updateApplicationWithAuditForUser).mockResolvedValueOnce(false)
    expect(await updateInterviewAt("app-1", null)).toEqual({ error: "Application not found" })

    vi.mocked(updateApplicationWithAuditForUser).mockRejectedValueOnce(new Error("write failed"))
    expect(await updateInterviewAt("app-1", null)).toEqual({ error: "write failed" })
  })

  it("deleteApplication deletes record and redirects", async () => {
    await deleteApplication("app-1")

    expect(deleteApplicationWithAuditForUser).toHaveBeenCalledWith(mockUser.id, "app-1")
    expect(revalidatePath).toHaveBeenCalledWith("/applications")
    expect(redirect).toHaveBeenCalledWith("/applications")
  })

  it("updateDescription returns validation and db errors, then success", async () => {
    expect(await updateDescription(makeFormData({ description: "desc" }))).toEqual({
      error: "Missing application ID",
    })

    vi.mocked(updateApplicationWithAuditForUser).mockRejectedValueOnce(new Error("write failed"))
    expect(
      await updateDescription(
        makeFormData({ applicationId: "app-1", description: "desc" })
      )
    ).toEqual({ error: "write failed" })

    vi.mocked(updateApplicationWithAuditForUser).mockResolvedValueOnce(true)
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

    expect(updateApplicationWithAuditForUser).toHaveBeenCalledWith(
      mockUser.id,
      "app-1",
      { customCompany: "Correct Company" },
      "application.details_updated",
    )
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

    expect(updateApplicationWithAuditForUser).toHaveBeenCalledWith(
      mockUser.id,
      "app-1",
      { customSalaryText: null },
      "application.details_updated",
    )
  })

  it("updateJobDetail rejects unknown fields and empty required values", async () => {
    expect(
      await updateJobDetail(makeFormData({ applicationId: "app-1", field: "url", value: "bad" })),
    ).toEqual({ error: "Invalid job detail field" })
    expect(
      await updateJobDetail(makeFormData({ applicationId: "app-1", field: "title", value: " " })),
    ).toEqual({ error: "Role is required" })
    expect(updateApplicationWithAuditForUser).not.toHaveBeenCalled()
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
    expect(updateApplicationWithAuditForUser).not.toHaveBeenCalled()

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    supabaseMock.setUser(null)
    expect(await updateDescription(makeFormData({ applicationId: "app-1", description: "d" }))).toEqual({
      error: "Unauthorized",
    })
    expect(await generateCoverLetter("app-1")).toEqual({ error: "Not authenticated." })
  })

  describe("archive, tags, source and applied date", () => {
    const ok = { changed: true, before: {}, after: {} } as never

    it("archives and restores for the signed-in user and refreshes the list", async () => {
      vi.mocked(archiveApplicationForUser).mockResolvedValue(ok)
      vi.mocked(restoreApplicationForUser).mockResolvedValue(ok)

      expect(await archiveApplication("app-1")).toEqual({})
      expect(archiveApplicationForUser).toHaveBeenCalledWith(mockUser.id, "app-1")
      expect(await restoreApplication("app-1")).toEqual({})
      expect(restoreApplicationForUser).toHaveBeenCalledWith(mockUser.id, "app-1")
      expect(revalidatePath).toHaveBeenCalledWith("/applications")
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard")
    })

    it("passes tags, source and the applied date to their helpers", async () => {
      vi.mocked(setApplicationTagsForUser).mockResolvedValue(ok)
      vi.mocked(setApplicationSourceForUser).mockResolvedValue(ok)
      vi.mocked(setApplicationAppliedAtForUser).mockResolvedValue(ok)

      await updateTags("app-1", ["remote"])
      await updateSource("app-1", "LinkedIn")
      await updateAppliedAt("app-1", "2026-11-01")
      expect(setApplicationTagsForUser).toHaveBeenCalledWith(mockUser.id, "app-1", ["remote"])
      expect(setApplicationSourceForUser).toHaveBeenCalledWith(mockUser.id, "app-1", "LinkedIn")
      expect(setApplicationAppliedAtForUser).toHaveBeenCalledWith(mockUser.id, "app-1", "2026-11-01")
    })

    it("returns validation and not-found errors without revalidating", async () => {
      vi.mocked(setApplicationTagsForUser).mockResolvedValue({ error: "Too many" })
      vi.mocked(archiveApplicationForUser).mockResolvedValue(null)

      expect(await updateTags("app-1", ["a"])).toEqual({ error: "Too many" })
      expect(await archiveApplication("app-1")).toEqual({ error: "Application not found" })
      expect(revalidatePath).not.toHaveBeenCalled()
    })

    it("does nothing when signed out", async () => {
      supabaseMock.client.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } }) as never
      expect(await archiveApplication("app-1")).toEqual({ error: "Unauthorized" })
      expect(archiveApplicationForUser).not.toHaveBeenCalled()
    })
  })
})
