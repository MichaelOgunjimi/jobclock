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
})
