"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Briefcase } from "lucide-react"

interface Props {
  feedback: { message: string; status: string } | null
}

export function UpdatePasswordClient({ feedback }: Props) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [clientError, setClientError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (password !== confirm) {
      e.preventDefault()
      setClientError("Passwords do not match.")
    } else {
      setClientError(null)
    }
  }

  const errorMessage = clientError ?? (feedback?.status === "error" ? feedback.message : null)
  const successMessage = feedback?.status === "success" ? feedback.message : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader className="border-b pb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-3">
              <p className="page-kicker">Security</p>
              <CardTitle>Set a new password.</CardTitle>
              <CardDescription>Choose a strong password with at least 6 characters.</CardDescription>
            </div>
            <div className="hidden size-12 items-center justify-center border bg-secondary md:flex">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMessage && (
            <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-700 dark:text-red-400">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-700 dark:text-emerald-400">
              {successMessage}
            </div>
          )}

          <form action="/auth/update-password/submit" method="post" className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full">
              Update Password
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
