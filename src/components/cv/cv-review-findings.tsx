import { cn } from "@/lib/utils"
import type {
  CvReviewFinding,
  CvReviewFindingCategory,
  CvReviewFindingSeverity,
} from "@/lib/ai/cv-review-schemas"

const CATEGORY_LABELS: Record<CvReviewFindingCategory, string> = {
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

export function CvReviewFindings({ findings }: { findings: CvReviewFinding[] }) {
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
              {group.map((finding, idx) => (
                <li key={idx} className="space-y-1.5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[12px] font-semibold text-foreground">
                      {CATEGORY_LABELS[finding.category]}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {locationHint(finding)}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-foreground">
                    {finding.message}
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Suggestion: </span>
                    {finding.suggestion}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
