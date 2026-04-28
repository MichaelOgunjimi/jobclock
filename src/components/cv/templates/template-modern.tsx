import type { CvData, CvExperience, CvEducation, CvProject } from "@/lib/supabase/database.types"
import { ProjectLinks } from "@/components/cv/templates/project-links"

interface CvTemplateProps {
  cv: CvData
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontWeight: 700,
        fontSize: 12.5,
        textAlign: "left",
        borderBottom: "1.5px solid #333",
        paddingBottom: 2,
        marginBottom: 7,
        marginTop: 13,
        color: "#1a1a1a",
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
  const titleAndCompany = entry.company
    ? `${entry.title} — ${entry.company}`
    : entry.title
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 12.5 }}>{titleAndCompany}</span>
        {dates && (
          <span style={{ fontSize: 11.5, color: "#555", whiteSpace: "nowrap", marginLeft: 8 }}>
            {dates}
          </span>
        )}
      </div>
      {entry.location && (
        <div style={{ fontSize: 11.5, color: "#666", fontStyle: "italic", marginTop: 1 }}>
          {entry.location}
        </div>
      )}
      {entry.highlights && entry.highlights.length > 0 && (
        <ul style={{ margin: "5px 0 0", paddingLeft: 18 }}>
          {entry.highlights.map((h, i) => (
            <li key={i} style={{ fontSize: 12, lineHeight: 1.5, color: "#1a1a1a", marginBottom: 1 }}>
              {h}
            </li>
          ))}
        </ul>
      )}
      {(!entry.highlights || entry.highlights.length === 0) && entry.description && (
        <p style={{ fontSize: 12, lineHeight: 1.5, color: "#1a1a1a", margin: "5px 0 0" }}>
          {entry.description}
        </p>
      )}
    </div>
  )
}

function EducationEntry({ entry }: { entry: CvEducation }) {
  const dates = [entry.start_date, entry.end_date].filter(Boolean).join(" – ")
  const degreeLabel = entry.field ? `${entry.degree} — ${entry.field}` : entry.degree
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 12.5 }}>{degreeLabel}</span>
        {dates && (
          <span style={{ fontSize: 11.5, color: "#555", whiteSpace: "nowrap", marginLeft: 8 }}>
            {dates}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: "#555", fontStyle: "italic", marginTop: 2 }}>
        {entry.institution}
        {entry.location && `, ${entry.location}`}
      </div>
      {entry.gpa && (
        <div style={{ fontSize: 11.5, color: "#555", marginTop: 2 }}>GPA: {entry.gpa}</div>
      )}
      {entry.honors && (
        <div style={{ fontSize: 11.5, color: "#555", marginTop: 2 }}>{entry.honors}</div>
      )}
      {entry.grade && !entry.gpa && (
        <div style={{ fontSize: 11.5, color: "#555", marginTop: 2 }}>{entry.grade}</div>
      )}
      {entry.relevant_modules && entry.relevant_modules.length > 0 && (
        <div style={{ fontSize: 11.5, color: "#555", marginTop: 3 }}>
          Relevant Modules: {entry.relevant_modules.join(", ")}
        </div>
      )}
    </div>
  )
}

function ProjectEntry({ entry }: { entry: CvProject }) {
  const dates = dateRange(entry.start_date, entry.end_date)
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 12.5 }}>
          {entry.name}
          <ProjectLinks project={entry} style={{ fontSize: 10, fontWeight: 700, color: "#2563eb" }} />
        </span>
        {dates && (
          <span style={{ fontSize: 11.5, color: "#555", whiteSpace: "nowrap", marginLeft: 8 }}>
            {dates}
          </span>
        )}
      </div>
      {entry.highlights && entry.highlights.length > 0 && (
        <ul style={{ margin: "5px 0 0", paddingLeft: 18 }}>
          {entry.highlights.map((h, i) => (
            <li key={i} style={{ fontSize: 12, lineHeight: 1.5, color: "#1a1a1a", marginBottom: 1 }}>
              {h}
            </li>
          ))}
        </ul>
      )}
      {(!entry.highlights || entry.highlights.length === 0) && entry.description && (
        <p style={{ fontSize: 12, lineHeight: 1.5, color: "#1a1a1a", margin: "5px 0 0" }}>
          {entry.description}
        </p>
      )}
      {entry.technologies && entry.technologies.length > 0 && (
        <div style={{ fontSize: 11.5, color: "#555", marginTop: 4 }}>
          Technologies Used: {entry.technologies.join(", ")}
        </div>
      )}
    </div>
  )
}

export function TemplateModern({ cv }: CvTemplateProps) {
  const contactParts: string[] = []
  if (cv.email) contactParts.push(cv.email)
  if (cv.phone) contactParts.push(cv.phone)
  if (cv.location) contactParts.push(cv.location)
  const linkParts = [cv.linkedin, cv.website].filter(Boolean)

  return (
    <div
      style={{
        fontFamily: "'Arial', sans-serif",
        background: "white",
        padding: "28px 38px",
        color: "#1a1a1a",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        {cv.name && (
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            {cv.name}
          </div>
        )}
        {(contactParts.length > 0 || linkParts.length > 0) && (
          <div style={{ fontSize: 11.5, color: "#555" }}>
            {contactParts.join(" | ")}
            {contactParts.length > 0 && linkParts.length > 0 && " | "}
            {linkParts.map((url, i, arr) => (
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

      {/* Summary */}
      {cv.summary && (
        <>
          <SectionHeading>Professional Summary</SectionHeading>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: "#1a1a1a", margin: 0 }}>
            {cv.summary}
          </p>
        </>
      )}

      {/* Education */}
      {cv.education && cv.education.length > 0 && (
        <>
          <SectionHeading>Education</SectionHeading>
          {cv.education.map((edu, i) => (
            <EducationEntry key={i} entry={edu} />
          ))}
        </>
      )}

      {/* Experience */}
      {cv.experience && cv.experience.length > 0 && (
        <>
          <SectionHeading>Work Experience</SectionHeading>
          {cv.experience.map((exp, i) => (
            <ExperienceEntry key={i} entry={exp} />
          ))}
        </>
      )}

      {/* Projects */}
      {cv.projects && cv.projects.length > 0 && (
        <>
          <SectionHeading>Projects</SectionHeading>
          {cv.projects.map((proj, i) => (
            <ProjectEntry key={i} entry={proj} />
          ))}
        </>
      )}

      {/* Activities */}
      {cv.activities && cv.activities.length > 0 && (
        <>
          <SectionHeading>Activities</SectionHeading>
          {cv.activities.map((act, i) => (
            <ExperienceEntry key={i} entry={act} />
          ))}
        </>
      )}

      {/* Skills */}
      {cv.skills && cv.skills.length > 0 && (
        <>
          <SectionHeading>Skills &amp; Technologies</SectionHeading>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: "#1a1a1a", margin: 0 }}>
            {cv.skills.join(", ")}
          </p>
        </>
      )}

      {/* Certifications */}
      {cv.certifications && cv.certifications.length > 0 && (
        <>
          <SectionHeading>Certifications</SectionHeading>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: "#1a1a1a", margin: 0 }}>
            {cv.certifications.join(", ")}
          </p>
        </>
      )}

      {/* Languages */}
      {cv.languages && cv.languages.length > 0 && (
        <>
          <SectionHeading>Languages</SectionHeading>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: "#1a1a1a", margin: 0 }}>
            {cv.languages.join(", ")}
          </p>
        </>
      )}
    </div>
  )
}
