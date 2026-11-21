import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { APPLICATIONS_FILTER_STATE_STORAGE_KEY } from "./applications-filter-state"
import { ApplicationsFilterBar } from "./applications-filter-bar"

const navigationMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigationMock.push,
    replace: navigationMock.replace,
  }),
  useSearchParams: () => navigationMock.searchParams,
}))

describe("ApplicationsFilterBar", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigationMock.push.mockClear()
    navigationMock.replace.mockClear()
    navigationMock.searchParams = new URLSearchParams()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("replaces the search URL after typing without adding history or resetting scroll", () => {
    render(
      <ApplicationsFilterBar
        counts={{}}
        total={0}
        activeStatus="all"
        activeSort="saved_desc"
        activeSearch=""
      />
    )

    const input = screen.getByLabelText("Search applications by role or company")
    fireEvent.change(input, { target: { value: "soft wire" } })

    expect(input).toHaveValue("soft wire")
    expect(navigationMock.push).not.toHaveBeenCalled()
    expect(navigationMock.replace).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(input).toHaveValue("soft wire")
    expect(navigationMock.push).not.toHaveBeenCalled()
    expect(navigationMock.replace).toHaveBeenCalledWith(
      "/applications?q=soft+wire",
      { scroll: false }
    )
    expect(window.sessionStorage.getItem(APPLICATIONS_FILTER_STATE_STORAGE_KEY)).toBe("q=soft+wire")
  })

  it("keeps newer input when an older search navigation finishes", () => {
    const props = {
      counts: {},
      total: 0,
      activeStatus: "all",
      activeSort: "saved_desc",
    }
    const { rerender } = render(
      <ApplicationsFilterBar {...props} activeSearch="" />
    )

    const input = screen.getByLabelText("Search applications by role or company")
    fireEvent.change(input, { target: { value: "react" } })
    act(() => {
      vi.advanceTimersByTime(350)
    })
    fireEvent.change(input, { target: { value: "react native" } })

    rerender(<ApplicationsFilterBar {...props} activeSearch="react" />)

    expect(input).toHaveValue("react native")

    rerender(<ApplicationsFilterBar {...props} activeSearch="react native" />)
    rerender(<ApplicationsFilterBar {...props} activeSearch="react" />)

    expect(input).toHaveValue("react")
  })

  it("restores the saved session filter when the applications URL has no filters", () => {
    window.sessionStorage.setItem(
      APPLICATIONS_FILTER_STATE_STORAGE_KEY,
      "status=interview&q=react"
    )

    render(
      <ApplicationsFilterBar
        counts={{}}
        total={0}
        activeStatus="all"
        activeSort="saved_desc"
        activeSearch=""
      />
    )

    expect(navigationMock.replace).toHaveBeenCalledWith(
      "/applications?status=interview&q=react",
      { scroll: false }
    )
  })

  it("does not restore the saved session filter over an explicit applications URL filter", () => {
    navigationMock.searchParams = new URLSearchParams("q=manual")
    window.sessionStorage.setItem(
      APPLICATIONS_FILTER_STATE_STORAGE_KEY,
      "status=interview&q=react"
    )

    render(
      <ApplicationsFilterBar
        counts={{}}
        total={0}
        activeStatus="all"
        activeSort="saved_desc"
        activeSearch="manual"
      />
    )

    expect(navigationMock.replace).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(APPLICATIONS_FILTER_STATE_STORAGE_KEY)).toBe("q=manual")
  })

  it("links to the Archived view with its count, and back out of it", () => {
    const { rerender } = render(
      <ApplicationsFilterBar counts={{}} total={3} activeStatus="all" activeSort="saved_desc" activeSearch="" archivedCount={2} />
    )
    const pill = screen.getByRole("link", { name: /Archived\s*2/ })
    expect(pill).toHaveAttribute("href", "/applications?archived=1")

    navigationMock.searchParams = new URLSearchParams("archived=1")
    rerender(
      <ApplicationsFilterBar counts={{}} total={2} activeStatus="all" activeSort="saved_desc" activeSearch="" archivedCount={2} showArchived />
    )
    expect(screen.getByRole("link", { name: /Archived\s*2/ })).toHaveAttribute("href", "/applications")
  })

  it("shows the active tag and a link that clears only the tag", () => {
    navigationMock.searchParams = new URLSearchParams("tag=remote&status=applied")
    render(
      <ApplicationsFilterBar counts={{}} total={1} activeStatus="applied" activeSort="saved_desc" activeSearch="" activeTag="remote" />
    )
    expect(screen.getByRole("link", { name: "Clear tag filter remote" })).toHaveAttribute("href", "/applications?status=applied")
  })
})
