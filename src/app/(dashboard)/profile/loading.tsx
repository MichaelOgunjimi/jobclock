import { Card } from "@/components/ui/card"

const cvCards = Array.from({ length: 4 })

export default function ProfileLoading() {
  return (
    <div className="page-shell max-w-5xl" role="status" aria-label="Loading profile">
      <div className="page-header">
        <div className="space-y-3">
          <div className="h-3 w-14 animate-pulse bg-secondary" />
          <div className="space-y-2">
            <div className="h-12 w-56 animate-pulse bg-secondary" />
            <div className="h-4 w-72 max-w-full animate-pulse bg-secondary" />
          </div>
        </div>
      </div>

      <div className="mb-8 flex border-b border-border">
        <div className="h-10 w-16 animate-pulse bg-secondary" />
        <div className="h-10 w-32 animate-pulse bg-secondary" />
        <div className="h-10 w-28 animate-pulse bg-secondary" />
      </div>

      <div className="mb-4 flex justify-end">
        <div className="h-11 w-28 animate-pulse bg-secondary" />
      </div>

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-2">
        {cvCards.map((_, index) => (
          <Card key={index} size="sm" className="gap-0 border-border/90 py-0">
            <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-4">
                <div className="space-y-2">
                  <div className="h-3 w-16 animate-pulse bg-secondary" />
                  <div className="h-3 w-32 animate-pulse bg-secondary" />
                </div>
                <div className="h-9 w-9 animate-pulse border border-border bg-secondary" />
              </div>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 shrink-0 animate-pulse border border-border bg-secondary" />
                <div className="space-y-2">
                  <div className="h-5 w-40 animate-pulse bg-secondary" />
                  <div className="h-3 w-24 animate-pulse bg-secondary" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, skillIndex) => (
                  <div key={skillIndex} className="h-7 w-20 animate-pulse border border-border bg-secondary" />
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/80 pt-4">
                <div className="h-3 w-32 animate-pulse bg-secondary" />
                <div className="h-3 w-20 animate-pulse bg-secondary" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
