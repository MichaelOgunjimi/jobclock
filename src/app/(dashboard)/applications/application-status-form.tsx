"use client"

import { useFormStatus } from "react-dom"
import { CircleDot, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { SelectInput } from "@/components/ui/select"

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
  const canChange = statusOptions.some((option) => option.value !== currentStatus)

  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
      <div className="w-full space-y-2 sm:w-auto">
        <Label htmlFor={selectId} className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Stage
        </Label>
        <div className="relative w-full">
          <CircleDot className="pointer-events-none absolute top-1/2 left-3.5 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <SelectInput
            id={selectId}
            name="status"
            defaultValue={currentStatus}
            disabled={pending || !canChange}
            options={statusOptions}
            className="min-w-0 pl-10 disabled:cursor-wait disabled:opacity-60 sm:min-w-[15rem]"
          />
        </div>
      </div>
      <Button type="submit" size="default" className="w-full sm:w-auto" disabled={pending || !canChange} aria-live="polite">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating stage…
          </>
        ) : (
          canChange ? "Update stage" : "Closed"
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
          Move this role forward or record a closed outcome.
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
