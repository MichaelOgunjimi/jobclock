export default function JobsLoading() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="space-y-3">
          <div className="h-3 w-12 animate-pulse bg-secondary" />
          <div className="h-10 w-96 animate-pulse bg-secondary" />
          <div className="h-4 w-72 animate-pulse bg-secondary" />
        </div>
      </div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-11 w-36 animate-pulse bg-secondary border border-border" />
        ))}
        <div className="h-11 w-24 animate-pulse bg-secondary border border-border" />
      </div>
      {/* Job cards */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border border-border p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-5 w-64 animate-pulse bg-secondary" />
                <div className="h-3 w-40 animate-pulse bg-secondary" />
              </div>
              <div className="h-8 w-20 animate-pulse bg-secondary" />
            </div>
            <div className="h-3 w-full animate-pulse bg-secondary" />
            <div className="h-3 w-3/4 animate-pulse bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  )
}
