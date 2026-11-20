"use client"

import { useState, useTransition } from "react"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EMAIL_CATEGORIES, type EmailPreferences } from "@/lib/email/categories"
import { cn } from "@/lib/utils"
import { saveEmailPreference } from "./actions"

export function EmailSettingsCard({ initial }: { initial: EmailPreferences }) {
  const [preferences, setPreferences] = useState(initial)
  const [, startTransition] = useTransition()

  function toggle(id: string, column: keyof EmailPreferences) {
    const enabled = !preferences[column]
    setPreferences((prev) => ({ ...prev, [column]: enabled }))
    startTransition(async () => {
      const result = await saveEmailPreference(id, enabled)
      if (result.error) {
        setPreferences((prev) => ({ ...prev, [column]: !enabled }))
        toast.error(result.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader className="border-b pb-6">
        <p className="section-label">Emails</p>
        <CardTitle>Email notifications</CardTitle>
        <CardDescription>
          Everything here is off until you turn it on, and every email has an unsubscribe link. Billing and account emails are always sent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-6">
        {EMAIL_CATEGORIES.map(({ id, column, label, description }) => {
          const on = preferences[column]
          return (
            <button
              key={id}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => toggle(id, column)}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 border px-4 py-3 text-left transition-colors",
                on ? "border-foreground/15 bg-secondary text-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center border transition-colors",
                  on ? "border-foreground bg-foreground text-background" : "border-border bg-secondary text-transparent"
                )}
              >
                <Check className="h-4 w-4" />
              </span>
              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
