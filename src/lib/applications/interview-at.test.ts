import { afterEach, describe, expect, it } from "vitest"
import { fromLocalInputValue, interviewAtSchema, toLocalInputValue } from "./interview-at"

const originalTz = process.env.TZ

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ
  else process.env.TZ = originalTz
})

describe("interview-at helpers", () => {
  it("round-trips local wall-clock time to a UTC instant (Europe/London, summer)", () => {
    process.env.TZ = "Europe/London"
    expect(fromLocalInputValue("2026-07-01T09:30")).toBe("2026-07-01T08:30:00.000Z")
    expect(toLocalInputValue("2026-07-01T08:30:00.000Z")).toBe("2026-07-01T09:30")
  })

  it("applies the winter offset (America/New_York)", () => {
    process.env.TZ = "America/New_York"
    expect(fromLocalInputValue("2026-12-01T09:30")).toBe("2026-12-01T14:30:00.000Z")
    expect(toLocalInputValue("2026-12-01T14:30:00.000Z")).toBe("2026-12-01T09:30")
  })

  it("handles empty and invalid values", () => {
    expect(fromLocalInputValue("")).toBeNull()
    expect(fromLocalInputValue("nonsense")).toBeNull()
    expect(toLocalInputValue(null)).toBe("")
    expect(toLocalInputValue("nonsense")).toBe("")
  })

  it("validates ISO instants within a sane range", () => {
    expect(interviewAtSchema.safeParse("2026-12-01T14:30:00.000Z").success).toBe(true)
    expect(interviewAtSchema.safeParse("2026-12-01T14:30:00+01:00").success).toBe(true)
    expect(interviewAtSchema.safeParse("2026-12-01").success).toBe(false)
    expect(interviewAtSchema.safeParse("1999-12-31T23:00:00.000Z").success).toBe(false)
    expect(interviewAtSchema.safeParse("2101-01-01T00:00:00.000Z").success).toBe(false)
  })
})
