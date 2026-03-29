import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button-styles"

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-md space-y-6 text-center">
        <p className="page-kicker">404</p>
        <h1 className="text-[3rem] font-medium leading-[0.95] tracking-[-0.05em]">
          Page not found
        </h1>
        <p className="text-[15px] leading-7 text-muted-foreground">
          This page doesn&apos;t exist or may have been moved.
        </p>
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Back to home
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  )
}
