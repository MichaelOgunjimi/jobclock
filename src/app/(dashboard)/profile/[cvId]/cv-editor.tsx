"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Plus, Trash2, Save, Briefcase, GraduationCap, Award, Languages, FileText, FolderKanban } from "lucide-react"
import type { CvData, CvExperience, CvEducation, CvProject } from "@/lib/supabase/database.types"
import { normalizeCvData, type NormalizedCvData } from "@/lib/cv-data"
import { saveCvData, renameCv } from "../actions"

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="flex min-h-24 w-full border border-input bg-muted px-4 py-3 text-[13px] tracking-[0.02em] outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/15 resize-none"
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  )
}

function ExperienceForm({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: CvExperience
  index: number
  onChange: (i: number, e: CvExperience) => void
  onRemove: (i: number) => void
}) {
  const set = (field: keyof CvExperience, value: string) =>
    onChange(index, { ...entry, [field]: value })

  return (
    <div className="border border-border bg-secondary p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Entry {index + 1}</span>
        <button type="button" onClick={() => onRemove(index)} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Job Title" value={entry.title} onChange={(v) => set("title", v)} placeholder="Software Engineer" />
        <Field label="Company" value={entry.company} onChange={(v) => set("company", v)} placeholder="Company Name" />
        <Field label="Start Date" value={entry.start_date ?? ""} onChange={(v) => set("start_date", v)} placeholder="Jan 2022" />
        <Field label="End Date" value={entry.end_date ?? ""} onChange={(v) => set("end_date", v)} placeholder="Dec 2023 or Present" />
      </div>
      <Field label="Description" value={entry.description} onChange={(v) => set("description", v)} placeholder="Describe your responsibilities and achievements…" multiline />
    </div>
  )
}

function EducationForm({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: CvEducation
  index: number
  onChange: (i: number, e: CvEducation) => void
  onRemove: (i: number) => void
}) {
  const set = (field: keyof CvEducation, value: string) =>
    onChange(index, { ...entry, [field]: value })

  return (
    <div className="border border-border bg-secondary p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Entry {index + 1}</span>
        <button type="button" onClick={() => onRemove(index)} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Institution" value={entry.institution} onChange={(v) => set("institution", v)} placeholder="University of Manchester" />
        <Field label="Degree" value={entry.degree} onChange={(v) => set("degree", v)} placeholder="BSc Computer Science" />
        <Field label="Field of Study" value={entry.field ?? ""} onChange={(v) => set("field", v)} placeholder="Computer Science" />
        <Field label="Grade" value={entry.grade ?? ""} onChange={(v) => set("grade", v)} placeholder="First Class / 2:1" />
        <Field label="Start Year" value={entry.start_date ?? ""} onChange={(v) => set("start_date", v)} placeholder="2019" />
        <Field label="End Year" value={entry.end_date ?? ""} onChange={(v) => set("end_date", v)} placeholder="2023" />
      </div>
    </div>
  )
}

function ProjectForm({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: CvProject
  index: number
  onChange: (i: number, e: CvProject) => void
  onRemove: (i: number) => void
}) {
  const set = (field: keyof CvProject, value: string) =>
    onChange(index, { ...entry, [field]: value })

  const setTech = (value: string) =>
    onChange(index, { ...entry, technologies: value.split(",").map((t) => t.trim()).filter(Boolean) })

  const highlights = entry.highlights ?? [""]

  function setHighlight(i: number, value: string) {
    const next = [...highlights]
    next[i] = value
    onChange(index, { ...entry, highlights: next })
  }

  function addHighlight() {
    onChange(index, { ...entry, highlights: [...highlights, ""] })
  }

  function removeHighlight(i: number) {
    const next = highlights.filter((_, idx) => idx !== i)
    onChange(index, { ...entry, highlights: next.length ? next : [""] })
  }

  return (
    <div className="border border-border bg-secondary p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Project {index + 1}</span>
        <button type="button" onClick={() => onRemove(index)} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Project Name" value={entry.name} onChange={(v) => set("name", v)} placeholder="My Awesome App" />
        <Field label="URL" value={entry.url ?? ""} onChange={(v) => set("url", v)} placeholder="https://github.com/..." />
        <Field label="Start Date" value={entry.start_date ?? ""} onChange={(v) => set("start_date", v)} placeholder="2023" />
        <Field label="End Date" value={entry.end_date ?? ""} onChange={(v) => set("end_date", v)} placeholder="2024 or Present" />
      </div>
      <Field label="Technologies (comma-separated)" value={entry.technologies?.join(", ") ?? ""} onChange={setTech} placeholder="React, Node.js, Postgres" />
      <Field label="Summary" value={entry.description} onChange={(v) => set("description", v)} placeholder="One-line overview of the project" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Bullet points</span>
          <button type="button" onClick={addHighlight} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-3 w-3" /> Add point
          </button>
        </div>
        {highlights.map((point, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm select-none">•</span>
            <Input
              value={point}
              onChange={(e) => setHighlight(i, e.target.value)}
              placeholder={`Highlight ${i + 1}…`}
              className="flex-1"
            />
            {highlights.length > 1 && (
              <button type="button" onClick={() => removeHighlight(i)} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TagEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState("")

  function add() {
    const trimmed = input.trim()
    if (!trimmed || items.includes(trimmed)) return
    onChange([...items, trimmed])
    setInput("")
  }

  function remove(item: string) {
    onChange(items.filter((i) => i !== item))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={add}
          className="h-11 w-full shrink-0 sm:w-11"
          aria-label="Add item"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge
              key={item}
              variant="secondary"
              className="cursor-pointer gap-1 pr-1 hover:bg-destructive/10 group"
              onClick={() => remove(item)}
            >
              {item}
              <Trash2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

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

  const set = <K extends keyof NormalizedCvData>(field: K, value: NormalizedCvData[K]) =>
    setData((d) => ({ ...d, [field]: value }))

  function updateExperience(i: number, entry: CvExperience) {
    const next = [...data.experience]
    next[i] = entry
    set("experience", next)
  }

  function removeExperience(i: number) {
    set("experience", data.experience.filter((_, idx) => idx !== i))
  }

  function addExperience() {
    set("experience", [
      ...data.experience,
      { company: "", title: "", description: "", start_date: "", end_date: "" },
    ])
  }

  function updateEducation(i: number, entry: CvEducation) {
    const next = [...data.education]
    next[i] = entry
    set("education", next)
  }

  function removeEducation(i: number) {
    set("education", data.education.filter((_, idx) => idx !== i))
  }

  function addEducation() {
    set("education", [...data.education, { institution: "", degree: "" }])
  }

  function updateProject(i: number, entry: CvProject) {
    const next = [...(data.projects ?? [])]
    next[i] = entry
    set("projects", next)
  }

  function removeProject(i: number) {
    set("projects", (data.projects ?? []).filter((_, idx) => idx !== i))
  }

  function addProject() {
    set("projects", [...(data.projects ?? []), { name: "", description: "" }])
  }

  function handleSave() {
    startTransition(async () => {
      // Save name if changed
      if (name !== cvName) {
        const fd = new FormData()
        fd.append("cvId", cvId)
        fd.append("name", name)
        await renameCv(fd)
      }

      const result = await saveCvData(cvId, data)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("CV saved")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* CV Name */}
      <Card>
        <CardHeader className="border-b pb-4">
          <p className="section-label">Document</p>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            CV Label
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Field label="Name" value={name} onChange={setName} placeholder="e.g. Software Engineering CV" />
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader className="border-b pb-4">
          <p className="section-label">Personal</p>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" value={data.name ?? ""} onChange={(v) => set("name", v)} placeholder="Michael Ogunjimi" />
            <Field label="Email" value={data.email ?? ""} onChange={(v) => set("email", v)} placeholder="email@example.com" />
            <Field label="Phone" value={data.phone ?? ""} onChange={(v) => set("phone", v)} placeholder="+44 7xxx xxxxxx" />
            <Field label="Location" value={data.location ?? ""} onChange={(v) => set("location", v)} placeholder="London, UK" />
          </div>
          <Field label="Professional Summary" value={data.summary ?? ""} onChange={(v) => set("summary", v)} placeholder="A brief professional summary…" multiline />
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader className="border-b pb-4">
          <p className="section-label">Work history</p>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Experience
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {data.experience.map((exp, i) => (
            <ExperienceForm key={i} entry={exp} index={i} onChange={updateExperience} onRemove={removeExperience} />
          ))}
          <Button type="button" variant="outline" onClick={addExperience} className="w-full">
            <Plus className="h-4 w-4" />
            Add Experience
          </Button>
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader className="border-b pb-4">
          <p className="section-label">Academic</p>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Education
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {data.education.map((edu, i) => (
            <EducationForm key={i} entry={edu} index={i} onChange={updateEducation} onRemove={removeEducation} />
          ))}
          <Button type="button" variant="outline" onClick={addEducation} className="w-full">
            <Plus className="h-4 w-4" />
            Add Education
          </Button>
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader className="border-b pb-4">
          <p className="section-label">Portfolio</p>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            Projects
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {(data.projects ?? []).map((proj, i) => (
            <ProjectForm key={i} entry={proj} index={i} onChange={updateProject} onRemove={removeProject} />
          ))}
          <Button type="button" variant="outline" onClick={addProject} className="w-full">
            <Plus className="h-4 w-4" />
            Add Project
          </Button>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader className="border-b pb-4">
          <p className="section-label">Abilities</p>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Skills
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <TagEditor
            items={data.skills}
            onChange={(v) => set("skills", v)}
            placeholder="Add a skill and press Enter"
          />
        </CardContent>
      </Card>

      {/* Languages */}
      <Card>
        <CardHeader className="border-b pb-4">
          <p className="section-label">Communication</p>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-4 w-4" />
            Languages
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <TagEditor
            items={data.languages ?? []}
            onChange={(v) => set("languages", v)}
            placeholder="Add a language and press Enter"
          />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={isPending} size="lg">
          <Save className="h-4 w-4" />
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
