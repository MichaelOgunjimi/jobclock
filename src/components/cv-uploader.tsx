"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileText, X, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import type { CvData } from "@/lib/supabase/database.types"

interface UploadedCv {
  id: string
  parsed: CvData
  fileUrl: string
}

interface CvUploaderProps {
  onUploadSuccess?: (cv: UploadedCv) => void
  existingCv?: {
    id: string
    parsed_json: CvData
    file_path: string | null
    created_at: string
  } | null
}

export function CvUploader({ onUploadSuccess, existingCv }: CvUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadedCv, setUploadedCv] = useState<UploadedCv | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      setUploading(true)

      const formData = new FormData()
      formData.append("file", file)

      try {
        const res = await fetch("/api/cv/upload", {
          method: "POST",
          body: formData,
        })

        const data = await res.json()

        if (!res.ok) {
          toast.error(data.error ?? "Upload failed")
          return
        }

        const cv: UploadedCv = {
          id: data.cvId,
          parsed: data.parsed,
          fileUrl: data.fileUrl,
        }

        setUploadedCv(cv)
        toast.success("CV uploaded and parsed!")
        onUploadSuccess?.(cv)
      } catch (error) {
        console.error("Upload error:", error)
        toast.error("Failed to upload CV. Please try again.")
      } finally {
        setUploading(false)
      }
    },
    [onUploadSuccess]
  )

  const { getRootProps, getInputProps, isDragReject } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
    },
    maxFiles: 1,
    disabled: uploading,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  })

  // Show existing CV if present and no new upload
  if (existingCv && !uploadedCv) {
    return (
      <Card>
        <CardHeader className="border-b pb-6">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-foreground" />
            CV Uploaded
          </CardTitle>
          <CardDescription>
            Uploaded on {new Date(existingCv.created_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CvPreview cv={existingCv.parsed_json as CvData} />
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                // Trigger file re-upload
                const input = document.createElement("input")
                input.type = "file"
                input.accept = ".pdf,.docx,.doc"
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (file) {
                    const formData = new FormData()
                    formData.append("file", file)
                    setUploading(true)
                    try {
                      const res = await fetch("/api/cv/upload", {
                        method: "POST",
                        body: formData,
                      })
                      const data = await res.json()
                      if (res.ok) {
                        setUploadedCv({ id: data.cvId, parsed: data.parsed, fileUrl: data.fileUrl })
                        toast.success("CV updated!")
                      } else {
                        toast.error(data.error)
                      }
                    } finally {
                      setUploading(false)
                    }
                  }
                }
                input.click()
              }}
            >
              Replace CV
            </Button>
            {existingCv.file_path && (
              <Button variant="outline" asChild>
                <a href={existingCv.file_path} target="_blank" rel="noopener noreferrer">
                  View Original
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <p className="section-label">Document upload</p>
        <CardTitle>Upload Your CV</CardTitle>
        <CardDescription>
          Upload a PDF or Word document. We will parse it and extract your information.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`
            cursor-pointer border border-dashed p-10 text-center transition-colors
            ${isDragReject ? "border-destructive bg-destructive/5" : ""}
            ${dragActive && !isDragReject ? "border-foreground/30 bg-foreground/5" : ""}
            ${!dragActive ? "border-border bg-secondary hover:border-foreground/30" : ""}
          `}
        >
          <input {...getInputProps()} />

          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Parsing your CV...</p>
            </div>
          ) : isDragReject ? (
            <div className="flex flex-col items-center gap-2">
              <X className="h-8 w-8 text-red-500" />
              <p className="text-sm text-red-600 font-medium">Only PDF and DOCX files are accepted</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="border bg-background p-3">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium tracking-[0.02em] text-foreground">
                  Drag & drop your CV here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF or DOCX, up to 10MB
                </p>
              </div>
            </div>
          )}
        </div>

        {uploadedCv && (
          <div className="mt-4">
            <CvPreview cv={uploadedCv.parsed} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CvPreview({ cv }: { cv: CvData }) {
  return (
    <div className="space-y-4 border bg-secondary p-5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileText className="h-4 w-4" />
        Parsed CV Data
      </div>

      {cv.name && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Name:</span> {cv.name}
          </div>
          {cv.email && (
            <div>
              <span className="text-muted-foreground">Email:</span> {cv.email}
            </div>
          )}
          {cv.phone && (
            <div>
              <span className="text-muted-foreground">Phone:</span> {cv.phone}
            </div>
          )}
          {cv.location && (
            <div>
              <span className="text-muted-foreground">Location:</span> {cv.location}
            </div>
          )}
        </div>
      )}

      {cv.skills.length > 0 && (
        <div>
          <span className="text-sm text-muted-foreground">Skills: </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {cv.skills.slice(0, 15).map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center border border-border bg-background px-2 py-1 text-[11px] font-semibold tracking-[0.08em] text-foreground uppercase"
              >
                {skill}
              </span>
            ))}
            {cv.skills.length > 15 && (
              <span className="text-xs text-muted-foreground">+{cv.skills.length - 15} more</span>
            )}
          </div>
        </div>
      )}

      {cv.experience.length > 0 && (
        <div>
          <span className="text-sm text-muted-foreground">Experience: </span>
          <div className="text-sm mt-1 space-y-1">
            {cv.experience.slice(0, 2).map((exp, i) => (
              <div key={i} className="bg-background rounded px-2 py-1">
                <span className="font-medium">{exp.title}</span> at {exp.company}
              </div>
            ))}
          </div>
        </div>
      )}

      {cv.education.length > 0 && (
        <div>
          <span className="text-sm text-muted-foreground">Education: </span>
          <div className="text-sm mt-1 space-y-1">
            {cv.education.slice(0, 2).map((edu, i) => (
              <div key={i} className="bg-background rounded px-2 py-1">
                <span className="font-medium">{edu.degree}</span> at {edu.institution}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
