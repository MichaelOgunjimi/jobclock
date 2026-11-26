import { describe, expect, it } from "vitest"
import { addDaysToDate, DEFAULT_TIMEZONE, formatLocalDate, formatLocalDateTime, isValidTimezone, resolveTimezone, startOfLocalDay } from "./timezone"

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

describe("addDaysToDate", () => {
  it("moves a calendar date across month, year and leap-day boundaries", () => {
    expect(addDaysToDate("2026-11-30", 2)).toBe("2026-12-02")
    expect(addDaysToDate("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDaysToDate("2028-03-01", -1)).toBe("2028-02-29")
  })
})

describe("startOfLocalDay", () => {
  it.each([
    ["Europe/London", "2026-11-21", "2026-11-21T00:00:00.000Z"],
    ["Europe/London", "2026-07-02", "2026-07-01T23:00:00.000Z"],
    ["Asia/Tokyo", "2026-07-02", "2026-07-01T15:00:00.000Z"],
    ["America/New_York", "2026-07-02", "2026-07-02T04:00:00.000Z"],
    ["America/New_York", "2026-12-02", "2026-12-02T05:00:00.000Z"],
    ["Asia/Kolkata", "2026-07-02", "2026-07-01T18:30:00.000Z"],
    // The day after the clocks go forward starts an hour earlier in UTC than the day of the change.
    ["Europe/London", "2026-03-29", "2026-03-29T00:00:00.000Z"],
    ["Europe/London", "2026-03-30", "2026-03-29T23:00:00.000Z"],
    ["Europe/London", "2026-10-26", "2026-10-26T00:00:00.000Z"],
    // Havana's clocks skip midnight on 8 Mar 2026, so the day starts at 01:00 local (06:00Z).
    ["America/Havana", "2026-03-08", "2026-03-08T05:00:00.000Z"],
    [null, "2026-07-02", "2026-07-01T23:00:00.000Z"],
  ])("%s %s starts at %s", (zone, date, expected) => {
    expect(startOfLocalDay(date, zone).toISOString()).toBe(expected)
  })

  it("always starts exactly on the first moment of the date", () => {
    for (const zone of ["Europe/London", "America/New_York", "America/Havana", "America/Anchorage", "Australia/Lord_Howe", "Asia/Tokyo"]) {
      for (let day = 0; day < 400; day += 1) {
        const date = addDaysToDate("2026-01-01", day)
        const start = startOfLocalDay(date, zone)
        expect(formatLocalDate(start, zone), `${zone} ${date}`).toBe(date)
        expect(formatLocalDate(new Date(start.getTime() - 1), zone), `${zone} ${date}`).not.toBe(date)
      }
    }
  })
})
