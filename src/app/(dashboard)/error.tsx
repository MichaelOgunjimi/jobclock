"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { buttonVariants } from "@/components/ui/button-styles"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="page-shell max-w-2xl">
      <div className="flex flex-col items-start gap-6 py-12">
        <p className="page-kicker">Error</p>
        <h1 className="page-title">Something went wrong</h1>
        <p className="text-[15px] leading-7 text-muted-foreground">
          An unexpected error occurred on this page.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={reset} variant="outline">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}>
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
