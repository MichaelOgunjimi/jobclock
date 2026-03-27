"use client"

import { useState, useCallback, useTransition, useEffect, useRef } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Upload, Loader2, Trash2, Eye, EyeOff, CheckCircle, AlertTriangle, X } from "lucide-react"
import { saveTemplate, deleteTemplate } from "./actions"

async function renderDocx(buffer: ArrayBuffer, container: HTMLElement) {
  const { renderAsync } = await import("docx-preview")
  container.innerHTML = ""
  await renderAsync(buffer, container, undefined, {
    className: "docx-preview",
    inWrapper: true,
    ignoreWidth: true,
    ignoreHeight: true,
    ignoreFonts: false,
    breakPages: true,
    useBase64URL: true,
  })
}

export function TemplateUpload({
  type,
  hasExisting,
}: {
  type: "cv" | "cover_letter"
  hasExisting: boolean
}) {
  const label = type === "cv" ? "CV" : "Cover Letter"
  const [saved, setSaved] = useState(hasExisting)
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDeleteOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setIsDeleteOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isDeleteOpen])

  // Render existing saved template when preview is toggled on
  useEffect(() => {
    if (!showPreview || !saved || pendingPath || !previewRef.current) return
    if (previewRef.current.innerHTML) return // already rendered

    setLoadingPreview(true)
    fetch(`/api/template/file/${type}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load template")
        return res.arrayBuffer()
      })
      .then((buffer) => renderDocx(buffer, previewRef.current!))
      .catch(() => toast.error("Could not load template preview"))
      .finally(() => setLoadingPreview(false))
  }, [showPreview, saved, pendingPath, type])

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0]
    if (!file) return

    setUploading(true)
    const localBuffer = await file.arrayBuffer()

    // Render locally for immediate preview
    if (previewRef.current) {
      await renderDocx(localBuffer, previewRef.current)
    }
    setShowPreview(true)

    // Upload to storage in background
    const fd = new FormData()
    fd.append("file", file)
    fd.append("type", type)

    try {
      const res = await fetch("/api/template/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed")
        return
      }
      setPendingPath(data.path)
      toast.success("Template ready — click Save to confirm")
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploading(false)
    }
  }, [type])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
    },
    maxFiles: 1,
    disabled: uploading || isPending,
  })

  function handleSave() {
    if (!pendingPath) return
    startTransition(async () => {
      const result = await saveTemplate(type, pendingPath)
      if (result?.error) {
        toast.error(result.error)
      } else {
        setSaved(true)
        setPendingPath(null)
        toast.success(`${label} template saved`)
      }
    })
  }

  function handleDiscard() {
    setPendingPath(null)
    setShowPreview(false)
    if (previewRef.current) previewRef.current.innerHTML = ""
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTemplate(type)
      if (result?.error) {
        toast.error(result.error)
      } else {
        setSaved(false)
        setPendingPath(null)
        setShowPreview(false)
        setIsDeleteOpen(false)
        if (previewRef.current) previewRef.current.innerHTML = ""
        toast.success(`${label} template removed`)
      }
    })
  }

  return (
    <>
      <div className="space-y-4">
        {/* Saved status bar */}
        {saved && !pendingPath && (
          <div className="flex items-center justify-between border border-border bg-secondary px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Template saved</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPreview ? "Hide preview" : "Preview"}
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteOpen(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={[
            "cursor-pointer border border-dashed p-8 text-center transition-colors",
            isDragActive ? "border-foreground/40 bg-secondary" : "border-border bg-secondary hover:border-foreground/30",
            (uploading || isPending) ? "pointer-events-none opacity-60" : "",
          ].join(" ")}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Uploading…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {saved ? `Drop a new DOCX to replace your ${label} template` : `Drop your ${label} DOCX template here`}
              </p>
              <p className="text-xs text-muted-foreground opacity-60">DOCX only</p>
            </div>
          )}
        </div>

        {/* Preview container */}
        {showPreview && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Preview</p>
              {pendingPath && (
                <p className="text-xs text-amber-600">Unsaved — click Save to confirm</p>
              )}
            </div>
            {loadingPreview && (
              <div className="flex items-center justify-center py-12 border border-border">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="template-preview-shell overflow-x-auto border border-border">
              <div ref={previewRef} />
            </div>
          </div>
        )}

        {/* Save / discard */}
        {pendingPath && (
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleDiscard}>Discard</Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : `Save ${label} Template`}
            </Button>
          </div>
        )}
      </div>

      {/* Delete dialog */}
      {isDeleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsDeleteOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md border border-border bg-background shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center border border-destructive/20 bg-destructive/8 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-medium">Remove {label} template?</h2>
                  <p className="text-xs text-muted-foreground">The saved file will be permanently deleted.</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsDeleteOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">You can upload a new template at any time.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
                {isPending ? "Removing…" : "Remove"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
