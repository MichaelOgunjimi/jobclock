export default function ApplicationsLoading() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse bg-secondary" />
          <div className="h-10 w-72 animate-pulse bg-secondary" />
          <div className="h-4 w-56 animate-pulse bg-secondary" />
        </div>
      </div>
      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse bg-secondary border border-border" />
        ))}
      </div>
      {/* Application rows */}
      <div className="space-y-px border border-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 bg-background px-6 py-4">
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-48 animate-pulse bg-secondary" />
              <div className="h-3 w-32 animate-pulse bg-secondary" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-6 w-20 animate-pulse bg-secondary" />
              <div className="h-3 w-24 animate-pulse bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
