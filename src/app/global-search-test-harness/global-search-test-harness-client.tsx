"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { SelectInput } from "@/components/ui/select"
import { GenerationJobsContext } from "@/contexts/generation-jobs-context"
import { ApplicationDetail } from "@/app/(dashboard)/applications/[id]/application-detail"

export function GlobalSearchTestHarnessClient({ view }: { view?: string }) {
  return (
    <GenerationJobsContext.Provider
      value={{
        userId: "playwright-user",
        jobs: [],
        getActiveJob: () => undefined,
        getApplicationLabel: () => null,
        getCvLabel: () => null,
        trackJob: () => undefined,
        recentJobs: [],
        unseenJobs: [],
        unseenCount: 0,
        searchItems: [
          {
            id: "application:platform-engineer",
            type: "application",
            label: "Platform Engineer",
            description: "Acme Systems",
            href: "/#platform-engineer",
          },
          {
            id: "cv:backend",
            type: "cv",
            label: "Backend CV",
            description: "Primary CV",
            href: "/#backend-cv",
          },
        ],
        searchItemsLoading: false,
        searchItemsError: false,
      }}
    >
      <DashboardShell
        aiKeyBanner={null}
        showExtensionBanner={false}
        userProfile={{
          email: "playwright@example.com",
          fullName: "Playwright User",
          avatarUrl: null,
        }}
      >
        {view === "application" ? (
          <ApplicationDetail
            application={{
              id: "responsive-application",
              slug: "principal-frontend-platform-engineer",
              status: "applied",
              created_at: "2026-10-19T09:00:00.000Z",
              applied_at: "2026-10-19T09:00:00.000Z",
              custom_title: null,
              custom_company: null,
              custom_location: null,
              custom_salary_text: null,
              custom_description: [
                "Build accessible, responsive product interfaces.",
                "Own the shared component system across multiple product teams.",
                "Partner with design and research on complex customer journeys.",
                "Improve frontend performance and application reliability.",
                "Coach engineers through design and implementation reviews.",
                "Define accessibility standards and measurable quality gates.",
                "Lead migrations without interrupting customer workflows.",
                "Document decisions and communicate progress clearly.",
              ].join("\n"),
              selected_cv_id: "cv-primary",
              structure_id: "style-editorial",
              cover_letter_tone: "professional",
              notes: "Ask about platform ownership, accessibility targets, and how product teams share frontend infrastructure.",
              jobs_cache: {
                title: "Principal Frontend Platform Engineer for Customer Experiences",
                company: "International Product Engineering Group",
                location: "London, United Kingdom (Hybrid with flexible remote working)",
                description: "Build accessible, responsive product interfaces.",
                salary_min: 90000,
                salary_max: 120000,
                salary_currency: "GBP",
                posted_at: "2026-10-18T09:00:00.000Z",
                source: "manual",
                is_easy_apply: true,
                url: "https://example.com/jobs/frontend-platform",
              },
            } as never}
            cvs={[
              {
                id: "cv-primary",
                name: "Senior Frontend Engineering CV with Product Platform Experience",
                is_primary: true,
                created_at: "2026-10-10T09:00:00.000Z",
              },
            ]}
            writingStyles={[
              {
                id: "style-editorial",
                label: "Clear editorial structure for technical leadership roles",
                default_tone: "professional",
                is_built_in: true,
              },
            ]}
            tailoredCvs={[
              {
                id: "tailored-cv-1",
                cv_json: {},
                skills_gap: {
                  gap: ["Design systems governance", "Internationalisation strategy"],
                  changes: "Strengthened platform leadership and accessibility evidence throughout the CV.",
                },
                ats_score: 82,
                created_at: "2026-10-19T10:00:00.000Z",
              },
            ]}
            generatedCoverLetter={{
              id: "cover-letter-1",
              content: "I lead frontend platform work that helps product teams ship accessible customer experiences with confidence.",
              tone: "professional",
              label: "Technical leadership",
              created_at: "2026-10-19T10:30:00.000Z",
            }}
            followUpDueAt="2026-10-18T09:00:00.000Z"
            followUpNotes="Email the hiring manager with the accessibility case study and platform migration summary."
            activity={[
              {
                id: "activity-1",
                eventType: "application.status_changed",
                metadata: { fromStatus: "saved", toStatus: "applied" },
                createdAt: "2026-10-19T09:15:00.000Z",
              },
              {
                id: "activity-2",
                eventType: "application.cv_generated",
                metadata: { atsScore: 82 },
                createdAt: "2026-10-19T10:00:00.000Z",
              },
            ]}
          />
        ) : (
          <div className="page-shell">
            <h1 className="page-title">Layout fixture</h1>
            <SelectInput
              aria-label="Fixture select"
              className="max-w-xs"
              defaultValue="first"
              options={[{ value: "first", label: "First option" }]}
            />
            <div data-testid="scroll-probe" className="h-[1800px] border" />
          </div>
        )}
      </DashboardShell>
    </GenerationJobsContext.Provider>
  )
}
