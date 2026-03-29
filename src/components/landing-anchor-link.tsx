"use client"

import Link from "next/link"
import { MouseEvent, ReactNode } from "react"

type LandingAnchorLinkProps = {
  href: `#${string}`
  children: ReactNode
  className?: string
  onNavigate?: () => void
}

export function LandingAnchorLink({ href, children, className, onNavigate }: LandingAnchorLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const targetId = href.slice(1)
    const target = document.getElementById(targetId)

    if (!target) {
      return
    }

    event.preventDefault()

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    })

    window.history.replaceState(null, "", href)
    onNavigate?.()
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  )
}
