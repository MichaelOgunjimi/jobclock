"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteCv, setPrimaryCV } from "./actions"

export function CvCardActions({ cvId, isPrimary }: { cvId: string; isPrimary: boolean }) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  useEffect(() => {
    if (!isDeleteOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsDeleteOpen(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isDeleteOpen])

  return (
    <>
      <div className="flex gap-1 border-t border-border px-3 py-2">
        {!isPrimary && (
          <form action={setPrimaryCV}>
            <input type="hidden" name="cvId" value={cvId} />
            <button type="submit" className="px-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              Set primary
            </button>
          </form>
        )}
        <button
          type="button"
          className="ml-auto px-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
          onClick={() => setIsDeleteOpen(true)}
        >
          Delete
        </button>
      </div>

      {isDeleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsDeleteOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-cv-title-${cvId}`}
            className="w-full max-w-md border border-border bg-background shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center border border-destructive/20 bg-destructive/8 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h2 id={`delete-cv-title-${cvId}`} className="text-sm font-medium">
                    Delete CV?
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    This removes the file and parsed CV data.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close delete dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-muted-foreground">
                This action can&apos;t be undone. If this CV is your primary one, the most recent remaining CV will be promoted automatically.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <form action={deleteCv}>
                <input type="hidden" name="cvId" value={cvId} />
                <Button type="submit" variant="destructive">
                  Delete CV
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
