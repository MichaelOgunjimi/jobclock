import { Card } from "@/components/ui/card"

const statusFilters = Array.from({ length: 9 })
const applicationCards = Array.from({ length: 8 })

export default function ApplicationsLoading() {
  return (
    <div className="page-shell" role="status" aria-label="Loading applications">
      <div className="page-header">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse bg-secondary" />
          <div className="space-y-2">
            <div className="h-12 w-full max-w-2xl animate-pulse bg-secondary sm:w-[34rem]" />
            <div className="h-4 w-full max-w-2xl animate-pulse bg-secondary sm:w-[38rem]" />
          </div>
        </div>
        <div className="h-11 w-full animate-pulse bg-secondary md:w-28" />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 border border-border bg-secondary/35 px-5 py-4">
          <div className="h-9 w-full animate-pulse border border-border bg-background" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((_, index) => (
                <div key={index} className="h-8 w-20 animate-pulse border border-border bg-background" />
              ))}
            </div>
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
              <div className="h-3 w-8 animate-pulse bg-secondary" />
              <div className="h-8 min-w-0 flex-1 animate-pulse border border-border bg-background sm:w-32 sm:flex-none" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border border-border bg-secondary/35 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-4 w-56 animate-pulse bg-secondary" />
          <div className="h-4 w-24 animate-pulse bg-secondary" />
        </div>

        {applicationCards.map((_, index) => (
          <Card key={index} className="gap-0 border-border/90 py-0">
            <div className="space-y-5 px-5 py-6 sm:px-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="h-3 w-36 animate-pulse bg-secondary" />
                  <div className="h-7 w-72 max-w-full animate-pulse bg-secondary" />
                </div>
                <div className="h-9 w-24 animate-pulse bg-secondary" />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="h-8 w-32 animate-pulse border border-border bg-secondary" />
                <div className="h-8 w-36 animate-pulse border border-border bg-secondary" />
                <div className="h-8 w-28 animate-pulse border border-border bg-secondary" />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="h-4 w-72 max-w-full animate-pulse bg-secondary" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-9 w-28 animate-pulse bg-secondary" />
                  <div className="h-9 w-32 animate-pulse bg-secondary" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
