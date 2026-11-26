"use client"

import { useEffect } from "react"
import { captureBrowserTimezone } from "@/app/(dashboard)/timezone-actions"

/** Rendered only while the profile has no timezone: saves the browser's once, silently. */
export function TimezoneCapture() {
  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (timezone) void captureBrowserTimezone(timezone)
  }, [])
  return null
}
