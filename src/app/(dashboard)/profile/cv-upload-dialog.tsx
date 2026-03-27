"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Upload, X, Loader2 } from "lucide-react"

export function CvUploadDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
    },
    maxFiles: 1,
    disabled: uploading,
  })

  async function handleUpload() {
    if (!file) return toast.error("Please select a file first")

    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    if (name.trim()) formData.append("name", name.trim())

    try {
      const res = await fetch("/api/cv/upload", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Upload failed")
        return
      }

      toast.success("CV uploaded and parsed!")
      setOpen(false)
      setFile(null)
      setName("")
      router.push(`/profile/${data.cvId}`)
    } catch {
      toast.error("Failed to upload CV. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add CV
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md border border-border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Upload New CV</h2>
          <button onClick={() => { setOpen(false); setFile(null); setName("") }} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <Label htmlFor="cv-name">CV Name</Label>
            <Input
              id="cv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Software Engineering CV"
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground">Leave blank to use your name from the CV</p>
          </div>

          <div
            {...getRootProps()}
            className={[
              "cursor-pointer border border-dashed p-8 text-center transition-colors",
              isDragReject ? "border-destructive bg-destructive/5" : "",
              isDragActive && !isDragReject ? "border-foreground/40 bg-secondary" : "",
              !isDragActive && !file ? "border-border bg-secondary hover:border-foreground/30" : "",
              file ? "border-foreground/20 bg-secondary" : "",
            ].join(" ")}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Parsing with AI…</p>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">Click or drop to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop your CV here or <span className="text-foreground font-medium">browse</span>
                </p>
                <p className="text-xs text-muted-foreground">PDF or DOCX, up to 10MB</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={() => { setOpen(false); setFile(null); setName("") }} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading…" : "Upload & Parse"}
          </Button>
        </div>
      </div>
    </div>
  )
}
