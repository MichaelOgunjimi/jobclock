"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { createAgentToken, revokeAgentToken } from "./actions"
import type { ApiTokenMetadata } from "@/lib/mcp/tokens"

function formatDate(value: string | null, empty: string) {
  if (!value) return empty
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

export function AgentAccessCard({ tokens: initialTokens, mcpUrl }: { tokens: ApiTokenMetadata[]; mcpUrl: string }) {
  const [tokens, setTokens] = useState(initialTokens)
  const [label, setLabel] = useState("")
  const [rawToken, setRawToken] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createAgentToken(label)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setRawToken(result.token)
      setTokens((current) => [result.metadata, ...current])
      setLabel("")
      toast.success("Token created")
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

  const command = `claude mcp add --transport http jobclock ${mcpUrl} --header "Authorization: Bearer ${rawToken ?? "jc_YOUR_TOKEN"}"`

  return (
    <Card>
      <CardHeader className="border-b pb-6">
        <p className="section-label">AI Agent</p>
        <CardTitle>Connect your AI agent</CardTitle>
        <CardDescription>
          Let an AI agent such as Claude update your application statuses, follow-ups, interview times and notes
          over MCP. It can read and change your applications but cannot delete anything or spend AI credits.
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
          <Button type="submit" disabled={isPending || !label.trim()}>
            {isPending ? "Working…" : "Create token"}
          </Button>
        </form>

        {rawToken && (
          <div className="space-y-2 border bg-secondary/40 p-4">
            <p className="text-sm font-medium text-foreground">Copy this token now</p>
            <p className="text-xs text-muted-foreground">
              For security, the full token is only shown once. Anyone holding it can act on your applications until you revoke it.
            </p>
            <Input readOnly value={rawToken} aria-label="New agent token" onFocus={(event) => event.currentTarget.select()} />
          </div>
        )}

        <Separator />

        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
        ) : (
          <ul className="divide-y border">
            {tokens.map((token) => (
              <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{token.label}</p>
                    <Badge variant="outline">{token.revokedAt ? "Revoked" : "Active"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {token.tokenPrefix}•••• · Created {formatDate(token.createdAt, "")} · Last used {formatDate(token.lastUsedAt, "never")}
                  </p>
                </div>
                {!token.revokedAt && (
                  <Button variant="outline" size="sm" onClick={() => handleRevoke(token.id)} disabled={isPending}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 border p-4">
          <p className="text-sm font-medium text-foreground">Add it to Claude</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Create a token above and copy it.</li>
            <li>
              In Claude Code, run the command below. Any MCP client that supports Streamable HTTP and custom headers works the same way:
              server URL <code className="break-all">{mcpUrl}</code>, header <code>Authorization: Bearer &lt;token&gt;</code>.
            </li>
            <li>Ask Claude to go through your inbox and update JobClock.</li>
          </ol>
          <Input readOnly value={command} aria-label="Claude Code command" onFocus={(event) => event.currentTarget.select()} />
        </div>
      </CardContent>
    </Card>
  )
}
