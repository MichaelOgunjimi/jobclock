import type { Metadata } from "next"

// Print routes are authenticated and only meant to be rendered into a
// PDF by Playwright or printed by the user — keep them out of search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return children
}
