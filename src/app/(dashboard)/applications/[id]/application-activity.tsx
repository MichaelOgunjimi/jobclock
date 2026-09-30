import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface ApplicationActivityEvent {
  id: string
  eventType: string
  metadata: unknown
  createdAt: string
}

const EVENT_LABELS: Record<string, string> = {
  "application.created": "Application saved",
  "application.details_updated": "Job details updated",
  "application.description_updated": "Job description updated",
  "application.notes_updated": "Notes updated",
  "application.status_changed": "Status changed",
  "application.cv_selected": "Base CV changed",
  "application.cv_generated": "Tailored CV generated",
  "application.cv_edited": "Tailored CV edited",
  "application.cover_letter_selected": "Cover letter changed",
  "application.cover_letter_generated": "Cover letter generated",
  "application.cover_letter_edited": "Cover letter edited",
  "application.writing_style_updated": "Writing style updated",
  "application.follow_up_updated": "Follow-up updated",
  "application.interview_prep_generated": "Interview preparation generated",
  "application.company_research_generated": "Company research generated",
  "application.interview_question_added": "Interview question added",
  "application.interview_answer_generated": "Interview answer generated",
  "application.interview_answer_saved": "Interview answer saved",
  "application.deleted": "Application deleted",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function statusDetail(metadata: unknown) {
  if (!isRecord(metadata)) return null
  const from = typeof metadata.fromStatus === "string" ? metadata.fromStatus : null
  const to = typeof metadata.toStatus === "string" ? metadata.toStatus : null
  if (!to) return null
  const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
  return from ? `${label(from)} → ${label(to)}` : label(to)
}

function changeDetail(metadata: unknown) {
  if (!isRecord(metadata) || !isRecord(metadata.changes)) return null
  const labels: Record<string, string> = {
    customTitle: "role",
    customCompany: "company",
    customLocation: "location",
    customSalaryText: "salary",
    customDescription: "description",
    notes: "notes",
    selectedCvId: "CV",
    coverLetterId: "cover letter",
    structureId: "structure",
    coverLetterTone: "tone",
    followUpDueAt: "date",
    followUpNotes: "notes",
  }
  const fields = Object.keys(metadata.changes).map((field) => labels[field] ?? field)
  return fields.length ? fields.join(", ") : null
}

function eventDetail(event: ApplicationActivityEvent) {
  if (event.eventType === "application.status_changed") return statusDetail(event.metadata)
  if (event.eventType.endsWith("_updated") || event.eventType.endsWith("_selected")) {
    return changeDetail(event.metadata)
  }
  if (!isRecord(event.metadata)) return null
  if (event.eventType === "application.interview_prep_generated" && typeof event.metadata.questionCount === "number") {
    return `${event.metadata.questionCount} question${event.metadata.questionCount === 1 ? "" : "s"}`
  }
  if (event.eventType === "application.cv_generated" && typeof event.metadata.atsScore === "number") {
    return `ATS score ${event.metadata.atsScore}`
  }
  return null
}

export function ApplicationActivity({ events }: { events: ApplicationActivityEvent[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="space-y-0" aria-label="Application activity">
            {events.map((event, index) => {
              const detail = eventDetail(event)
              return (
                <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < events.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[5px] top-3 h-full border-l border-border" />
                  )}
                  <span aria-hidden="true" className="relative mt-1.5 h-3 w-3 shrink-0 border-2 border-background bg-foreground ring-1 ring-border" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {EVENT_LABELS[event.eventType] ?? "Application updated"}
                    </p>
                    {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      You · {new Intl.DateTimeFormat("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(event.createdAt))}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
