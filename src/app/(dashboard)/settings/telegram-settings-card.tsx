"use client"

import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { TelegramConnectionMetadata } from "@/lib/telegram/pairing"
import { toast } from "sonner"
import { disconnectTelegramAccount, generateTelegramPairing } from "./actions"

function formatDate(value: string | null) {
  if (!value) return "Never"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function TelegramSettingsCard({
  initialConnection,
  botUsername,
  configured,
}: {
  initialConnection: TelegramConnectionMetadata | null
  botUsername: string | null
  configured: boolean
}) {
  const [connection, setConnection] = useState(initialConnection)
  const [pairing, setPairing] = useState<{ token: string; expiresAt: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const username = botUsername?.replace(/^@/, "") ?? ""
  const telegramUrl = username && pairing
    ? `https://t.me/${username}?start=${encodeURIComponent(pairing.token)}`
    : null

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateTelegramPairing()
      if (result.error) {
        toast.error(result.error)
        return
      }
      if ("token" in result && result.token && result.expiresAt) {
        setPairing({ token: result.token, expiresAt: result.expiresAt })
        toast.success("Telegram pairing link created")
      }
    })
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectTelegramAccount()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setConnection(null)
      setPairing(null)
      toast.success("Telegram disconnected")
    })
  }

  return (
    <Card>
      <CardHeader className="border-b pb-6">
        <p className="section-label">Mobile intake</p>
        <CardTitle>Telegram</CardTitle>
        <CardDescription>
          Connect once, then send public job links to the JobClock bot to extract and save them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">
            {connection ? "Connected" : configured ? "Ready to connect" : "Setup required"}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {connection
              ? `Telegram user ID ending ${connection.userIdLastFour}`
              : "Pairing happens once. Future job links do not need a token."}
          </p>
        </div>

        {!configured && (
          <div className="border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
            The Telegram bot credentials still need to be added to the deployment before pairing can begin.
          </div>
        )}

        {connection ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">Account</p>
                <p className="text-sm text-foreground">
                  {connection.username ? `@${connection.username}` : connection.displayName || "Telegram user"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">Connected</p>
                <p className="text-sm text-foreground">{formatDate(connection.connectedAt)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">Last message</p>
                <p className="text-sm text-foreground">{formatDate(connection.lastMessageAt)}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleDisconnect} disabled={isPending}>
              {isPending ? "Disconnecting…" : "Disconnect Telegram"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button onClick={handleGenerate} disabled={isPending || !configured}>
              {isPending ? "Generating…" : pairing ? "Generate New Link" : "Connect Telegram"}
            </Button>

            {pairing && telegramUrl && (
              <div className="space-y-3 border bg-secondary/40 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Your one-time Telegram pairing link</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {formatDate(pairing.expiresAt)} and is consumed when you start the bot.
                  </p>
                </div>
                <Button asChild>
                  <a href={telegramUrl} target="_blank" rel="noreferrer">
                    Open Telegram and connect
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}

        <Separator />

        <div className="space-y-2 border p-4">
          <p className="text-sm font-medium text-foreground">How it works</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Open the one-time pairing link and select Start in Telegram.</li>
            <li>Wait for the bot to confirm that your Telegram account is connected.</li>
            <li>Share or paste a public job listing URL into the bot conversation.</li>
            <li>Open the returned JobClock link to review or manage the saved application.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
