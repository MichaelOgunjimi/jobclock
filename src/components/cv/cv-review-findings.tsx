"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  CvReviewFinding,
  CvReviewFindingCategory,
  CvReviewFindingSeverity,
} from "@/lib/ai/cv-review-schemas"

export const CATEGORY_LABELS: Record<CvReviewFindingCategory, string> = {
  weak_verb: "Weak verb",
  missing_metric: "Missing metric",
  bullet_too_short: "Bullet too short",
  bullet_too_long: "Bullet too long",
  generic_filler: "Generic filler",
  summary_issue: "Summary issue",
  missing_date: "Missing date",
  skills_section: "Skills section",
  ats_hazard: "ATS hazard",
}

const SEVERITY_ORDER: CvReviewFindingSeverity[] = ["high", "medium", "low"]

const SEVERITY_LABELS: Record<CvReviewFindingSeverity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

const SEVERITY_ACCENT: Record<CvReviewFindingSeverity, string> = {
  high: "text-destructive border-destructive/20 bg-destructive/10",
  medium:
    "text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:bg-amber-950/40",
  low: "text-muted-foreground border-border bg-secondary",
}

function locationHint(finding: CvReviewFinding): string {
  const { section, bulletIndex } = finding.location
  if (bulletIndex != null) return `${section} · bullet ${bulletIndex + 1}`
  return section
}

type FindingActions = {
  /** Replace the text the finding points at. Present only when the CV is editable here. */
  onApply?: (finding: CvReviewFinding, text: string) => void
  onDismiss?: (finding: CvReviewFinding) => void
  /** Scroll to and focus the CV field for a finding that has no single text to edit (skills, education). */
  onJump?: (finding: CvReviewFinding) => void
  /** How many skills the CV lists, shown on the skills finding. */
  skillsCount?: number
}

// 44px touch targets on phones, the compact size from sm up.
const BUTTON_CLASS = "h-11 sm:h-9"

function FindingCard({
  finding,
  onApply,
  onDismiss,
  onJump,
  skillsCount,
}: { finding: CvReviewFinding } & FindingActions) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(finding.rewrite ?? finding.original ?? "")
  const label = CATEGORY_LABELS[finding.category]
  const { section } = finding.location
  const hasText = finding.original !== undefined
  const canApply = onApply && finding.rewrite && hasText
  // Findings without a rewrite (missing metric, filler...) can still be fixed by hand in place.
  const canEditText = onApply && !finding.rewrite && hasText
  const canJump = onJump && !hasText && section !== "summary"
  const unchanged = draft.trim() === (finding.original ?? "").trim()

  const textarea = (ariaLabel: string) => (
    <textarea
      autoFocus
      aria-label={ariaLabel}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setEditing(false)
      }}
      rows={3}
      // 16px on phones: iOS Safari zooms the page when a smaller field is focused.
      className="w-full resize-y border border-input bg-background px-3 py-2 text-base leading-relaxed outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/15 sm:text-[13px]"
    />
  )

  return (
    <li className="space-y-1.5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[12px] font-semibold text-foreground">{label}</span>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {locationHint(finding)}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-foreground">{finding.message}</p>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Suggestion: </span>
        {finding.suggestion}
      </p>

      {section === "skills" && skillsCount !== undefined && (
        <p className="text-[12px] text-muted-foreground">
          <span className="font-medium text-foreground">Now: </span>
          {skillsCount} {skillsCount === 1 ? "skill" : "skills"} listed
        </p>
      )}

      {hasText && (
        <div className="space-y-2 border bg-secondary/50 p-3">
          {finding.original && (
            <p className="whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Now: </span>
              {finding.original}
            </p>
          )}
          {canApply &&
            (editing ? (
              textarea(`Edit suggested rewrite for ${label}`)
            ) : (
              <p className="text-[13px] leading-relaxed text-foreground">
                <span className="font-medium">Suggested: </span>
                {finding.rewrite}
              </p>
            ))}
          {canEditText && editing && textarea(`Edit text for ${label}`)}
        </div>
      )}

      {(canApply || canEditText || canJump || onDismiss) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {canApply && (
            <>
              <Button
                size="sm"
                className={BUTTON_CLASS}
                disabled={editing && !draft.trim()}
                aria-label={`${editing ? "Apply edited rewrite" : "Apply suggested fix"} for ${label}`}
                onClick={() => onApply(finding, editing ? draft.trim() : finding.rewrite!)}
              >
                {editing ? "Apply edited" : "Apply fix"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={BUTTON_CLASS}
                aria-label={`${editing ? "Cancel editing" : "Edit first"} for ${label}`}
                onClick={() => {
                  setDraft(finding.rewrite!)
                  setEditing((value) => !value)
                }}
              >
                {editing ? "Cancel" : "Edit first"}
              </Button>
            </>
          )}
          {canEditText &&
            (editing ? (
              <>
                <Button
                  size="sm"
                  className={BUTTON_CLASS}
                  disabled={!draft.trim() || unchanged}
                  aria-label={`Apply edit for ${label}`}
                  onClick={() => onApply(finding, draft.trim())}
                >
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={BUTTON_CLASS}
                  aria-label={`Cancel editing for ${label}`}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className={BUTTON_CLASS}
                aria-label={`Edit text for ${label}`}
                onClick={() => {
                  setDraft(finding.original!)
                  setEditing(true)
                }}
              >
                Edit
              </Button>
            ))}
          {canJump && (
            <Button
              size="sm"
              className={BUTTON_CLASS}
              aria-label={`Go to ${section} for ${label}`}
              onClick={() => onJump(finding)}
            >
              Edit {section}
            </Button>
          )}
          {onDismiss && (
            // first:-ml-4 cancels the button's own padding so a lone Dismiss lines up with the card text.
            <Button
              size="sm"
              variant="ghost"
              className={cn(BUTTON_CLASS, "first:-ml-4")}
              aria-label={`Dismiss ${label} finding`}
              onClick={() => onDismiss(finding)}
            >
              Dismiss
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

export function CvReviewFindings({
  findings,
  onApply,
  onDismiss,
  onJump,
  skillsCount,
}: { findings: CvReviewFinding[] } & FindingActions) {
  if (findings.length === 0) {
    return (
      <div className="border bg-secondary px-6 py-8 text-center text-[13px] text-muted-foreground">
        No content issues found in this CV.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {SEVERITY_ORDER.map((severity) => {
        const group = findings.filter((f) => f.severity === severity)
        if (group.length === 0) return null
        return (
          <section key={severity} className="border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <span
                className={cn(
                  "inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
                  SEVERITY_ACCENT[severity],
                )}
              >
                {SEVERITY_LABELS[severity]}
              </span>
              <span className="text-[12px] tabular-nums text-muted-foreground">
                {group.length} {group.length === 1 ? "issue" : "issues"}
              </span>
            </div>
            <ul className="divide-y">
              {group.map((finding) => (
                <FindingCard
                  // Remounts when the review is replaced, so an open editor never shows a stale draft.
                  key={`${finding.category}|${finding.location.section}|${finding.location.entryId}|${finding.location.bulletIndex}|${finding.message}`}
                  finding={finding}
                  onApply={onApply}
                  onDismiss={onDismiss}
                  onJump={onJump}
                  skillsCount={skillsCount}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
