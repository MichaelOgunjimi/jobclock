import type { CvData, CvExperience, CvEducation, CvProject } from "@/lib/supabase/database.types"
import { ProjectLinks } from "@/components/cv/templates/project-links"

interface CvTemplateProps {
  cv: CvData
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 18,
        marginBottom: 8,
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        color: "#1a1a1a",
        borderBottom: "1px solid #1a1a1a",
        paddingBottom: 3,
      }}
    >
      {children}
    </div>
  )
}

function dateRange(start?: string, end?: string): string {
  if (!start && !end) return ""
  return [start, end].filter(Boolean).join(" – ")
}

function ExperienceEntry({ entry }: { entry: CvExperience }) {
  const dates = dateRange(entry.start_date, entry.end_date)

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
          {entry.company}
          {entry.description ? ` (${entry.description})` : ""}
        </span>
        {entry.location && (
          <span style={{ fontSize: 11, whiteSpace: "nowrap" }}>{entry.location}</span>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2, gap: 16 }}>
        <span style={{ fontSize: 11 }}>{entry.title}</span>
        {dates && (
          <span style={{ fontSize: 11, whiteSpace: "nowrap" }}>{dates}</span>
        )}
      </div>

      {entry.highlights && entry.highlights.length > 0 && (
        <ul style={{ margin: "4px 0 0", paddingLeft: 18, listStyleType: "disc" }}>
          {entry.highlights.map((highlight, index) => (
            <li
              key={index}
              style={{
                fontSize: 11,
                lineHeight: 1.6,
                color: "#1a1a1a",
                marginBottom: 1,
              }}
            >
              {highlight}
            </li>
          ))}
        </ul>
      )}
      {(!entry.highlights || entry.highlights.length === 0) && entry.description && (
        <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.6, color: "#1a1a1a" }}>
          {entry.description}
        </p>
      )}
    </div>
  )
}

function EducationEntry({ entry }: { entry: CvEducation }) {
  const dates = dateRange(entry.start_date, entry.end_date)
  const degreeLabel = entry.field ? `${entry.degree}, ${entry.field}` : entry.degree

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{entry.institution}</span>
        {entry.location && (
          <span style={{ fontSize: 11, whiteSpace: "nowrap" }}>{entry.location}</span>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2, gap: 16 }}>
        <span style={{ fontSize: 11 }}>{degreeLabel}</span>
        {dates && (
          <span style={{ fontSize: 11, whiteSpace: "nowrap" }}>{dates}</span>
        )}
      </div>

      <div style={{ paddingLeft: 16, marginTop: 3, color: "#333" }}>
        {entry.gpa && <div style={{ fontSize: 11 }}>GPA: {entry.gpa}</div>}
        {entry.grade && !entry.gpa && <div style={{ fontSize: 11 }}>{entry.grade}</div>}
        {entry.honors && <div style={{ fontSize: 11 }}>{entry.honors}</div>}
        {entry.relevant_modules && entry.relevant_modules.length > 0 && (
          <div style={{ fontSize: 11 }}>Relevant Coursework: {entry.relevant_modules.join(", ")}</div>
        )}
      </div>
    </div>
  )
}

function ProjectEntry({ entry }: { entry: CvProject }) {
  const dates = dateRange(entry.start_date, entry.end_date)

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
          {entry.name}
          <ProjectLinks
            project={entry}
            style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "none" }}
          />
        </span>
        {dates && (
          <span style={{ fontSize: 11, whiteSpace: "nowrap" }}>{dates}</span>
        )}
      </div>

      {entry.highlights && entry.highlights.length > 0 && (
        <ul style={{ margin: "4px 0 0", paddingLeft: 18, listStyleType: "disc" }}>
          {entry.highlights.map((highlight, index) => (
            <li
              key={index}
              style={{
                fontSize: 11,
                lineHeight: 1.6,
                color: "#1a1a1a",
                marginBottom: 1,
              }}
            >
              {highlight}
            </li>
          ))}
        </ul>
      )}
      {(!entry.highlights || entry.highlights.length === 0) && entry.description && (
        <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.6, color: "#1a1a1a" }}>
          {entry.description}
        </p>
      )}
    </div>
  )
}

export function TemplateProfessional({ cv }: CvTemplateProps) {
  const headerContactParts: string[] = []
  if (cv.location) headerContactParts.push(cv.location)
  if (cv.phone) headerContactParts.push(`P: ${cv.phone}`)
  if (cv.email) headerContactParts.push(cv.email)

  const hasAdditionalSection =
    (cv.skills && cv.skills.length > 0) ||
    (cv.certifications && cv.certifications.length > 0) ||
    (cv.languages && cv.languages.length > 0)

  return (
    <div
      style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        color: "#1a1a1a",
        background: "white",
        padding: "28px 40px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        {cv.name && (
          <div
            style={{
              display: "inline-block",
              fontSize: 20,
              fontWeight: 700,
              borderBottom: "1px solid #1a1a1a",
              paddingBottom: 2,
              marginBottom: 6,
            }}
          >
            {cv.name}
          </div>
        )}

        {headerContactParts.length > 0 && (
          <div style={{ fontSize: 11 }}>
            {headerContactParts.join(" | ")}
          </div>
        )}

        {(cv.linkedin || cv.website) && (
          <div style={{ fontSize: 11, marginTop: 2 }}>
            {[cv.linkedin, cv.website].filter(Boolean).map((url, i, arr) => (
              <span key={`${url}-${i}`}>
                <a
                  href={url!.startsWith("http") ? url! : `https://${url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "inherit", textDecoration: "underline" }}
                >
                  {url}
                </a>
                {i < arr.length - 1 && " | "}
              </span>
            ))}
          </div>
        )}
      </div>

      {cv.summary && (
        <p style={{ margin: "0 0 10px", fontSize: 11, lineHeight: 1.6, color: "#1a1a1a" }}>
          {cv.summary}
        </p>
      )}

      {cv.education && cv.education.length > 0 && (
        <>
          <SectionHeading>Education</SectionHeading>
          {cv.education.map((entry, index) => (
            <EducationEntry key={index} entry={entry} />
          ))}
        </>
      )}

      {cv.experience && cv.experience.length > 0 && (
        <>
          <SectionHeading>Work Experience</SectionHeading>
          {cv.experience.map((entry, index) => (
            <ExperienceEntry key={index} entry={entry} />
          ))}
        </>
      )}

      {cv.projects && cv.projects.length > 0 && (
        <>
          <SectionHeading>University Projects</SectionHeading>
          {cv.projects.map((entry, index) => (
            <ProjectEntry key={index} entry={entry} />
          ))}
        </>
      )}

      {cv.activities && cv.activities.length > 0 && (
        <>
          <SectionHeading>Activities</SectionHeading>
          {cv.activities.map((entry, index) => (
            <ExperienceEntry key={index} entry={entry} />
          ))}
        </>
      )}

      {hasAdditionalSection && (
        <>
          <SectionHeading>Additional</SectionHeading>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: "#1a1a1a" }}>
            {cv.skills && cv.skills.length > 0 && (
              <div>
                <span style={{ fontWeight: 700 }}>Technical Skills:</span> {cv.skills.join(", ")}
              </div>
            )}
            {cv.certifications && cv.certifications.length > 0 && (
              <div>
                <span style={{ fontWeight: 700 }}>Certifications &amp; Training:</span> {cv.certifications.join(", ")}
              </div>
            )}
            {cv.languages && cv.languages.length > 0 && (
              <div>
                <span style={{ fontWeight: 700 }}>Languages:</span> {cv.languages.join(", ")}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
