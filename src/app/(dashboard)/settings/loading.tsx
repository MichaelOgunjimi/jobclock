import { Card, CardContent, CardHeader } from "@/components/ui/card"

const settingsTabs = ["w-12", "w-24", "w-24", "w-24", "w-28", "w-28", "w-24"]

export default function SettingsLoading() {
  return (
    <div
      className="page-shell max-w-4xl gap-6 py-5 md:gap-8 md:py-8 lg:min-h-0 lg:flex-1"
      role="status"
      aria-label="Loading settings"
    >
      <div className="page-header gap-3 pb-5 md:pb-6">
        <div className="space-y-3">
          <div className="h-3 w-16 animate-pulse bg-secondary" />
          <div className="space-y-2">
            <div className="h-12 w-full max-w-md animate-pulse bg-secondary sm:w-96" />
            <div className="h-4 w-full max-w-2xl animate-pulse bg-secondary sm:w-[38rem]" />
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-border sm:mb-8 sm:flex-nowrap sm:overflow-hidden">
        {settingsTabs.map((width, index) => (
          <div key={index} className={`h-10 shrink-0 animate-pulse bg-secondary ${width}`} />
        ))}
      </div>

      <Card>
        <CardHeader className="border-b pb-6">
          <div className="h-3 w-6 animate-pulse bg-secondary" />
          <div className="h-6 w-44 animate-pulse bg-secondary" />
          <div className="h-3 w-full max-w-xl animate-pulse bg-secondary" />
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-3 border border-border bg-secondary/35 p-4 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="h-10 w-10 animate-pulse border border-border bg-background" />
            <div className="space-y-2">
              <div className="h-4 w-48 animate-pulse bg-secondary" />
              <div className="h-3 w-full max-w-lg animate-pulse bg-secondary" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-3 w-16 animate-pulse bg-secondary" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-20 animate-pulse border border-border bg-secondary" />
              <div className="h-20 animate-pulse border border-border bg-secondary" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-16 animate-pulse bg-secondary" />
            <div className="h-11 w-full animate-pulse border border-border bg-secondary" />
          </div>
          <div className="space-y-4 rounded border border-border p-4">
            <div className="h-3 w-16 animate-pulse bg-secondary" />
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-3 w-32 animate-pulse bg-secondary" />
                <div className="h-11 w-full animate-pulse bg-secondary" />
              </div>
            ))}
            <div className="h-3 w-full max-w-lg animate-pulse bg-secondary" />
          </div>
          <div className="space-y-4 rounded border border-border p-4">
            <div className="space-y-2">
              <div className="h-3 w-36 animate-pulse bg-secondary" />
              <div className="h-3 w-full max-w-xl animate-pulse bg-secondary" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-32 animate-pulse bg-secondary" />
              <div className="h-11 w-full animate-pulse bg-secondary" />
            </div>
          </div>
          <div className="h-11 w-32 animate-pulse bg-secondary" />
        </CardContent>
      </Card>
    </div>
  )
}
