import { Card, CardContent, CardHeader } from "@/components/ui/card"

const metricCards = Array.from({ length: 9 })
const recentApplications = Array.from({ length: 5 })

export default function DashboardLoading() {
  return (
    <div className="page-shell" role="status" aria-label="Loading dashboard">
      <div className="page-header">
        <div className="space-y-3">
          <div className="h-3 w-16 animate-pulse bg-secondary" />
          <div className="space-y-2">
            <div className="h-12 w-full max-w-lg animate-pulse bg-secondary sm:w-[30rem]" />
            <div className="h-4 w-full max-w-2xl animate-pulse bg-secondary sm:w-[34rem]" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="h-11 w-32 animate-pulse bg-secondary" />
          <div className="h-11 w-28 animate-pulse bg-secondary" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="h-3 w-32 animate-pulse bg-secondary" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {metricCards.map((_, index) => (
            <Card key={index} className="h-full bg-card py-4">
              <CardContent className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-5 animate-pulse bg-secondary" />
                  <div className="h-8 w-20 animate-pulse bg-secondary" />
                </div>
                <div className="space-y-2">
                  <div className="h-9 w-10 animate-pulse bg-secondary" />
                  <div className="space-y-1">
                    <div className="h-4 w-28 animate-pulse bg-secondary" />
                    <div className="h-3 w-full animate-pulse bg-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.55fr_0.95fr]">
        <Card className="border-border">
          <CardHeader className="space-y-3 border-b border-foreground/10 bg-secondary/40 pb-6">
            <div className="h-3 w-28 animate-pulse bg-secondary" />
            <div className="h-7 w-52 animate-pulse bg-secondary" />
            <div className="h-3 w-64 animate-pulse bg-secondary" />
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {recentApplications.map((_, index) => (
                <div key={index} className="-mx-6 flex items-start justify-between gap-4 px-6 py-5 first:pt-0 last:pb-0">
                  <div className="space-y-2">
                    <div className="h-5 w-48 animate-pulse bg-secondary" />
                    <div className="h-3 w-32 animate-pulse bg-secondary" />
                    <div className="h-3 w-24 animate-pulse bg-secondary" />
                  </div>
                  <div className="h-6 w-20 animate-pulse bg-secondary" />
                </div>
              ))}
            </div>
            <div className="mt-8 h-11 w-full animate-pulse bg-secondary" />
          </CardContent>
        </Card>

        <Card className="border-border bg-secondary/60">
          <CardHeader className="space-y-2 border-b pb-6">
            <div className="h-3 w-20 animate-pulse bg-muted" />
            <div className="h-6 w-32 animate-pulse bg-muted" />
            <div className="h-3 w-64 max-w-full animate-pulse bg-muted" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-11 w-full animate-pulse bg-muted" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
