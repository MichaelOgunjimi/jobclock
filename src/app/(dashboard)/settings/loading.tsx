export default function SettingsLoading() {
  return (
    <div className="page-shell max-w-4xl gap-6 py-5 md:gap-8 md:py-8">
      <div className="page-header gap-3 pb-5 md:pb-6">
        <div className="space-y-3">
          <div className="h-3 w-16 animate-pulse bg-secondary" />
          <div className="h-10 w-64 animate-pulse bg-secondary" />
          <div className="h-4 w-80 animate-pulse bg-secondary" />
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-28 animate-pulse bg-secondary" />
        ))}
      </div>
      {/* Form fields */}
      <div className="border border-border p-6 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 animate-pulse bg-secondary" />
            <div className="h-11 w-full animate-pulse bg-secondary" />
          </div>
        ))}
        <div className="h-10 w-32 animate-pulse bg-secondary" />
      </div>
    </div>
  )
}
