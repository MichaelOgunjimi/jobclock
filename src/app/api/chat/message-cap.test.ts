import { describe, it, expect } from "vitest"

// Mirrors the messages.slice(-20) pattern in the chat route
function capMessages<T>(messages: T[]): T[] {
  return messages.slice(-20)
}

describe("Chat message cap — messages.slice(-20)", () => {
  it("trims 25 items down to the last 20", () => {
    const msgs = Array.from({ length: 25 }, (_, i) => i)
    const result = capMessages(msgs)
    expect(result).toHaveLength(20)
    expect(result[0]).toBe(5)
    expect(result[19]).toBe(24)
  })

  it("keeps all 10 items when under the cap", () => {
    const msgs = Array.from({ length: 10 }, (_, i) => i)
    const result = capMessages(msgs)
    expect(result).toHaveLength(10)
  })

  it("returns an empty array for zero items", () => {
    expect(capMessages([])).toHaveLength(0)
  })

  it("keeps exactly 20 items when at the cap", () => {
    const msgs = Array.from({ length: 20 }, (_, i) => i)
    const result = capMessages(msgs)
    expect(result).toHaveLength(20)
    expect(result[0]).toBe(0)
    expect(result[19]).toBe(19)
  })
})
