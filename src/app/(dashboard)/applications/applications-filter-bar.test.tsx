import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { APPLICATIONS_FILTER_STATE_COOKIE } from "./applications-filter-state"
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
    document.cookie = `${APPLICATIONS_FILTER_STATE_COOKIE}=; Max-Age=0; Path=/`
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
  })
})
