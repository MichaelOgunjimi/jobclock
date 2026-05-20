import type { CvData, CvExperience, CvEducation, CvProject } from "@/lib/supabase/database.types"
import { ProjectLinks } from "@/components/cv/templates/project-links"

interface CvTemplateProps {
  cv: CvData
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 16,
        marginBottom: 7,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "stretch",
          gap: 10,
        }}
      >
        <span
          style={{
            width: 4,
            background: "#3b82f6",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "1.4px",
            color: "#1e293b",
            lineHeight: 1.2,
          }}
        >
          {children}
        </span>
      </div>
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
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 12.5, color: "#1e293b" }}>{entry.title}</span>
        {dates && (
          <span style={{ fontSize: 11.5, color: "#64748b", whiteSpace: "nowrap", marginLeft: 8 }}>
            {dates}
          </span>
        )}
      </div>
      {(entry.company || entry.location) && (
        <div style={{ fontSize: 11.5, color: "#555", marginTop: 1 }}>
          {entry.company}
          {entry.company && entry.location ? " — " : ""}
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
        <span style={{ fontWeight: 700, fontSize: 12.5, color: "#1e293b" }}>{degreeLabel}</span>
        {dates && (
          <span style={{ fontSize: 11.5, color: "#64748b", whiteSpace: "nowrap", marginLeft: 8 }}>
            {dates}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: "#555", fontStyle: "italic", marginTop: 2 }}>
        {entry.institution}
        {entry.location && `, ${entry.location}`}
      </div>
      {entry.gpa && <div style={{ fontSize: 11.5, color: "#555", marginTop: 2 }}>GPA: {entry.gpa}</div>}
      {entry.honors && <div style={{ fontSize: 11.5, color: "#555", marginTop: 2 }}>{entry.honors}</div>}
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
        <span style={{ fontWeight: 700, fontSize: 12.5, color: "#1e293b" }}>
          {entry.name}
          <ProjectLinks project={entry} style={{ fontSize: 10, fontWeight: 700, color: "#2563eb" }} />
        </span>
        {dates && (
          <span style={{ fontSize: 11.5, color: "#64748b", whiteSpace: "nowrap", marginLeft: 8 }}>
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

export function TemplateBold({ cv }: CvTemplateProps) {
  const contactParts: string[] = []
  if (cv.email) contactParts.push(cv.email)
  if (cv.phone) contactParts.push(cv.phone)
  if (cv.location) contactParts.push(cv.location)
  const linkParts = [cv.linkedin, cv.website].filter(Boolean)

  return (
    <div
      style={{
        fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
        background: "white",
        color: "#1a1a1a",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#1e293b",
          padding: "22px 36px",
        }}
      >
        {cv.name && (
          <div
            style={{
              fontSize: 23,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "1px",
              marginBottom: 4,
              lineHeight: 1.15,
            }}
          >
            {cv.name}
          </div>
        )}
        {cv.headline && (
          <div style={{ fontSize: 12.5, color: "#cbd5e1", marginBottom: 4 }}>
            {cv.headline}
          </div>
        )}
        {(contactParts.length > 0 || linkParts.length > 0) && (
          <div style={{ fontSize: 11.2, color: "#94a3b8", lineHeight: 1.4 }}>
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

      <div style={{ padding: "24px 36px" }}>
        {/* Summary */}
        {cv.summary && (
          <>
            <SectionHeading>Professional Summary</SectionHeading>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: "#1a1a1a", margin: 0 }}>{cv.summary}</p>
          </>
        )}

        {/* Skills */}
        {cv.skills && cv.skills.length > 0 && (
          <>
            <SectionHeading>Skills</SectionHeading>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {cv.skills.map((skill, i) => (
                <div
                  key={i}
                  style={{
                    background: "#f1f5f9",
                    color: "#334155",
                    padding: "2px 8px",
                    fontSize: 11,
                    borderRadius: 3,
                  }}
                >
                  {skill}
                </div>
              ))}
            </div>
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

        {/* Education */}
        {cv.education && cv.education.length > 0 && (
          <>
            <SectionHeading>Education</SectionHeading>
            {cv.education.map((edu, i) => (
              <EducationEntry key={i} entry={edu} />
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

        {/* Certifications */}
        {cv.certifications && cv.certifications.length > 0 && (
          <>
            <SectionHeading>Certifications</SectionHeading>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: "#1a1a1a", margin: 0 }}>
              {cv.certifications.join(", ")}
            </p>
          </>
        )}

        {/* Languages */}
        {cv.languages && cv.languages.length > 0 && (
          <>
            <SectionHeading>Languages</SectionHeading>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: "#1a1a1a", margin: 0 }}>
              {cv.languages.join(", ")}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
