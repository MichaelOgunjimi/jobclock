"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PROVIDER_MODELS, type AiProvider, type AiSettings } from "@/lib/ai"
import { saveAiSettings } from "./actions"
import { toast } from "sonner"
import { CheckCircle, Eye, EyeOff, KeyRound } from "lucide-react"

type KeySource = "saved" | "env" | "none"

const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
}

function KeyStatusBadge({ source }: { source: KeySource }) {
  if (source === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
        <CheckCircle className="h-3 w-3" /> Key saved in settings
      </span>
    )
  }
  if (source === "env") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <KeyRound className="h-3 w-3" /> Using environment variable
      </span>
    )
  }
  return (
    <span className="text-xs text-destructive">No key configured</span>
  )
}

function ApiKeyInput({
  name,
  label,
  source,
  onTyped,
}: {
  name: string
  label: string
  source: KeySource
  onTyped?: () => void
}) {
  const [show, setShow] = useState(false)
  const placeholder = source === "none" ? "Enter your API key" : "Enter new key to replace existing"

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={name}>{label}</Label>
        <KeyStatusBadge source={source} />
      </div>
      <div className="relative">
        <Input
          id={name}
          name={name}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          autoComplete="off"
          className="pr-10"
          onChange={(e) => { if (e.target.value) onTyped?.() }}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export function AiSettingsForm({
  current,
  keyStatus,
}: {
  current: AiSettings
  keyStatus: { anthropic: KeySource; openai: KeySource }
}) {
  const [provider, setProvider] = useState<AiProvider>(current.provider)
  const [model, setModel] = useState(current.model)
  const [hasKeyInput, setHasKeyInput] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isDirty = provider !== current.provider || model !== current.model || hasKeyInput

  function handleProviderChange(next: AiProvider) {
    setProvider(next)
    setModel(PROVIDER_MODELS[next][0].id)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isDirty) return
    const formData = new FormData(e.currentTarget)
    formData.set("provider", provider)
    formData.set("model", model)

    startTransition(async () => {
      const result = await saveAiSettings(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Settings saved")
        setHasKeyInput(false)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <Label>Provider</Label>
        <div className="grid grid-cols-2 gap-3">
          {(["anthropic", "openai"] as AiProvider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleProviderChange(p)}
              className={[
                "flex items-center justify-between border p-4 text-left transition-colors",
                provider === p
                  ? "border-foreground bg-secondary"
                  : "border-border hover:border-foreground/50",
              ].join(" ")}
            >
              <div>
                <p className="text-sm font-medium">{PROVIDER_LABELS[p]}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p === "anthropic" ? "Claude models" : "GPT models"}
                </p>
              </div>
              {provider === p && (
                <CheckCircle className="h-4 w-4 text-foreground shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <select
          id="model"
          name="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="flex h-11 w-full border border-input bg-muted px-4 py-2 text-[13px] tracking-[0.02em] outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/15 appearance-none"
        >
          {PROVIDER_MODELS[provider].map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4 rounded border border-border p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">API Keys</p>
        <ApiKeyInput
          name="anthropic_api_key"
          label="Anthropic API Key"
          source={keyStatus.anthropic}
          onTyped={() => setHasKeyInput(true)}
        />
        <ApiKeyInput
          name="openai_api_key"
          label="OpenAI API Key"
          source={keyStatus.openai}
          onTyped={() => setHasKeyInput(true)}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to keep existing key. Keys are stored securely and only accessible to you.
        </p>
      </div>

      <Button type="submit" disabled={!isDirty || isPending}>
        {isPending ? "Saving…" : "Save Settings"}
      </Button>
    </form>
  )
}
