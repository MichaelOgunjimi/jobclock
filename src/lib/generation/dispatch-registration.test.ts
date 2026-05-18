import { describe, expect, it, vi } from "vitest"

// Handlers transitively import @/lib/db; stub it so importing the dispatch
// chokepoint does not open a real DB connection at module load.
vi.mock("@/lib/db", () => ({ db: {} }))

// Importing the dispatch chokepoint must register every handler, because the
// inline (no-QSTASH_TOKEN) path goes through dispatch, not the QStash route.
import "./dispatch"
import { getHandler } from "./handlers"
import type { GenerationKind } from "./jobs"

const KINDS: GenerationKind[] = [
  "cover_letter",
  "company_research",
  "interview_prep",
  "cv_tailor",
  "interview_answer",
]

describe("handler registration via dispatch import", () => {
  it.each(KINDS)("registers a handler for %s", (kind) => {
    expect(typeof getHandler(kind)).toBe("function")
  })
})
