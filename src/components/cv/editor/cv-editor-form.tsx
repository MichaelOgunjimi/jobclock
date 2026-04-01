"use client"

import type { ReactNode } from "react"
import {
  Award,
  Briefcase,
  FileText,
  FolderKanban,
  GraduationCap,
  Languages,
  Plus,
  Rocket,
  Trash2,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TagInput } from "@/components/ui/tag-input"
import type {
  CvEducation,
  CvExperience,
  CvProject,
} from "@/lib/supabase/database.types"
import type { NormalizedCvData } from "@/lib/cv-data"

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
  rows?: number
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="min-h-24 w-full resize-none border border-input bg-background px-3 py-2.5 text-sm tracking-[0.02em] outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/15"
        />
      ) : (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  )
}

function SectionCard({
  kicker,
  title,
  icon,
  children,
}: {
  kicker: string
  title: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <p className="section-label">{kicker}</p>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">{children}</CardContent>
    </Card>
  )
}

function ArrayCard({
  heading,
  index,
  onRemove,
  children,
}: {
  heading: string
  index: number
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <div className="space-y-3 border border-border bg-secondary/65 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {heading} {index + 1}
        </span>
        <button
          type="button"
          aria-label={`Remove ${heading.toLowerCase()}`}
          onClick={onRemove}
          className="text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  )
}

function BulletListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  const safeItems = items.length > 0 ? items : [""]

  function updateItem(index: number, value: string) {
    const next = [...safeItems]
    next[index] = value
    onChange(next)
  }

  function addItem() {
    onChange([...safeItems, ""])
  }

  function removeItem(index: number) {
    const next = safeItems.filter((_, itemIndex) => itemIndex !== index)
    onChange(next.length > 0 ? next : [""])
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add point
        </button>
      </div>
      <div className="space-y-2">
        {safeItems.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="select-none text-sm text-muted-foreground">•</span>
            <Input
              value={item}
              onChange={(event) => updateItem(index, event.target.value)}
              placeholder={`${placeholder} ${index + 1}`}
              className="flex-1"
            />
            <button
              type="button"
              aria-label="Remove point"
              onClick={() => removeItem(index)}
              className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExperienceEntryForm({
  heading,
  entry,
  index,
  onChange,
  onRemove,
}: {
  heading: string
  entry: CvExperience
  index: number
  onChange: (index: number, entry: CvExperience) => void
  onRemove: (index: number) => void
}) {
  const set = <K extends keyof CvExperience>(field: K, value: CvExperience[K]) =>
    onChange(index, { ...entry, [field]: value })

  return (
    <ArrayCard heading={heading} index={index} onRemove={() => onRemove(index)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Job Title"
          value={entry.title}
          onChange={(value) => set("title", value)}
          placeholder="Research Engineer Intern"
        />
        <Field
          label="Company"
          value={entry.company}
          onChange={(value) => set("company", value)}
          placeholder="Manchester Metropolitan University"
        />
        <Field
          label="Location"
          value={entry.location ?? ""}
          onChange={(value) => set("location", value)}
          placeholder="Manchester, UK"
        />
        <Field
          label="Start Date"
          value={entry.start_date ?? ""}
          onChange={(value) => set("start_date", value)}
          placeholder="Jun 2023"
        />
        <Field
          label="End Date"
          value={entry.end_date ?? ""}
          onChange={(value) => set("end_date", value)}
          placeholder="Sep 2023 or Present"
        />
      </div>
      <Field
        label="Description"
        value={entry.description}
        onChange={(value) => set("description", value)}
        placeholder="Short paragraph summary of the role."
        multiline
      />
      <BulletListEditor
        label="Bullet points"
        items={entry.highlights ?? []}
        onChange={(value) => set("highlights", value)}
        placeholder="Impact statement"
      />
    </ArrayCard>
  )
}

function EducationEntryForm({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: CvEducation
  index: number
  onChange: (index: number, entry: CvEducation) => void
  onRemove: (index: number) => void
}) {
  const set = <K extends keyof CvEducation>(field: K, value: CvEducation[K]) =>
    onChange(index, { ...entry, [field]: value })

  return (
    <ArrayCard heading="Education" index={index} onRemove={() => onRemove(index)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Institution"
          value={entry.institution}
          onChange={(value) => set("institution", value)}
          placeholder="University of Manchester"
        />
        <Field
          label="Degree"
          value={entry.degree}
          onChange={(value) => set("degree", value)}
          placeholder="Postgraduate Diploma"
        />
        <Field
          label="Field of Study"
          value={entry.field ?? ""}
          onChange={(value) => set("field", value)}
          placeholder="Artificial Intelligence"
        />
        <Field
          label="Location"
          value={entry.location ?? ""}
          onChange={(value) => set("location", value)}
          placeholder="Manchester, UK"
        />
        <Field
          label="Start Date"
          value={entry.start_date ?? ""}
          onChange={(value) => set("start_date", value)}
          placeholder="Sep 2024"
        />
        <Field
          label="End Date"
          value={entry.end_date ?? ""}
          onChange={(value) => set("end_date", value)}
          placeholder="Aug 2025"
        />
        <Field
          label="Grade"
          value={entry.grade ?? ""}
          onChange={(value) => set("grade", value)}
          placeholder="Distinction"
        />
        <Field
          label="GPA"
          value={entry.gpa ?? ""}
          onChange={(value) => set("gpa", value)}
          placeholder="3.9 / 4.0"
        />
      </div>
      <Field
        label="Honors"
        value={entry.honors ?? ""}
        onChange={(value) => set("honors", value)}
        placeholder="Dean’s List, Best Final Project"
      />
      <div className="space-y-1.5">
        <Label>Relevant Modules</Label>
        <TagInput
          value={entry.relevant_modules ?? []}
          onChange={(value) => set("relevant_modules", value)}
          placeholder="Add a module"
        />
      </div>
    </ArrayCard>
  )
}

function ProjectEntryForm({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: CvProject
  index: number
  onChange: (index: number, entry: CvProject) => void
  onRemove: (index: number) => void
}) {
  const set = <K extends keyof CvProject>(field: K, value: CvProject[K]) =>
    onChange(index, { ...entry, [field]: value })

  return (
    <ArrayCard heading="Project" index={index} onRemove={() => onRemove(index)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Project Name"
          value={entry.name}
          onChange={(value) => set("name", value)}
          placeholder="Fuzzy Text Summarization System"
        />
        <Field
          label="URL"
          value={entry.url ?? ""}
          onChange={(value) => set("url", value)}
          placeholder="https://github.com/..."
        />
        <Field
          label="Start Date"
          value={entry.start_date ?? ""}
          onChange={(value) => set("start_date", value)}
          placeholder="Apr 2024"
        />
        <Field
          label="End Date"
          value={entry.end_date ?? ""}
          onChange={(value) => set("end_date", value)}
          placeholder="Present"
        />
      </div>
      <Field
        label="Summary"
        value={entry.description}
        onChange={(value) => set("description", value)}
        placeholder="One-line overview of the project."
        multiline
        rows={3}
      />
      <div className="space-y-1.5">
        <Label>Technologies</Label>
        <TagInput
          value={entry.technologies ?? []}
          onChange={(value) => set("technologies", value)}
          placeholder="Add a technology"
        />
      </div>
      <BulletListEditor
        label="Bullet points"
        items={entry.highlights ?? []}
        onChange={(value) => set("highlights", value)}
        placeholder="Project impact"
      />
    </ArrayCard>
  )
}

export function CvEditorForm({
  value,
  onChange,
  documentName,
  onDocumentNameChange,
  footer,
  className,
}: {
  value: NormalizedCvData
  onChange: (value: NormalizedCvData) => void
  documentName?: string
  onDocumentNameChange?: (value: string) => void
  footer?: ReactNode
  className?: string
}) {
  const set = <K extends keyof NormalizedCvData>(field: K, nextValue: NormalizedCvData[K]) =>
    onChange({ ...value, [field]: nextValue })

  const updateExperience = (index: number, entry: CvExperience) => {
    const next = [...value.experience]
    next[index] = entry
    set("experience", next)
  }

  const updateEducation = (index: number, entry: CvEducation) => {
    const next = [...value.education]
    next[index] = entry
    set("education", next)
  }

  const updateProject = (index: number, entry: CvProject) => {
    const next = [...value.projects]
    next[index] = entry
    set("projects", next)
  }

  const updateActivity = (index: number, entry: CvExperience) => {
    const next = [...(value.activities ?? [])]
    next[index] = entry
    set("activities", next)
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        {onDocumentNameChange && (
          <SectionCard kicker="Document" title="CV Label" icon={<FileText className="h-4 w-4" />}>
            <Field
              label="Name"
              value={documentName ?? ""}
              onChange={onDocumentNameChange}
              placeholder="Software Engineering CV"
            />
          </SectionCard>
        )}

        <SectionCard
          kicker="Personal"
          title="Contact Information"
          icon={<UserRound className="h-4 w-4" />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Full Name"
              value={value.name ?? ""}
              onChange={(nextValue) => set("name", nextValue)}
              placeholder="Michael Ogunjimi"
            />
            <Field
              label="Email"
              value={value.email ?? ""}
              onChange={(nextValue) => set("email", nextValue)}
              placeholder="email@example.com"
            />
            <Field
              label="Phone"
              value={value.phone ?? ""}
              onChange={(nextValue) => set("phone", nextValue)}
              placeholder="+44 7xxx xxxxxx"
            />
            <Field
              label="Location"
              value={value.location ?? ""}
              onChange={(nextValue) => set("location", nextValue)}
              placeholder="Manchester, United Kingdom"
            />
            <Field
              label="LinkedIn"
              value={value.linkedin ?? ""}
              onChange={(nextValue) => set("linkedin", nextValue)}
              placeholder="linkedin.com/in/username"
            />
            <Field
              label="Website"
              value={value.website ?? ""}
              onChange={(nextValue) => set("website", nextValue)}
              placeholder="portfolio.example.com"
            />
          </div>
          <Field
            label="Professional Summary"
            value={value.summary ?? ""}
            onChange={(nextValue) => set("summary", nextValue)}
            placeholder="Short professional summary tailored to the role."
            multiline
          />
        </SectionCard>

        <SectionCard
          kicker="Work history"
          title="Experience"
          icon={<Briefcase className="h-4 w-4" />}
        >
          <div className="space-y-3">
            {value.experience.map((entry, index) => (
              <ExperienceEntryForm
                key={index}
                heading="Experience"
                entry={entry}
                index={index}
                onChange={updateExperience}
                onRemove={(removeIndex) =>
                  set("experience", value.experience.filter((_, entryIndex) => entryIndex !== removeIndex))
                }
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                set("experience", [
                  ...value.experience,
                  {
                    company: "",
                    title: "",
                    description: "",
                    start_date: "",
                    end_date: "",
                    location: "",
                    highlights: [],
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add Experience
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          kicker="Academic"
          title="Education"
          icon={<GraduationCap className="h-4 w-4" />}
        >
          <div className="space-y-3">
            {value.education.map((entry, index) => (
              <EducationEntryForm
                key={index}
                entry={entry}
                index={index}
                onChange={updateEducation}
                onRemove={(removeIndex) =>
                  set("education", value.education.filter((_, entryIndex) => entryIndex !== removeIndex))
                }
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                set("education", [
                  ...value.education,
                  {
                    institution: "",
                    degree: "",
                    field: "",
                    location: "",
                    start_date: "",
                    end_date: "",
                    grade: "",
                    gpa: "",
                    honors: "",
                    relevant_modules: [],
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add Education
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          kicker="Portfolio"
          title="Projects"
          icon={<FolderKanban className="h-4 w-4" />}
        >
          <div className="space-y-3">
            {value.projects.map((entry, index) => (
              <ProjectEntryForm
                key={index}
                entry={entry}
                index={index}
                onChange={updateProject}
                onRemove={(removeIndex) =>
                  set("projects", value.projects.filter((_, entryIndex) => entryIndex !== removeIndex))
                }
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                set("projects", [
                  ...value.projects,
                  {
                    name: "",
                    description: "",
                    technologies: [],
                    highlights: [],
                    url: "",
                    start_date: "",
                    end_date: "",
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add Project
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          kicker="Activities"
          title="Leadership & Activities"
          icon={<Rocket className="h-4 w-4" />}
        >
          <div className="space-y-3">
            {(value.activities ?? []).map((entry, index) => (
              <ExperienceEntryForm
                key={index}
                heading="Activity"
                entry={entry}
                index={index}
                onChange={updateActivity}
                onRemove={(removeIndex) =>
                  set("activities", (value.activities ?? []).filter((_, entryIndex) => entryIndex !== removeIndex))
                }
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                set("activities", [
                  ...(value.activities ?? []),
                  {
                    company: "",
                    title: "",
                    description: "",
                    start_date: "",
                    end_date: "",
                    location: "",
                    highlights: [],
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add Activity
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          kicker="Abilities"
          title="Skills"
          icon={<Award className="h-4 w-4" />}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Skills</Label>
              <TagInput
                value={value.skills}
                onChange={(nextValue) => set("skills", nextValue)}
                placeholder="Add a skill"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Certifications</Label>
              <TagInput
                value={value.certifications ?? []}
                onChange={(nextValue) => set("certifications", nextValue)}
                placeholder="Add a certification"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          kicker="Communication"
          title="Languages"
          icon={<Languages className="h-4 w-4" />}
        >
          <div className="space-y-1.5">
            <Label>Languages</Label>
            <TagInput
              value={value.languages ?? []}
              onChange={(nextValue) => set("languages", nextValue)}
              placeholder="Add a language"
            />
          </div>
        </SectionCard>

        {footer}
      </div>
    </div>
  )
}
