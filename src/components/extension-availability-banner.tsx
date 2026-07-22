import Link from "next/link"
import { ArrowRight, ExternalLink, Puzzle, Rocket } from "lucide-react"
import { buttonVariants } from "@/components/ui/button-styles"
import { CHROME_WEB_STORE_URL } from "@/lib/extension"
import { cn } from "@/lib/utils"

export function ExtensionAvailabilityBanner({
  compact = false,
}: {
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border bg-secondary/60",
        compact ? "px-4 py-3" : "p-4 sm:p-5",
      )}
    >
      <div
        className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--accent)_16%,transparent),transparent_65%)]"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center border bg-background">
            <Puzzle className="size-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <Rocket className="size-3" />
                Available on Chrome
              </span>
            </div>
            <p className={cn("font-semibold tracking-[-0.02em]", compact ? "text-sm" : "text-base")}>
              Install the JobClock Chrome extension.
            </p>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Capture the job listing in your active tab, review the details,
              and save it directly to your JobClock pipeline.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:items-center">
          <a
            href={CHROME_WEB_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ size: "sm" })}
          >
            Add to Chrome
            <ExternalLink className="size-3.5" />
          </a>
          <Link
            href="/extension/support"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "bg-background")}
          >
            Setup guide
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
