"use client"

import { useState, useTransition } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { saveDocumentTemplate } from "./actions"

interface TemplateOption {
  value: string
  label: string
  description: string
}

interface Props {
  type: "cv" | "cover_letter"
  current: string
  options: TemplateOption[]
}

export function TemplatePicker({ type, current, options }: Props) {
  const [selected, setSelected] = useState(current)
  const [, startTransition] = useTransition()

  function handleSelect(value: string) {
    const prev = selected
    setSelected(value)
    startTransition(async () => {
      const result = await saveDocumentTemplate(type, value)
      if (result?.error) {
        toast.error("Failed to save preference")
        setSelected(prev)
      }
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => handleSelect(opt.value)}
          className={cn(
            "relative flex flex-col gap-1.5 border p-4 text-left transition-colors",
            selected === opt.value
              ? "border-foreground bg-secondary"
              : "border-border hover:border-foreground/40 hover:bg-secondary/50",
          )}
        >
          {selected === opt.value && (
            <span className="absolute right-3 top-3 flex size-4 items-center justify-center rounded-full bg-foreground text-background">
              <Check className="h-2.5 w-2.5" />
            </span>
          )}
          <span className="text-sm font-medium">{opt.label}</span>
          <span className="text-xs text-muted-foreground">{opt.description}</span>
        </button>
      ))}
    </div>
  )
}
