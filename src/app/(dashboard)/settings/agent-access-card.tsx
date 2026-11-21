"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { SelectInput } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { createAgentToken, revokeAgentToken } from "./actions"
import { DailyLimitEditor, formatDate, RecentActivity } from "./connection-details"
import { DEFAULT_TOKEN_ACCESS, DEFAULT_TOKEN_EXPIRY, describeExpiry, EXTRA_SCOPE_OPTIONS, extraScopeOptions, scopeLabel, TOKEN_EXPIRY_OPTIONS, type ExtraScope, type TokenAccess } from "@/lib/mcp/access-policy"
import type { ConnectionActivityItem } from "@/lib/mcp/activity"
import type { ApiTokenMetadata } from "@/lib/mcp/tokens"

const ACCESS_OPTIONS = [
  { value: "read", label: "Read only" },
  { value: "write", label: "Read + changes" },
] as const

export function AgentAccessCard({ tokens: initialTokens, mcpUrl, activity }: { tokens: ApiTokenMetadata[]; mcpUrl: string; activity: Record<string, ConnectionActivityItem[]> }) {
  const [tokens, setTokens] = useState(initialTokens)
  const [label, setLabel] = useState("")
  const [access, setAccess] = useState<TokenAccess>(DEFAULT_TOKEN_ACCESS)
  const [expiry, setExpiry] = useState(DEFAULT_TOKEN_EXPIRY)
  const [extras, setExtras] = useState<ExtraScope[]>([])
  const [rawToken, setRawToken] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createAgentToken(label, access, expiry, extras)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setRawToken(result.token)
      setTokens((current) => [result.metadata, ...current])
      setLabel("")
      setExtras([])
      toast.success("Token created. A notice was emailed to you.")
    })
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      const result = await revokeAgentToken(id)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setTokens((current) => current.map((token) => (token.id === id ? { ...token, revokedAt: new Date().toISOString() } : token)))
      toast.success("Token revoked")
    })
  }

  // The placeholder is only the secret itself, before it exists; once created the command carries the real token.
  const command = `claude mcp add --transport http jobclock ${mcpUrl} --header "Authorization: Bearer ${rawToken ?? "jc_YOUR_TOKEN"}"`

  return (
    <Card>
      <CardHeader className="border-b pb-6">
        <p className="section-label">Advanced</p>
        <CardTitle>Access tokens</CardTitle>
        <CardDescription>
          For agents that cannot sign in through the browser. You choose what a token may do and how long it lasts; it can never
          delete anything or spend AI credits. Prefer Connected apps above where you can.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="agent-token-label">Token name</Label>
            <Input
              id="agent-token-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Claude on my laptop"
              maxLength={60}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-token-access">Access</Label>
            <SelectInput id="agent-token-access" options={ACCESS_OPTIONS} value={access} onValueChange={setAccess} className="w-44" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-token-expiry">Expires</Label>
            <SelectInput id="agent-token-expiry" options={TOKEN_EXPIRY_OPTIONS.map(({ value, label }) => ({ value, label }))} value={expiry} onValueChange={setExpiry} className="w-44" />
          </div>
          <fieldset className="w-full space-y-2">
            <legend className="text-sm font-medium text-foreground">Private details (all off unless you tick them)</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {EXTRA_SCOPE_OPTIONS.map((option) => (
                <label key={option.scope} className="flex cursor-pointer gap-3 border p-3 has-[:checked]:border-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-foreground"
                    checked={extras.includes(option.scope)}
                    onChange={(event) => setExtras((current) => (event.target.checked ? [...current, option.scope] : current.filter((scope) => scope !== option.scope)))}
                  />
                  <span className="space-y-1">
                    <span className="block text-sm text-foreground">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" disabled={isPending || !label.trim()}>
            {isPending ? "Working…" : "Create token"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          {access === "read"
            ? "Read only: the agent can list and view applications, check for duplicates and read your job preferences."
            : "Read + changes: the agent can also change status, set follow-ups and interview times, add notes and add new saved jobs."}
          {extras.length > 0 ? " This token will also be able to use the private details you ticked." : ""}
          {" "}We email you when a token is created. The token itself is never emailed.
        </p>

        {rawToken && (
          <div className="space-y-2 border bg-secondary/40 p-4">
            <p className="text-sm font-medium text-foreground">Copy this token now</p>
            <p className="text-xs text-muted-foreground">
              For security, the full token is only shown once. Anyone holding it can use it until it expires or you revoke it.
            </p>
            <Input readOnly value={rawToken} aria-label="New agent token" onFocus={(event) => event.currentTarget.select()} />
          </div>
        )}

        <Separator />

        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
        ) : (
          <ul className="divide-y border">
            {tokens.map((token) => {
              const { text: expiring, expired } = describeExpiry(token.expiresAt)
              return (
                <li key={token.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{token.label}</p>
                        <Badge variant="outline">{scopeLabel(token.scopes)}</Badge>
                        {extraScopeOptions(token.scopes).map((option) => <Badge key={option.scope} variant="outline">{option.label}</Badge>)}
                        {token.revokedAt ? <Badge variant="outline">Revoked</Badge> : expired ? <Badge variant="destructive">Expired</Badge> : <Badge variant="outline">Active</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {token.tokenPrefix}•••• · Created {formatDate(token.createdAt, "")} · Last used {formatDate(token.lastUsedAt, "never")}
                      </p>
                      {!token.revokedAt && <p className="text-xs text-muted-foreground">{expiring}</p>}
                    </div>
                    {!token.revokedAt && (
                      <Button variant="outline" size="sm" onClick={() => handleRevoke(token.id)} disabled={isPending}>
                        {expired ? "Remove" : "Revoke"}
                      </Button>
                    )}
                  </div>
                  {!token.revokedAt && !expired && token.scopes.includes("applications:write") && <DailyLimitEditor kind="token" id={token.id} value={token.dailyCreateCap} />}
                  <RecentActivity items={activity[token.id] ?? []} />
                </li>
              )
            })}
          </ul>
        )}

        <div className="space-y-2 border p-4">
          <p className="text-sm font-medium text-foreground">Add it to Claude</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Create a token above and copy it.</li>
            <li>
              In Claude Code, run the command below. Any MCP client that supports Streamable HTTP and custom headers works the same way:
              server URL <code className="break-all">{mcpUrl}</code>, header <code>Authorization: Bearer</code> followed by your token.
            </li>
            <li>Ask Claude to go through your inbox and update JobClock.</li>
          </ol>
          <Input readOnly value={command} aria-label="Claude Code command" onFocus={(event) => event.currentTarget.select()} />
        </div>
      </CardContent>
    </Card>
  )
}
