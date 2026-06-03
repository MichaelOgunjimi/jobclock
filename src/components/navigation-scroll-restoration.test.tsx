import { render } from "@testing-library/react"
import Link from "next/link"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NavigationScrollRestoration } from "./navigation-scroll-restoration"

const navigationMock = vi.hoisted(() => ({
  pathname: "/applications",
  searchParams: new URLSearchParams("status=applied"),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname,
  useSearchParams: () => navigationMock.searchParams,
}))

describe("NavigationScrollRestoration", () => {
  beforeEach(() => {
    navigationMock.pathname = "/applications"
    navigationMock.searchParams = new URLSearchParams("status=applied")
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("restores the previous scroll position on browser back navigation", () => {
    const { rerender } = render(
      <>
        <NavigationScrollRestoration />
        <main data-scroll-restoration-target style={{ height: 200, overflowY: "auto" }}>
          <Link href="/applications/app-1">Open application</Link>
          <div style={{ height: 1000 }} />
        </main>
      </>
    )

    const scrollTarget = document.querySelector<HTMLElement>("[data-scroll-restoration-target]")!
    scrollTarget.scrollTop = 640
    scrollTarget.dispatchEvent(new Event("scroll"))
    const detailLink = document.querySelector<HTMLAnchorElement>('a[href="/applications/app-1"]')!
    detailLink.addEventListener("click", (event) => event.preventDefault())
    detailLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    scrollTarget.scrollTop = 0
    scrollTarget.dispatchEvent(new Event("scroll"))

    navigationMock.pathname = "/applications/app-1"
    navigationMock.searchParams = new URLSearchParams()
    rerender(
      <>
        <NavigationScrollRestoration />
        <main data-scroll-restoration-target style={{ height: 200, overflowY: "auto" }}>
          <div style={{ height: 1000 }} />
        </main>
      </>
    )

    scrollTarget.scrollTop = 0
    window.dispatchEvent(new PopStateEvent("popstate"))
    navigationMock.pathname = "/applications"
    navigationMock.searchParams = new URLSearchParams("status=applied")
    rerender(
      <>
        <NavigationScrollRestoration />
        <main data-scroll-restoration-target style={{ height: 200, overflowY: "auto" }}>
          <div style={{ height: 1000 }} />
        </main>
      </>
    )

    vi.runOnlyPendingTimers()

    expect(document.querySelector<HTMLElement>("[data-scroll-restoration-target]")?.scrollTop).toBe(640)
  })
})
