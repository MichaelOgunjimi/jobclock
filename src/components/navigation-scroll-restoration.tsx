"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"

const STORAGE_PREFIX = "jobclock:scroll:"
const HISTORY_SCROLL_STATE_KEY = "__jobclockScroll"
const WINDOW_NAME_PREFIX = "jobclock-scroll:"
const SCROLL_COOKIE_NAME = "jobclock-scroll-state"
const memoryScrollPositions = new Map<string, string>()

export function NavigationScrollRestoration() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
  const currentKeyRef = useRef(routeKey)
  const restoreNextRouteRef = useRef(false)
  const pendingLinkNavigationRef = useRef(false)

  useEffect(() => {
    const browserHistory = window.history as History | undefined
    const canControlScrollRestoration =
      browserHistory !== undefined && "scrollRestoration" in browserHistory
    const originalScrollRestoration = canControlScrollRestoration
      ? browserHistory.scrollRestoration
      : "auto"

    if (canControlScrollRestoration) {
      browserHistory.scrollRestoration = "manual"
    }

    function saveCurrentScroll() {
      saveScroll(currentKeyRef.current, getScrollPosition())
    }

    function saveBeforeInternalLinkNavigation(event: MouseEvent) {
      const eventTarget = event.target as { closest?: (selector: string) => HTMLAnchorElement | null } | null

      const anchor =
        eventTarget && typeof eventTarget.closest === "function"
          ? eventTarget.closest("a[href]")
          : null
      if (!anchor || anchor.target || event.defaultPrevented) return

      const nextUrl = new URL(anchor.href)
      const currentUrl = new URL(window.location.href)
      const nextKey = `${nextUrl.pathname}${nextUrl.search}`
      const currentKey = `${currentUrl.pathname}${currentUrl.search}`

      if (nextUrl.origin !== currentUrl.origin || nextKey === currentKey) return

      saveCurrentScroll()
      pendingLinkNavigationRef.current = true
    }

    function markBackForwardNavigation() {
      saveCurrentScroll()
      restoreNextRouteRef.current = true
    }

    document.addEventListener("click", saveBeforeInternalLinkNavigation, { capture: true })
    window.addEventListener("pagehide", saveCurrentScroll)
    window.addEventListener("popstate", markBackForwardNavigation)

    return () => {
      document.removeEventListener("click", saveBeforeInternalLinkNavigation, { capture: true })
      window.removeEventListener("pagehide", saveCurrentScroll)
      window.removeEventListener("popstate", markBackForwardNavigation)
      if (canControlScrollRestoration) {
        browserHistory.scrollRestoration = originalScrollRestoration
      }
    }
  }, [])

  useEffect(() => {
    const scrollTarget = getScrollTarget()

    function saveRouteScroll() {
      if (pendingLinkNavigationRef.current && getScrollPosition(scrollTarget) === 0) return
      saveScroll(routeKey, getScrollPosition(scrollTarget))
    }

    scrollTarget.addEventListener("scroll", saveRouteScroll, { passive: true })

    return () => {
      saveRouteScroll()
      scrollTarget.removeEventListener("scroll", saveRouteScroll)
    }
  }, [routeKey])

  useEffect(() => {
    const previousKey = currentKeyRef.current
    const wasLinkNavigation = pendingLinkNavigationRef.current
    pendingLinkNavigationRef.current = false

    if (previousKey !== routeKey && !wasLinkNavigation) {
      saveScroll(previousKey, getScrollPosition())
    }

    currentKeyRef.current = routeKey

    const shouldRestoreSavedScroll =
      restoreNextRouteRef.current || getScrollPosition() === 0
    restoreNextRouteRef.current = false
    if (!shouldRestoreSavedScroll) return

    const savedScroll = readScroll(routeKey)
    if (savedScroll === null) return

    window.setTimeout(() => {
      scrollToPosition(savedScroll)
    }, 0)
  }, [routeKey])

  return null
}

function getScrollTarget(): Window | HTMLElement {
  const appScrollTarget = document.querySelector<HTMLElement>("[data-scroll-restoration-target]")
  if (appScrollTarget) return appScrollTarget
  if (document.scrollingElement) return document.scrollingElement as HTMLElement
  return window
}

function getScrollPosition(target = getScrollTarget()) {
  if (target === window) return window.scrollY
  return (target as HTMLElement).scrollTop
}

function scrollToPosition(top: number) {
  const target = getScrollTarget()

  if (target === window) {
    window.scrollTo({ top, left: 0, behavior: "auto" })
    return
  }

  const scrollTarget = target as HTMLElement
  scrollTarget.scrollTop = top
  scrollTarget.scrollLeft = 0
}

function saveScroll(key: string, scrollY: number) {
  const value = String(Math.max(0, Math.round(scrollY)))
  const storageKey = `${STORAGE_PREFIX}${key}`
  memoryScrollPositions.set(storageKey, value)
  writeWindowNameScroll(storageKey, value)
  writeCookieScroll(storageKey, value)

  try {
    const historyState = window.history.state && typeof window.history.state === "object" ? window.history.state : {}
    const existingScrollState =
      HISTORY_SCROLL_STATE_KEY in historyState &&
      typeof historyState[HISTORY_SCROLL_STATE_KEY] === "object" &&
      historyState[HISTORY_SCROLL_STATE_KEY] !== null
        ? historyState[HISTORY_SCROLL_STATE_KEY]
        : {}

    window.history.replaceState(
      {
        ...historyState,
        [HISTORY_SCROLL_STATE_KEY]: {
          ...existingScrollState,
          [storageKey]: value,
        },
      },
      "",
      window.location.href
    )
  } catch {
    // Some browsers restrict history state writes; storage/memory fallbacks remain.
  }

  try {
    window.sessionStorage.setItem(storageKey, value)
  } catch {
    // Ignore storage failures; browser-native navigation still works.
  }
}

function readScroll(key: string) {
  const storageKey = `${STORAGE_PREFIX}${key}`

  const historyValue = readHistoryScroll(storageKey)
  if (historyValue !== null) return historyValue

  const windowNameValue = readWindowNameScroll(storageKey)
  if (windowNameValue !== null) return windowNameValue

  const cookieValue = readCookieScroll(storageKey)
  if (cookieValue !== null) return cookieValue

  try {
    const value = window.sessionStorage.getItem(storageKey) ?? memoryScrollPositions.get(storageKey)
    if (!value) return null
    const scrollY = Number(value)
    return Number.isFinite(scrollY) ? scrollY : null
  } catch {
    const value = memoryScrollPositions.get(storageKey)
    if (!value) return null
    const scrollY = Number(value)
    return Number.isFinite(scrollY) ? scrollY : null
  }
}

function readWindowNameScroll(storageKey: string) {
  try {
    if (!window.name.startsWith(WINDOW_NAME_PREFIX)) return null
    const scrollState = JSON.parse(window.name.slice(WINDOW_NAME_PREFIX.length))
    const scrollY = Number(scrollState[storageKey])
    return Number.isFinite(scrollY) ? scrollY : null
  } catch {
    return null
  }
}

function writeWindowNameScroll(storageKey: string, value: string) {
  try {
    const scrollState = window.name.startsWith(WINDOW_NAME_PREFIX)
      ? JSON.parse(window.name.slice(WINDOW_NAME_PREFIX.length))
      : {}
    window.name = `${WINDOW_NAME_PREFIX}${JSON.stringify({
      ...scrollState,
      [storageKey]: value,
    })}`
  } catch {
    window.name = `${WINDOW_NAME_PREFIX}${JSON.stringify({ [storageKey]: value })}`
  }
}

function readCookieScroll(storageKey: string) {
  try {
    const cookieValue = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(`${SCROLL_COOKIE_NAME}=`))
      ?.split("=")[1]
    if (!cookieValue) return null
    const scrollState = JSON.parse(decodeURIComponent(cookieValue))
    const scrollY = Number(scrollState[storageKey])
    return Number.isFinite(scrollY) ? scrollY : null
  } catch {
    return null
  }
}

function writeCookieScroll(storageKey: string, value: string) {
  try {
    const existingCookie = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(`${SCROLL_COOKIE_NAME}=`))
      ?.split("=")[1]
    const scrollState = existingCookie ? JSON.parse(decodeURIComponent(existingCookie)) : {}
    const nextValue = encodeURIComponent(JSON.stringify({
      ...scrollState,
      [storageKey]: value,
    }))
    document.cookie = `${SCROLL_COOKIE_NAME}=${nextValue}; Max-Age=86400; Path=/; SameSite=Lax`
  } catch {
    document.cookie = `${SCROLL_COOKIE_NAME}=${encodeURIComponent(JSON.stringify({ [storageKey]: value }))}; Max-Age=86400; Path=/; SameSite=Lax`
  }
}

function readHistoryScroll(storageKey: string) {
  try {
    const historyState = window.history.state
    if (!historyState || typeof historyState !== "object") return null
    const scrollState = historyState[HISTORY_SCROLL_STATE_KEY]
    if (!scrollState || typeof scrollState !== "object") return null
    const scrollY = Number(scrollState[storageKey])
    return Number.isFinite(scrollY) ? scrollY : null
  } catch {
    return null
  }
}
