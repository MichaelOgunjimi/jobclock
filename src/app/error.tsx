"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowRight, RefreshCw } from "lucide-react"
import { buttonVariants } from "@/components/ui/button-styles"
import { Button } from "@/components/ui/button"

export default function GlobalError({
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-md space-y-6 text-center">
        <p className="page-kicker">Error</p>
        <h1 className="text-[3rem] font-medium leading-[0.95] tracking-[-0.05em]">
          Something went wrong
        </h1>
        <p className="text-[15px] leading-7 text-muted-foreground">
          An unexpected error occurred. Try refreshing or head back home.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset} variant="outline" size="lg">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Link href="/" className={buttonVariants({ size: "lg" })}>
            Back to home
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  )
}
