export default function ProfileLoading() {
  return (
    <div className="page-shell max-w-5xl">
      <div className="page-header">
        <div className="space-y-3">
          <div className="h-3 w-14 animate-pulse bg-secondary" />
          <div className="h-10 w-56 animate-pulse bg-secondary" />
          <div className="h-4 w-80 animate-pulse bg-secondary" />
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 mb-8">
        {["CVs", "Cover Letters", "Preferences"].map((_, i) => (
          <div key={i} className="h-9 w-28 animate-pulse bg-secondary" />
        ))}
      </div>
      {/* Upload button */}
      <div className="flex justify-end mb-4">
        <div className="h-9 w-28 animate-pulse bg-secondary" />
      </div>
      {/* CV cards */}
      <div className="grid auto-rows-fr gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="space-y-1">
                <div className="h-3 w-16 animate-pulse bg-secondary" />
                <div className="h-3 w-32 animate-pulse bg-secondary" />
              </div>
              <div className="h-9 w-9 animate-pulse bg-secondary" />
            </div>
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 animate-pulse bg-secondary" />
              <div className="space-y-2">
                <div className="h-5 w-40 animate-pulse bg-secondary" />
                <div className="h-3 w-24 animate-pulse bg-secondary" />
              </div>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-7 w-20 animate-pulse bg-secondary" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
