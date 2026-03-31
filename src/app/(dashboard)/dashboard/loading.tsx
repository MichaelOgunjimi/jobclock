export default function DashboardLoading() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="space-y-3">
          <div className="h-3 w-16 animate-pulse bg-secondary" />
          <div className="h-10 w-80 animate-pulse bg-secondary" />
          <div className="h-4 w-64 animate-pulse bg-secondary" />
        </div>
      </div>
      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="h-3 w-6 animate-pulse bg-secondary" />
              <div className="h-11 w-11 animate-pulse bg-secondary" />
            </div>
            <div className="space-y-3">
              <div className="h-12 w-16 animate-pulse bg-secondary" />
              <div className="space-y-1">
                <div className="h-4 w-32 animate-pulse bg-secondary" />
                <div className="h-3 w-48 animate-pulse bg-secondary" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Recent + Quick actions */}
      <div className="grid gap-8 xl:grid-cols-[1.55fr_0.95fr]">
        <div className="border border-border">
          <div className="border-b bg-secondary/20 p-6 space-y-3">
            <div className="h-3 w-24 animate-pulse bg-secondary" />
            <div className="h-7 w-48 animate-pulse bg-secondary" />
          </div>
          <div className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
                <div className="space-y-2">
                  <div className="h-5 w-48 animate-pulse bg-secondary" />
                  <div className="h-3 w-32 animate-pulse bg-secondary" />
                </div>
                <div className="h-6 w-16 animate-pulse bg-secondary" />
              </div>
            ))}
          </div>
        </div>
        <div className="border border-border bg-secondary/60 p-6 space-y-4">
          <div className="h-3 w-20 animate-pulse bg-muted" />
          <div className="h-6 w-32 animate-pulse bg-muted" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
