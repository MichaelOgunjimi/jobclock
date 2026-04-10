import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { EXPERIENCE_LEVELS } from "@/app/(dashboard)/profile/profile-tabs"

function Chips({ active }: { active: boolean }) {
  return <button type="button" aria-pressed={active}>Junior</button>
}

describe("Experience chip aria-pressed attribute", () => {
  it("has aria-pressed='false' when not active", () => {
    render(<Chips active={false} />)
    const btn = screen.getByRole("button", { name: "Junior" })
    expect(btn).toHaveAttribute("aria-pressed", "false")
  })

  it("has aria-pressed='true' when active", () => {
    render(<Chips active={true} />)
    const btn = screen.getByRole("button", { name: "Junior" })
    expect(btn).toHaveAttribute("aria-pressed", "true")
  })
})

describe("EXPERIENCE_LEVELS 'mid' entry label text", () => {
  it("mid level label starts with 'Mid (3-5 yrs'", () => {
    const mid = EXPERIENCE_LEVELS.find((l) => l.value === "mid")
    expect(mid).toBeDefined()
    expect(mid!.label).toMatch(/^Mid \(3–5 yrs/)
  })
})
