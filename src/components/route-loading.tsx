import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function RouteLoading({ label }: { label: string }) {
  return (
    <div className="page-shell" role="status" aria-label={`Loading ${label}`}>
      <div className="page-header">
        <div className="space-y-3">
          <div className="h-3 w-20 animate-pulse bg-secondary" />
          <div className="space-y-2">
            <div className="h-12 w-full max-w-lg animate-pulse bg-secondary sm:w-[30rem]" />
            <div className="h-4 w-full max-w-2xl animate-pulse bg-secondary sm:w-[38rem]" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-3 border-b pb-5">
              <div className="h-3 w-20 animate-pulse bg-secondary" />
              <div className="h-6 w-36 animate-pulse bg-secondary" />
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <div className="h-4 w-full animate-pulse bg-secondary" />
              <div className="h-4 w-4/5 animate-pulse bg-secondary" />
              <div className="h-10 w-full animate-pulse bg-secondary" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
