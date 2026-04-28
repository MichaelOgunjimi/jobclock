"use client"

import NextImage from "next/image"
import { useRef, useState, useTransition } from "react"
import { Link2, Loader2, Upload, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { saveAccountInfo } from "./actions"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const AVATAR_SIZE = 400 // px — max dimension after compression

async function compressAvatar(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, AVATAR_SIZE / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Canvas compression failed"))
      }, "image/jpeg", 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")) }
    img.src = url
  })
}

interface AccountFormProps {
  userId: string
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

export function AccountForm({ userId, initialData }: AccountFormProps) {
  const [fullName, setFullName] = useState(initialData.fullName)
  const [phone, setPhone] = useState(initialData.phone)
  const [linkedinUrl, setLinkedinUrl] = useState(initialData.linkedinUrl)
  const [githubUrl, setGithubUrl] = useState(initialData.githubUrl)
  const [portfolioUrl, setPortfolioUrl] = useState(initialData.portfolioUrl)
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl)
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(initialData)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isDirty =
    fullName !== saved.fullName ||
    phone !== saved.phone ||
    linkedinUrl !== saved.linkedinUrl ||
    githubUrl !== saved.githubUrl ||
    portfolioUrl !== saved.portfolioUrl ||
    avatarUrl !== saved.avatarUrl

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, or WebP image")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 2 MB")
      return
    }

    setIsUploading(true)
    try {
      const compressed = await compressAvatar(file)
      const supabase = createClient()
      const path = `${userId}/avatar.jpg`

      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path)
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`)
      setAvatarLoadFailed(false)
    } catch {
      toast.error("Failed to upload image. Please try again.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

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

  const initials = fullName ? fullName.trim()[0] : initialData.email[0]

  return (
    <form onSubmit={handleSubmit}>
      <Card className="border-border">
        <CardHeader className="border-b pb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="group relative flex h-20 w-20 items-center justify-center overflow-hidden border bg-secondary text-2xl font-semibold uppercase"
                aria-label="Upload profile photo"
              >
                {avatarUrl && !avatarLoadFailed ? (
                  <NextImage
                    src={avatarUrl}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                    onLoad={() => setAvatarLoadFailed(false)}
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  <span className="text-muted-foreground">{initials}</span>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  {isUploading
                    ? <Loader2 className="h-5 w-5 animate-spin text-white" />
                    : <Upload className="h-5 w-5 text-white" />
                  }
                </div>
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="section-label">Profile image</p>
              <CardTitle>Account details</CardTitle>
              <p className="text-sm text-muted-foreground">
                Click the image to upload a new photo. JPEG, PNG, or WebP up to 2 MB.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center border bg-secondary">
                <UserRound className="h-4 w-4" />
              </div>
              <div>
                <p className="section-label">Identity</p>
                <p className="text-sm text-muted-foreground">Your core personal and contact details.</p>
              </div>
            </div>

            <div className="grid gap-5 border bg-secondary/50 p-4 sm:grid-cols-2">
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

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+44 7700 900000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center border bg-secondary">
                <Link2 className="h-4 w-4" />
              </div>
              <div>
                <p className="section-label">Links</p>
                <p className="text-sm text-muted-foreground">
                  Public URLs that help applications and recruiters verify your work.
                </p>
              </div>
            </div>

            <div className="grid gap-5 border bg-secondary/50 p-4 sm:grid-cols-2">
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

              <div className="space-y-1.5 sm:col-span-2">
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
          </div>

          <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {isDirty ? "You have unsaved changes." : "Everything is up to date."}
            </p>
            <Button type="submit" disabled={!isDirty || isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
