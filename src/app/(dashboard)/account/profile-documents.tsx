"use client"

import { useRef, useState } from "react"
import {
  Award,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  PROFILE_DOCUMENT_ACCEPTED_TYPES,
  PROFILE_DOCUMENT_MAX_BYTES,
  PROFILE_DOCUMENT_TYPE_LABELS,
  PROFILE_DOCUMENT_TYPES,
  type ProfileDocumentType,
} from "@/lib/profile-documents"

const FACT_CATEGORIES = [
  "education",
  "certification",
  "skill",
  "achievement",
  "language",
  "activity",
  "experience",
  "project",
] as const

interface DocumentFact {
  id?: string
  category: string
  label: string
  detail: string
  confirmedAt?: string | null
}

interface ProfileDocumentView {
  id: string
  type: string
  name: string
  issuer: string | null
  issuedAt: string | null
  expiresAt: string | null
  credentialId: string | null
  credentialUrl: string | null
  originalFilePath: string
  mimeType: string
  fileSize: number
  createdAt: string
  updatedAt: string
  facts: DocumentFact[]
}

function emptyFact(): DocumentFact {
  return { category: "certification", label: "", detail: "" }
}

function formatBytes(value: number) {
  return value < 1024 * 1024
    ? `${Math.ceil(value / 1024)} KB`
    : `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentEditor({
  document,
  onSaved,
  onDeleted,
}: {
  document: ProfileDocumentView
  onSaved: (document: ProfileDocumentView) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(document.facts.some((fact) => !fact.confirmedAt))
  const [draft, setDraft] = useState(document)
  const [pending, setPending] = useState(false)

  function updateFact(index: number, patch: Partial<DocumentFact>) {
    setDraft((current) => ({
      ...current,
      facts: current.facts.map((fact, factIndex) =>
        factIndex === index ? { ...fact, ...patch } : fact,
      ),
    }))
  }

  async function save() {
    setPending(true)
    try {
      const response = await fetch(`/api/profile/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: draft.type,
          name: draft.name,
          issuer: draft.issuer || null,
          issuedAt: draft.issuedAt || null,
          expiresAt: draft.expiresAt || null,
          credentialId: draft.credentialId || null,
          credentialUrl: draft.credentialUrl || null,
          facts: draft.facts.map(({ category, label, detail }) => ({ category, label, detail })),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Failed to save document")
      const saved = {
        ...draft,
        facts: result.facts.map((fact: DocumentFact) => ({
          id: fact.id,
          category: fact.category,
          label: fact.label,
          detail: fact.detail,
          confirmedAt: fact.confirmedAt,
        })),
      }
      setDraft(saved)
      setEditing(false)
      onSaved(saved)
      toast.success("Document evidence confirmed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save document")
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${document.name}” and all evidence extracted from it?`)) return
    setPending(true)
    try {
      const response = await fetch(`/api/profile/documents/${document.id}`, { method: "DELETE" })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error ?? "Failed to delete document")
      }
      onDeleted(document.id)
      toast.success("Document deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete document")
    } finally {
      setPending(false)
    }
  }

  const confirmed = draft.facts.length > 0 && draft.facts.every((fact) => fact.confirmedAt)

  return (
    <article className="border border-border bg-background">
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center border bg-secondary">
            <Award className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{draft.name}</h3>
              <span className="border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {PROFILE_DOCUMENT_TYPE_LABELS[draft.type as ProfileDocumentType] ?? draft.type}
              </span>
              <span className={confirmed
                ? "border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-300"
                : "border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-300"
              }>
                {confirmed ? "Confirmed" : "Needs review"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {[draft.issuer, formatBytes(draft.fileSize), `${draft.facts.length} extracted facts`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={`/api/profile/documents/${document.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 size-3.5" />
              Original
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing((value) => !value)}>
            {editing ? <X className="mr-1.5 size-3.5" /> : <FileText className="mr-1.5 size-3.5" />}
            {editing ? "Close" : "Review"}
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={remove} disabled={pending} aria-label={`Delete ${document.name}`}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-6 p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${document.id}-type`}>Document type</Label>
              <select
                id={`${document.id}-type`}
                value={draft.type}
                onChange={(event) => setDraft({ ...draft, type: event.target.value })}
                className="h-10 w-full border border-border bg-background px-3 text-sm"
              >
                {PROFILE_DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>{PROFILE_DOCUMENT_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`${document.id}-name`}>Name</Label>
              <Input id={`${document.id}-name`} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${document.id}-issuer`}>Issuer</Label>
              <Input id={`${document.id}-issuer`} value={draft.issuer ?? ""} onChange={(event) => setDraft({ ...draft, issuer: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${document.id}-issued`}>Issued</Label>
              <Input id={`${document.id}-issued`} type="date" value={draft.issuedAt ?? ""} onChange={(event) => setDraft({ ...draft, issuedAt: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${document.id}-expires`}>Expires</Label>
              <Input id={`${document.id}-expires`} type="date" value={draft.expiresAt ?? ""} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${document.id}-credential-id`}>Credential ID</Label>
              <Input id={`${document.id}-credential-id`} value={draft.credentialId ?? ""} onChange={(event) => setDraft({ ...draft, credentialId: event.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`${document.id}-credential-url`}>Verification URL</Label>
              <Input id={`${document.id}-credential-url`} type="url" value={draft.credentialUrl ?? ""} onChange={(event) => setDraft({ ...draft, credentialUrl: event.target.value })} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Extracted evidence</p>
                <p className="text-xs text-muted-foreground">Correct or remove anything inaccurate before confirming it.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, facts: [...draft.facts, emptyFact()] })}>
                <Plus className="mr-1.5 size-3.5" /> Add fact
              </Button>
            </div>
            {draft.facts.map((fact, index) => (
              <div key={fact.id ?? index} className="grid gap-3 border border-border bg-secondary/40 p-3 lg:grid-cols-[180px_0.8fr_1.5fr_auto]">
                <select
                  aria-label={`Fact ${index + 1} category`}
                  value={fact.category}
                  onChange={(event) => updateFact(index, { category: event.target.value })}
                  className="h-10 border border-border bg-background px-3 text-sm capitalize"
                >
                  {FACT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <Input value={fact.label} onChange={(event) => updateFact(index, { label: event.target.value })} aria-label={`Fact ${index + 1} title`} />
                <Input value={fact.detail} onChange={(event) => updateFact(index, { detail: event.target.value })} aria-label={`Fact ${index + 1} detail`} />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setDraft({ ...draft, facts: draft.facts.filter((_, factIndex) => factIndex !== index) })}
                  aria-label={`Remove fact ${index + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            onClick={save}
            disabled={pending || !draft.name.trim() || draft.facts.length === 0 || draft.facts.some((fact) => !fact.label.trim() || !fact.detail.trim())}
          >
            {pending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
            Save and confirm evidence
          </Button>
        </div>
      ) : (
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {draft.facts.slice(0, 6).map((fact) => (
            <div key={fact.id ?? `${fact.category}:${fact.label}`} className="bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{fact.category}</p>
              <p className="mt-1 text-sm font-semibold">{fact.label}</p>
              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{fact.detail}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

export function ProfileDocuments({ initialDocuments }: { initialDocuments: ProfileDocumentView[] }) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [type, setType] = useState<ProfileDocumentType>("certificate")
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    if (file.size > PROFILE_DOCUMENT_MAX_BYTES) {
      toast.error("Document must be 15 MB or smaller")
      return
    }
    if (!(PROFILE_DOCUMENT_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Upload a PDF, DOCX, JPEG, PNG, or WebP document")
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("file", file)
      formData.set("type", type)
      const response = await fetch("/api/profile/documents", { method: "POST", body: formData })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Failed to process document")
      setDocuments((current) => [{ ...result.document, facts: result.facts }, ...current])
      toast.success("Document extracted. Review the evidence before using it.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process document")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="border-b pb-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="section-label">Qualifications & documents</p>
            <CardTitle className="mt-2">Reusable, verified evidence.</CardTitle>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Add certificates, transcripts, degrees, and training records. Nothing is used in generated content until you review and confirm it.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={type} onChange={(event) => setType(event.target.value as ProfileDocumentType)} className="h-10 border border-border bg-background px-3 text-sm">
              {PROFILE_DOCUMENT_TYPES.map((value) => <option key={value} value={value}>{PROFILE_DOCUMENT_TYPE_LABELS[value]}</option>)}
            </select>
            <Button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Upload className="mr-1.5 size-4" />}
              {uploading ? "Extracting evidence…" : "Upload document"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept={PROFILE_DOCUMENT_ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
              }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {documents.length === 0 ? (
          <div className="border border-dashed border-border p-10 text-center">
            <FileText className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-semibold">No qualification documents yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Upload the original once, then reuse its confirmed facts everywhere.</p>
          </div>
        ) : documents.map((document) => (
          <DocumentEditor
            key={document.id}
            document={document}
            onSaved={(saved) => setDocuments((current) => current.map((item) => item.id === saved.id ? saved : item))}
            onDeleted={(id) => setDocuments((current) => current.filter((item) => item.id !== id))}
          />
        ))}
      </CardContent>
    </Card>
  )
}
