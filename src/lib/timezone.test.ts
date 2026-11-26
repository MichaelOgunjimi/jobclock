import { describe, expect, it } from "vitest"
import { DEFAULT_TIMEZONE, formatLocalDate, formatLocalDateTime, isValidTimezone, resolveTimezone } from "./timezone"

describe("isValidTimezone", () => {
  it("accepts IANA names, UTC and legacy aliases", () => {
    for (const zone of ["Europe/London", "America/New_York", "America/Argentina/Buenos_Aires", "Asia/Calcutta", "UTC"]) expect(isValidTimezone(zone)).toBe(true)
  })

  it("rejects junk, offsets, empty and non-strings", () => {
    for (const zone of ["", "Mars/Olympus", "+01:00", "europe", "Europe/London; drop table", "x".repeat(100), null, undefined, 5]) expect(isValidTimezone(zone)).toBe(false)
  })
})

describe("resolveTimezone", () => {
  it("falls back to Europe/London when missing or invalid", () => {
    expect(DEFAULT_TIMEZONE).toBe("Europe/London")
    expect(resolveTimezone(null)).toBe("Europe/London")
    expect(resolveTimezone(undefined)).toBe("Europe/London")
    expect(resolveTimezone("Not/AZone")).toBe("Europe/London")
    expect(resolveTimezone("America/New_York")).toBe("America/New_York")
  })
})

describe("formatLocalDateTime", () => {
  it("shows the same UTC clock time as GMT in winter and BST in summer for London", () => {
    expect(formatLocalDateTime("2026-01-15T14:00:00Z", "Europe/London")).toBe("2026-01-15 14:00 GMT")
    expect(formatLocalDateTime("2026-07-15T14:00:00Z", "Europe/London")).toBe("2026-07-15 15:00 BST")
  })

  it("moves across the UK spring-forward boundary (clocks go forward at 01:00 UTC on 29 March 2026)", () => {
    expect(formatLocalDateTime("2026-03-29T00:30:00Z", "Europe/London")).toBe("2026-03-29 00:30 GMT")
    expect(formatLocalDateTime("2026-03-29T01:30:00Z", "Europe/London")).toBe("2026-03-29 02:30 BST")
  })

  it("moves across the UK autumn boundary (clocks go back at 01:00 UTC on 25 October 2026)", () => {
    expect(formatLocalDateTime("2026-10-25T00:30:00Z", "Europe/London")).toBe("2026-10-25 01:30 BST")
    expect(formatLocalDateTime("2026-10-25T01:30:00Z", "Europe/London")).toBe("2026-10-25 01:30 GMT")
  })

  it("rolls the date over in zones ahead of or behind UTC", () => {
    expect(formatLocalDateTime("2026-11-21T23:30:00Z", "Asia/Tokyo")).toBe("2026-11-22 08:30 GMT+9")
    expect(formatLocalDateTime("2026-11-21T01:30:00Z", "America/New_York")).toBe("2026-11-20 20:30 EST")
    expect(formatLocalDateTime("2026-06-21T12:00:00Z", "Europe/Paris")).toBe("2026-06-21 14:00 CEST")
  })

  it("falls back to Europe/London for a missing or invalid zone", () => {
    expect(formatLocalDateTime("2026-07-15T14:00:00Z", null)).toBe("2026-07-15 15:00 BST")
    expect(formatLocalDateTime("2026-07-15T14:00:00Z", "Nope/Nope")).toBe("2026-07-15 15:00 BST")
  })
})

describe("formatLocalDate", () => {
  it("uses the calendar day in the user's zone", () => {
    expect(formatLocalDate("2026-11-21T23:30:00Z", "Asia/Tokyo")).toBe("2026-11-22")
    expect(formatLocalDate("2026-06-21T23:30:00Z", undefined)).toBe("2026-06-22")
    expect(formatLocalDate("2026-06-21T23:30:00Z", "UTC")).toBe("2026-06-21")
  })
})
