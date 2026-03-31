import { describe, it, expect } from "vitest"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB — matches route.ts

const isFileTooLarge = (size: number) => size > MAX_FILE_SIZE

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]

const isMimeAllowed = (type: string) => ALLOWED_TYPES.includes(type)

describe("CV upload — file size validation", () => {
  it("accepts a file exactly at 10MB", () => {
    expect(isFileTooLarge(MAX_FILE_SIZE)).toBe(false)
  })

  it("rejects a file one byte over 10MB", () => {
    expect(isFileTooLarge(MAX_FILE_SIZE + 1)).toBe(true)
  })

  it("accepts a small file (1KB)", () => {
    expect(isFileTooLarge(1024)).toBe(false)
  })

  it("rejects a 20MB file", () => {
    expect(isFileTooLarge(20 * 1024 * 1024)).toBe(true)
  })

  it("accepts a zero-byte file (size check only)", () => {
    expect(isFileTooLarge(0)).toBe(false)
  })
})

describe("CV upload — MIME type validation", () => {
  it("allows application/pdf", () => {
    expect(isMimeAllowed("application/pdf")).toBe(true)
  })

  it("allows application/vnd.openxmlformats-officedocument.wordprocessingml.document", () => {
    expect(
      isMimeAllowed(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(true)
  })

  it("allows application/msword", () => {
    expect(isMimeAllowed("application/msword")).toBe(true)
  })

  it("rejects image/png", () => {
    expect(isMimeAllowed("image/png")).toBe(false)
  })

  it("rejects text/plain", () => {
    expect(isMimeAllowed("text/plain")).toBe(false)
  })

  it("rejects an empty string", () => {
    expect(isMimeAllowed("")).toBe(false)
  })
})
