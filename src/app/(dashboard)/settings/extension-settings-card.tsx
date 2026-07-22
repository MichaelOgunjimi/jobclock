"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { generateExtensionToken, revokeExtensionToken } from "./actions"
import type { PersonalApiTokenMetadata } from "@/lib/personal-api-tokens"

function formatDate(value: string | null) {
  if (!value) return "Never used"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function maskTokenPrefix(prefix: string) {
  return `${prefix}••••••••`
}

export function ExtensionSettingsCard({
  initialToken,
}: {
  initialToken: PersonalApiTokenMetadata | null
}) {
  const [tokenMetadata, setTokenMetadata] = useState<PersonalApiTokenMetadata | null>(initialToken)
  const [rawToken, setRawToken] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateExtensionToken()
      if (result?.error) {
        toast.error(result.error)
        return
      }

      setRawToken(result.token ?? null)
      setTokenMetadata(result.metadata ?? null)
      toast.success(tokenMetadata ? "Extension token regenerated" : "Extension token created")
    })
  }

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeExtensionToken()
      if (result?.error) {
        toast.error(result.error)
        return
      }

      setRawToken(null)
      setTokenMetadata(null)
      toast.success("Extension token revoked")
    })
  }

  return (
    <Card>
      <CardHeader className="border-b pb-6">
        <p className="section-label">Extension</p>
        <CardTitle>Browser Extension Access</CardTitle>
        <CardDescription>
          Generate a personal token for the JobClock Chrome extension. The extension
          is pending Chrome Web Store review. Existing local installations can still
          connect to the production JobClock site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">
              {tokenMetadata ? "Active token" : "No active token"}
            </Badge>
            <p className="text-xs text-muted-foreground">
              The token is stored locally by Chrome and can be revoked here at any time.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleGenerate} disabled={isPending}>
              {isPending ? "Working…" : tokenMetadata ? "Regenerate Token" : "Generate Token"}
            </Button>
            <Button variant="outline" onClick={handleRevoke} disabled={isPending || !tokenMetadata}>
              Revoke Token
            </Button>
          </div>
        </div>

        {rawToken && (
          <div className="space-y-2 border bg-secondary/40 p-4">
            <p className="text-sm font-medium text-foreground">Copy this token now</p>
            <p className="text-xs text-muted-foreground">
              For security, the full token is only shown once after generation.
            </p>
            <Input readOnly value={rawToken} aria-label="Extension token" />
          </div>
        )}

        <Separator />

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">Token Prefix</p>
            <p className="text-sm text-foreground">
              {tokenMetadata ? maskTokenPrefix(tokenMetadata.tokenPrefix) : "Not generated"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">Created</p>
            <p className="text-sm text-foreground">
              {tokenMetadata ? formatDate(tokenMetadata.createdAt) : "Not generated"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">Last Used</p>
            <p className="text-sm text-foreground">
              {tokenMetadata ? formatDate(tokenMetadata.lastUsedAt) : "Never"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">Expires</p>
            <p className="text-sm text-foreground">
              {tokenMetadata ? formatDate(tokenMetadata.expiresAt) : "Not generated"}
            </p>
          </div>
        </div>

        <div className="space-y-2 border p-4">
          <p className="text-sm font-medium text-foreground">Extension setup</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>The Chrome Web Store submission is pending review.</li>
            <li>If you already installed the extension locally, keep using that copy during review.</li>
            <li>Open the extension popup and paste the token shown after generation.</li>
            <li>Open a job page and click JobClock to preview and save the role.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
