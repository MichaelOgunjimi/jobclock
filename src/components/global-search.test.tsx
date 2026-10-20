import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { globalSearchRecentsKey } from "@/lib/global-search"
import { GlobalSearch } from "./global-search"

const routerMock = vi.hoisted(() => ({ push: vi.fn() }))
const recentSearchKey = globalSearchRecentsKey("user-1")

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}))

vi.mock("@/contexts/generation-jobs-context", () => ({
  useGenerationJobsContext: () => ({
    userId: "user-1",
    searchItems: [
      {
        id: "application:1",
        type: "application",
        label: "Platform Engineer",
        description: "Acme",
        href: "/applications/platform-engineer-acme",
      },
      {
        id: "cv:1",
        type: "cv",
        label: "Backend CV",
        description: "Primary CV",
        href: "/profile/cv-1",
      },
    ],
  }),
}))

describe("GlobalSearch", () => {
  beforeEach(() => {
    routerMock.push.mockReset()
  })

  it("opens with the global shortcut and fuzzy-searches saved records", async () => {
    render(<GlobalSearch />)

    fireEvent.keyDown(window, { key: "k", metaKey: true })
    const input = await screen.findByRole("combobox", { name: "Global search" })
    fireEvent.change(input, { target: { value: "pltfm eng" } })

    expect(screen.getByRole("option", { name: /Platform Engineer/ })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: /Backend CV/ })).not.toBeInTheDocument()
  })

  it("uses arrow keys and Enter to run commands and remembers the query", async () => {
    render(<GlobalSearch />)

    fireEvent.click(screen.getByRole("button", { name: "Search or run a command" }))
    const input = await screen.findByRole("combobox", { name: "Global search" })
    fireEvent.change(input, { target: { value: "configure ai" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/settings?tab=ai"))
    expect(JSON.parse(localStorage.getItem(recentSearchKey) ?? "[]")).toEqual([
      "configure ai",
    ])
  })

  it("restores and clears recent searches", async () => {
    localStorage.setItem(recentSearchKey, JSON.stringify(["platform engineer"]))
    render(<GlobalSearch />)

    fireEvent.click(screen.getByRole("button", { name: "Search or run a command" }))
    expect(await screen.findByRole("button", { name: /platform engineer/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(localStorage.getItem(recentSearchKey)).toBeNull()
    expect(screen.queryByRole("button", { name: /platform engineer/ })).not.toBeInTheDocument()
  })
})
