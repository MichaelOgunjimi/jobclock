const formFields = Array.from({ length: 6 })
const jobCards = Array.from({ length: 4 })

export default function JobsLoading() {
  return (
    <div className="page-shell" role="status" aria-label="Loading roles">
      <div className="page-header">
        <div className="space-y-3">
          <div className="h-3 w-12 animate-pulse bg-secondary" />
          <div className="space-y-2">
            <div className="h-12 w-full max-w-2xl animate-pulse bg-secondary sm:w-[38rem]" />
            <div className="h-4 w-full max-w-2xl animate-pulse bg-secondary sm:w-[34rem]" />
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-8">
        <div className="h-11 w-full animate-pulse border border-border bg-secondary xl:hidden" />

        <aside className="hidden space-y-6 border bg-secondary p-6 xl:block">
          <div className="space-y-2">
            <div className="h-3 w-14 animate-pulse bg-muted" />
            <div className="h-8 w-44 animate-pulse bg-muted" />
          </div>
          <div className="space-y-5">
            {formFields.map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-3 w-24 animate-pulse bg-muted" />
                <div className="h-11 w-full animate-pulse border border-border bg-background" />
              </div>
            ))}
            <div className="space-y-2">
              <div className="h-3 w-28 animate-pulse bg-muted" />
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-7 w-16 animate-pulse border border-border bg-background" />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-16 animate-pulse bg-muted" />
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-7 w-16 animate-pulse border border-border bg-background" />
                ))}
              </div>
            </div>
            <div className="h-11 w-full animate-pulse bg-muted" />
          </div>
        </aside>

        <div className="min-h-0 min-w-0 border">
          <div className="flex flex-col gap-3 border-b px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse bg-secondary" />
              <div className="h-8 w-24 animate-pulse bg-secondary" />
            </div>
            <div className="h-3 w-72 max-w-full animate-pulse bg-secondary" />
          </div>
          <div className="h-auto space-y-3 overflow-hidden p-4 md:p-6 xl:h-[calc(100dvh-22rem)]">
            {jobCards.map((_, index) => (
              <div key={index} className="border bg-card">
                <div className="border-b px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="h-5 w-64 max-w-full animate-pulse bg-secondary" />
                      <div className="h-4 w-36 animate-pulse bg-secondary" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 w-16 animate-pulse bg-secondary" />
                      <div className="h-6 w-20 animate-pulse bg-secondary" />
                    </div>
                  </div>
                </div>
                <div className="space-y-3 px-4 py-4 sm:px-5">
                  <div className="flex gap-4">
                    <div className="h-3 w-28 animate-pulse bg-secondary" />
                    <div className="h-3 w-24 animate-pulse bg-secondary" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full animate-pulse bg-secondary" />
                    <div className="h-3 w-3/4 animate-pulse bg-secondary" />
                  </div>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                    <div className="h-9 w-full animate-pulse bg-secondary sm:w-28" />
                    <div className="h-9 w-full animate-pulse bg-secondary sm:w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
