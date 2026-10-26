import { describe, expect, it } from "vitest"
import { outOfOrderMigrations } from "./migration-order"

const journal = [
  { tag: "0001_a", when: 100, hash: "a" },
  { tag: "0002_b", when: 200, hash: "b" },
  { tag: "0003_c", when: 300, hash: "c" },
]

describe("outOfOrderMigrations", () => {
  it("is empty when everything is applied or newer than the last applied", () => {
    expect(outOfOrderMigrations(journal, new Set(["a", "b"]), 200)).toEqual([])
    expect(outOfOrderMigrations(journal, new Set(), 0)).toEqual([])
  })
  it("flags an unapplied migration older than the last applied one", () => {
    expect(outOfOrderMigrations(journal, new Set(["a", "c"]), 300)).toEqual(["0002_b"])
  })
})
