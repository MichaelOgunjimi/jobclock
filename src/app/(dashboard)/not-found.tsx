import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { buttonVariants } from "@/components/ui/button-styles"

export default function DashboardNotFound() {
  return (
    <div className="page-shell max-w-2xl">
      <div className="flex flex-col items-start gap-6 py-12">
        <p className="page-kicker">404</p>
        <h1 className="page-title">Page not found</h1>
        <p className="text-[15px] leading-7 text-muted-foreground">
          This page doesn&apos;t exist or you may not have access to it.
        </p>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
