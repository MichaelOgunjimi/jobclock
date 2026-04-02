"use client"

import { useState, useTransition } from "react"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { CvData } from "@/lib/supabase/database.types"
import { normalizeCvData, sanitizeCvData, type NormalizedCvData } from "@/lib/cv-data"
import { CvEditorForm } from "@/components/cv/editor/cv-editor-form"
import { saveCvData, renameCv } from "../actions"

export function CvEditor({
  cvId,
  cvName,
  initialData,
}: {
  cvId: string
  cvName: string
  initialData: CvData
}) {
  const [data, setData] = useState<NormalizedCvData>(() => normalizeCvData(initialData))
  const [name, setName] = useState(cvName)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      if (name !== cvName) {
        const formData = new FormData()
        formData.append("cvId", cvId)
        formData.append("name", name)
        await renameCv(formData)
      }

      const result = await saveCvData(cvId, sanitizeCvData(data))
      if (result?.error) {
        toast.error(result.error)
        return
      }

      toast.success("CV saved")
    })
  }

  return (
    <CvEditorForm
      value={data}
      onChange={setData}
      documentName={name}
      onDocumentNameChange={setName}
      footer={
        <div className="flex justify-end pb-8">
          <Button onClick={handleSave} disabled={isPending} size="lg">
            <Save className="h-4 w-4" />
            {isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      }
    />
  )
}
