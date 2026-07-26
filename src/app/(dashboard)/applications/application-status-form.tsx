"use client"

import { useFormStatus } from "react-dom"
import { ChevronDown, CircleDot, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface StatusOption {
  value: string
  label: string
  color: string
  dot: string
}

function ApplicationStatusControls({
  applicationId,
  currentStatus,
  statusOptions,
}: {
  applicationId: string
  currentStatus: string
  statusOptions: StatusOption[]
}) {
  const { pending } = useFormStatus()
  const selectId = `application-status-${applicationId}`

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="space-y-2">
        <Label htmlFor={selectId} className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Stage
        </Label>
        <div className="relative">
          <CircleDot className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            id={selectId}
            name="status"
            defaultValue={currentStatus}
            disabled={pending}
            className="form-select min-w-[15rem] bg-none pl-10 pr-14 disabled:cursor-wait disabled:opacity-60"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="submit" size="default" className="w-full sm:w-auto" disabled={pending} aria-live="polite">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating stage…
          </>
        ) : (
          "Update stage"
        )}
      </Button>
    </div>
  )
}

export function ApplicationStatusForm({
  applicationId,
  currentStatus,
  statusOptions,
  action,
}: {
  applicationId: string
  currentStatus: string
  statusOptions: StatusOption[]
  action: (formData: FormData) => void | Promise<void>
}) {
  return (
    <form
      action={action}
      className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Application status
        </p>
        <p className="text-sm text-muted-foreground">
          Move this role forward or back and keep the pipeline current.
        </p>
      </div>
      <ApplicationStatusControls
        applicationId={applicationId}
        currentStatus={currentStatus}
        statusOptions={statusOptions}
      />
    </form>
  )
}
