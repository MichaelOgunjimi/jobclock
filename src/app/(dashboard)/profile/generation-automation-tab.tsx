"use client"

import { useState, useTransition } from "react"
import { FileText, ToggleLeft, ToggleRight, WandSparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { saveGenerationAutomation } from "./actions"

function AutomationToggle({
  checked,
  label,
  onToggle,
}: {
  checked: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors",
        checked
          ? "border-foreground/30 bg-foreground text-background"
          : "border-border bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {checked ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
      {checked ? "Enabled" : "Disabled"}
    </button>
  )
}

export function GenerationAutomationTab({
  initialGenerateCv,
  initialGenerateCoverLetter,
}: {
  initialGenerateCv: boolean
  initialGenerateCoverLetter: boolean
}) {
  const [generateCv, setGenerateCv] = useState(initialGenerateCv)
  const [generateCoverLetter, setGenerateCoverLetter] = useState(initialGenerateCoverLetter)
  const [saved, setSaved] = useState({
    generateCv: initialGenerateCv,
    generateCoverLetter: initialGenerateCoverLetter,
  })
  const [isPending, startTransition] = useTransition()

  const isDirty =
    generateCv !== saved.generateCv || generateCoverLetter !== saved.generateCoverLetter

  function handleSave() {
    if (!isDirty) return
    startTransition(async () => {
      const result = await saveGenerationAutomation({ generateCv, generateCoverLetter })
      if (result.error) {
        toast.error(result.error)
        return
      }

      setSaved({ generateCv, generateCoverLetter })
      toast.success("Generation automation saved")
    })
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Generate application documents automatically</CardTitle>
        <CardDescription>
          Choose what JobClock prepares in the background whenever you add a new job. Existing jobs are not regenerated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        <div className="flex flex-col gap-4 border-b border-border py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center border bg-secondary text-muted-foreground">
              <WandSparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Tailored CV</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Tailor your primary CV to the new role and make it available on the application.
              </p>
            </div>
          </div>
          <AutomationToggle
            checked={generateCv}
            label="Automatically generate tailored CV"
            onToggle={() => setGenerateCv((value) => !value)}
          />
        </div>

        <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center border bg-secondary text-muted-foreground">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Cover letter</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Draft a cover letter using your primary CV and current writing style.
              </p>
            </div>
          </div>
          <AutomationToggle
            checked={generateCoverLetter}
            label="Automatically generate cover letter"
            onToggle={() => setGenerateCoverLetter((value) => !value)}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            Automatic generation requires a primary CV and a configured AI provider. A generation failure will not prevent the job from being saved.
          </p>
          <Button type="button" onClick={handleSave} disabled={!isDirty || isPending}>
            {isPending ? "Saving…" : "Save automation"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
