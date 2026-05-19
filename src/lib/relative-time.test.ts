import { describe, expect, it } from "vitest"
import { formatRelativeTime, formatElapsed } from "@/lib/relative-time"

describe("formatElapsed", () => {
  it("formats sub-minute and multi-minute durations as m:ss", () => {
    expect(formatElapsed(0)).toBe("0:00")
    expect(formatElapsed(14_000)).toBe("0:14")
    expect(formatElapsed(75_000)).toBe("1:15")
    expect(formatElapsed(605_000)).toBe("10:05")
  })

  it("clamps negative and non-finite input to 0:00", () => {
    expect(formatElapsed(-1000)).toBe("0:00")
    expect(formatElapsed(NaN)).toBe("0:00")
  })
})

const NOW = new Date("2026-05-19T12:00:00.000Z").getTime()

describe("formatRelativeTime", () => {
  it("returns 'just now' for <1m (and future timestamps)", () => {
    expect(formatRelativeTime("2026-05-19T11:59:30.000Z", NOW)).toBe("just now")
    expect(formatRelativeTime("2026-05-19T12:01:00.000Z", NOW)).toBe("just now")
  })

  it("uses minute, hour and day buckets", () => {
    expect(formatRelativeTime("2026-05-19T11:45:00.000Z", NOW)).toBe("15m ago")
    expect(formatRelativeTime("2026-05-19T09:00:00.000Z", NOW)).toBe("3h ago")
    expect(formatRelativeTime("2026-05-17T12:00:00.000Z", NOW)).toBe("2d ago")
  })

  it("falls back to an absolute date past a week", () => {
    expect(formatRelativeTime("2026-05-01T12:00:00.000Z", NOW)).toMatch(/2026/)
  })

  it("returns empty string for an unparseable date", () => {
    expect(formatRelativeTime("not-a-date", NOW)).toBe("")
  })
})
