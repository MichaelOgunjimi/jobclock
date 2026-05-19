import { describe, expect, it } from "vitest"
import {
  selectRecentJobs,
  selectUnseenJobs,
  RECENT_NOTIFICATION_LIMIT,
  type GenerationJobRow,
} from "@/hooks/use-generation-jobs"

function job(over: Partial<GenerationJobRow>): GenerationJobRow {
  return {
    id: "j",
    user_id: "u",
    application_id: "a",
    kind: "cover_letter",
    status: "done",
    result_ref: null,
    error: null,
    seen_at: null,
    created_at: "2026-05-19T10:00:00.000Z",
    updated_at: "2026-05-19T10:00:00.000Z",
    ...over,
  }
}

describe("selectRecentJobs", () => {
  it("keeps only done/failed, newest-updated first", () => {
    const rows = [
      job({ id: "queued", status: "queued" }),
      job({ id: "old", status: "done", updated_at: "2026-05-19T09:00:00.000Z" }),
      job({ id: "new", status: "failed", updated_at: "2026-05-19T11:00:00.000Z" }),
    ]
    expect(selectRecentJobs(rows).map((j) => j.id)).toEqual(["new", "old"])
  })

  it("caps the list at the recent limit", () => {
    const rows = Array.from({ length: RECENT_NOTIFICATION_LIMIT + 5 }, (_, i) =>
      job({ id: `j${i}`, updated_at: `2026-05-19T10:${String(i).padStart(2, "0")}:00.000Z` }),
    )
    expect(selectRecentJobs(rows)).toHaveLength(RECENT_NOTIFICATION_LIMIT)
  })
})

describe("selectUnseenJobs", () => {
  it("keeps done/failed jobs without seen_at only", () => {
    const rows = [
      job({ id: "unseen", seen_at: null }),
      job({ id: "seen", seen_at: "2026-05-19T10:05:00.000Z" }),
      job({ id: "running", status: "running", seen_at: null }),
    ]
    expect(selectUnseenJobs(rows).map((j) => j.id)).toEqual(["unseen"])
  })
})
