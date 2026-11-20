"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { canWrite, describeExpiry, scopeLabel } from "@/lib/mcp/access-policy"
import type { ConnectionActivityItem } from "@/lib/mcp/activity"
import type { ConnectedApp } from "@/lib/oauth/tokens"
import { revokeAgentConnection } from "./actions"
import { DailyLimitEditor, formatDate, RecentActivity } from "./connection-details"

export function ConnectedAppsCard({ apps: initialApps, mcpUrl, activity }: { apps: ConnectedApp[]; mcpUrl: string; activity: Record<string, ConnectionActivityItem[]> }) {
  const [apps, setApps] = useState(initialApps)
  const [isPending, startTransition] = useTransition()

  function handleRevoke(id: string) {
    startTransition(async () => {
      const result = await revokeAgentConnection(id)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setApps((current) => current.filter((app) => app.id !== id))
      toast.success("App disconnected")
    })
  }

  return (
    <Card>
      <CardHeader className="border-b pb-6">
        <p className="section-label">AI Agent</p>
        <CardTitle>Connected apps</CardTitle>
        <CardDescription>
          The easy way to connect Claude or another MCP app: add the server URL below in the app, sign in when it opens JobClock,
          and choose what to allow and for how long. Apps start read-only; you decide whether they may make changes. We email you when an app is connected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Server URL</p>
          <Input readOnly value={mcpUrl} aria-label="MCP server URL" onFocus={(event) => event.currentTarget.select()} />
        </div>

        {apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No apps connected.</p>
        ) : (
          <ul className="divide-y border">
            {apps.map((app) => {
              const { text: expiring, expired } = describeExpiry(app.expiresAt, new Date(), "Stays connected until you revoke it")
              return (
                <li key={app.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-medium text-foreground">{app.clientName}</p>
                        <Badge variant="outline">{scopeLabel(app.scopes)}</Badge>
                        {expired && <Badge variant="destructive">Expired</Badge>}
                      </div>
                      <p className="break-all text-xs text-muted-foreground">
                        {app.redirectHost} · Connected {formatDate(app.createdAt, "")} · Last used {formatDate(app.lastUsedAt, "never")}
                      </p>
                      <p className="text-xs text-muted-foreground">{expiring}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleRevoke(app.id)} disabled={isPending}>
                      {expired ? "Remove" : "Revoke"}
                    </Button>
                  </div>
                  {!expired && canWrite(app.scopes) && <DailyLimitEditor kind="app" id={app.id} value={app.dailyCreateCap} />}
                  <RecentActivity items={activity[app.id] ?? []} />
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
