"use client"

import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { WhatsAppConnectionMetadata } from "@/lib/whatsapp/pairing"
import { toast } from "sonner"
import { disconnectWhatsAppAccount, generateWhatsAppPairing } from "./actions"

function formatDate(value: string | null) {
  if (!value) return "Never"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function WhatsAppSettingsCard({
  initialConnection,
  businessNumber,
  configured,
}: {
  initialConnection: WhatsAppConnectionMetadata | null
  businessNumber: string | null
  configured: boolean
}) {
  const [connection, setConnection] = useState(initialConnection)
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const digits = businessNumber?.replace(/\D/g, "") ?? ""
  const message = pairing ? `Connect JobClock: ${pairing.code}` : ""
  const whatsappUrl = digits && pairing
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : null

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateWhatsAppPairing()
      if (result.error) {
        toast.error(result.error)
        return
      }
      if ("code" in result && result.code && result.expiresAt) {
        setPairing({ code: result.code, expiresAt: result.expiresAt })
        toast.success("Pairing code created")
      }
    })
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectWhatsAppAccount()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setConnection(null)
      setPairing(null)
      toast.success("WhatsApp disconnected")
    })
  }

  return (
    <Card>
      <CardHeader className="border-b pb-6">
        <p className="section-label">Mobile intake</p>
        <CardTitle>WhatsApp</CardTitle>
        <CardDescription>
          Connect once, then share job links with JobClock from your phone to extract and save them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">
            {connection ? "Connected" : configured ? "Ready to connect" : "Setup required"}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {connection
              ? `WhatsApp number ending ${connection.phoneLastFour}`
              : "A pairing code is used once. You will not send a token with every job."}
          </p>
        </div>

        {!configured && (
          <div className="border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
            The WhatsApp Cloud API credentials still need to be added to the deployment before pairing can begin.
          </div>
        )}

        {connection ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">Account</p>
                <p className="text-sm text-foreground">{connection.displayName || "WhatsApp user"}</p>
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
              {isPending ? "Disconnecting…" : "Disconnect WhatsApp"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button onClick={handleGenerate} disabled={isPending || !configured}>
              {isPending ? "Generating…" : pairing ? "Generate New Code" : "Connect WhatsApp"}
            </Button>

            {pairing && (
              <div className="space-y-3 border bg-secondary/40 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Your one-time pairing code</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {formatDate(pairing.expiresAt)}. It is consumed as soon as the bot connects your number.
                  </p>
                </div>
                <Input readOnly value={pairing.code} aria-label="WhatsApp pairing code" />
                {whatsappUrl && (
                  <Button asChild>
                    <a href={whatsappUrl} target="_blank" rel="noreferrer">
                      Open WhatsApp and connect
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <Separator />

        <div className="space-y-2 border p-4">
          <p className="text-sm font-medium text-foreground">How it works</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Generate a one-time pairing code and send the prepared message to JobClock.</li>
            <li>Wait for the bot to confirm that this number is connected.</li>
            <li>Share or paste a job listing URL into the conversation.</li>
            <li>Open the returned JobClock link to review or manage the saved application.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
