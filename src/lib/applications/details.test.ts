import { describe, expect, it } from "vitest"
import { MAX_TAG_LENGTH, MAX_TAGS, normalizeAppliedAt, normalizeSource, normalizeTags } from "./details"

describe("normalizeTags", () => {
  it("trims, drops blanks and removes case-insensitive duplicates keeping the first spelling", () => {
    expect(normalizeTags(["  Remote ", "remote", "REMOTE", "", "  ", "Dream job"])).toEqual({ ok: true, value: ["Remote", "Dream job"] })
  })

  it("accepts exactly the maximum number and length", () => {
    const tags = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`)
    expect(normalizeTags(tags)).toEqual({ ok: true, value: tags })
    expect(normalizeTags(["x".repeat(MAX_TAG_LENGTH)]).ok).toBe(true)
  })

  it("rejects too many tags and too-long tags instead of silently cutting them", () => {
    const tooMany = normalizeTags(Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`))
    expect(tooMany).toEqual({ ok: false, error: expect.stringContaining(`at most ${MAX_TAGS}`) })
    expect(normalizeTags(["x".repeat(MAX_TAG_LENGTH + 1)])).toEqual({ ok: false, error: expect.stringContaining(`${MAX_TAG_LENGTH} characters`) })
  })

  it("does not count duplicates towards the limit", () => {
    const tags = [...Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`), "T0", "t1"]
    expect(normalizeTags(tags).ok).toBe(true)
  })
})

describe("normalizeSource", () => {
  it("trims and turns empty into null", () => {
    expect(normalizeSource("  LinkedIn ")).toEqual({ ok: true, value: "LinkedIn" })
    expect(normalizeSource("   ")).toEqual({ ok: true, value: null })
    expect(normalizeSource(null)).toEqual({ ok: true, value: null })
  })

  it("rejects an over-long source", () => {
    expect(normalizeSource("x".repeat(61)).ok).toBe(false)
  })
})

describe("normalizeAppliedAt", () => {
  const now = new Date("2026-11-21T08:00:00Z")

  it("stores a date at noon UTC and clears on null or empty", () => {
    expect(normalizeAppliedAt("2026-11-01", now)).toEqual({ ok: true, value: new Date("2026-11-01T12:00:00Z") })
    expect(normalizeAppliedAt(null, now)).toEqual({ ok: true, value: null })
    expect(normalizeAppliedAt("", now)).toEqual({ ok: true, value: null })
  })

  it("allows today and tomorrow (timezones) but not further ahead", () => {
    expect(normalizeAppliedAt("2026-11-21", now).ok).toBe(true)
    expect(normalizeAppliedAt("2026-11-22", now).ok).toBe(true)
    expect(normalizeAppliedAt("2026-11-23", now)).toEqual({ ok: false, error: "The applied date can't be in the future." })
    expect(normalizeAppliedAt("2031-01-01", now).ok).toBe(false)
  })

  it("rejects dates before 2000 and malformed or impossible dates", () => {
    expect(normalizeAppliedAt("1999-12-31", now).ok).toBe(false)
    expect(normalizeAppliedAt("2000-01-01", now).ok).toBe(true)
    for (const bad of ["2026-02-30", "21/11/2026", "2026-1-1", "nope"]) expect(normalizeAppliedAt(bad, now)).toEqual({ ok: false, error: "Enter a valid date." })
  })
})
