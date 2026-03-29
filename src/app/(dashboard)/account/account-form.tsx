"use client"

import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { saveAccountInfo } from "./actions"
import { Loader2 } from "lucide-react"

interface AccountFormProps {
  initialData: {
    fullName: string
    phone: string
    linkedinUrl: string
    githubUrl: string
    portfolioUrl: string
    avatarUrl: string
    email: string
  }
}

export function AccountForm({ initialData }: AccountFormProps) {
  const [fullName, setFullName] = useState(initialData.fullName)
  const [phone, setPhone] = useState(initialData.phone)
  const [linkedinUrl, setLinkedinUrl] = useState(initialData.linkedinUrl)
  const [githubUrl, setGithubUrl] = useState(initialData.githubUrl)
  const [portfolioUrl, setPortfolioUrl] = useState(initialData.portfolioUrl)
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(initialData)

  const isDirty =
    fullName !== saved.fullName ||
    phone !== saved.phone ||
    linkedinUrl !== saved.linkedinUrl ||
    githubUrl !== saved.githubUrl ||
    portfolioUrl !== saved.portfolioUrl ||
    avatarUrl !== saved.avatarUrl

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isDirty) return
    startTransition(async () => {
      const result = await saveAccountInfo({
        fullName,
        phone,
        linkedinUrl,
        githubUrl,
        portfolioUrl,
        avatarUrl,
      })
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Account updated")
        setSaved({ ...saved, fullName, phone, linkedinUrl, githubUrl, portfolioUrl, avatarUrl })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Avatar preview */}
      <div className="flex items-center gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border bg-secondary text-xl font-semibold uppercase">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-muted-foreground">
              {fullName ? fullName.trim()[0] : initialData.email[0]}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input
            id="avatarUrl"
            type="url"
            placeholder="https://…"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            placeholder="Jane Smith"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={initialData.email} disabled className="opacity-50" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+44 7700 900000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
          <Input
            id="linkedinUrl"
            type="url"
            placeholder="https://linkedin.com/in/…"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="githubUrl">GitHub URL</Label>
          <Input
            id="githubUrl"
            type="url"
            placeholder="https://github.com/…"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="portfolioUrl">Portfolio URL</Label>
          <Input
            id="portfolioUrl"
            type="url"
            placeholder="https://…"
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={!isDirty || isPending}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save changes
      </Button>
    </form>
  )
}
