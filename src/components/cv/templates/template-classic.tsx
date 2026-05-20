import type { CvData, CvExperience, CvEducation, CvProject } from "@/lib/supabase/database.types"
import { ProjectLinks } from "@/components/cv/templates/project-links"

interface CvTemplateProps {
  cv: CvData
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        borderBottom: "1.5px solid #1a1a1a",
        paddingBottom: 3,
        marginBottom: 8,
        marginTop: 15,
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
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 12.5 }}>{entry.company}</span>
        {entry.location && (
          <span style={{ fontSize: 11.5, color: "#444" }}>{entry.location}</span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 1 }}>
        <span style={{ fontStyle: "italic", fontSize: 11.5, color: "#333" }}>{entry.title}</span>
        {dates && (
          <span style={{ fontSize: 11.5, color: "#444", whiteSpace: "nowrap" }}>{dates}</span>
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
    </div>
  )
}

function EducationEntry({ entry }: { entry: CvEducation }) {
  const dates = [entry.start_date, entry.end_date].filter(Boolean).join(" – ")
  const degreeLabel = entry.field ? `${entry.degree} — ${entry.field}` : entry.degree
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 12.5 }}>{entry.institution}</span>
        {entry.location && (
          <span style={{ fontSize: 11.5, color: "#444" }}>{entry.location}</span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 1 }}>
        <span style={{ fontStyle: "italic", fontSize: 11.5, color: "#333" }}>{degreeLabel}</span>
        {dates && (
          <span style={{ fontSize: 11.5, color: "#444", whiteSpace: "nowrap" }}>{dates}</span>
        )}
      </div>
      <div style={{ paddingLeft: 12, marginTop: 3 }}>
        {entry.gpa && (
          <div style={{ fontSize: 11.5, color: "#444" }}>GPA: {entry.gpa}</div>
        )}
        {entry.honors && (
          <div style={{ fontSize: 11.5, color: "#444" }}>{entry.honors}</div>
        )}
        {entry.grade && !entry.gpa && (
          <div style={{ fontSize: 11.5, color: "#444" }}>{entry.grade}</div>
        )}
        {entry.relevant_modules && entry.relevant_modules.length > 0 && (
          <div style={{ fontSize: 11.5, color: "#444", marginTop: 2 }}>
            Relevant Coursework: {entry.relevant_modules.join(", ")}
          </div>
        )}
      </div>
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
          <span style={{ fontSize: 11.5, color: "#444", whiteSpace: "nowrap" }}>{dates}</span>
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
          Technologies: {entry.technologies.join(", ")}
        </div>
      )}
    </div>
  )
}

export function TemplateClassic({ cv }: CvTemplateProps) {
  const contactParts: string[] = []
  if (cv.email) contactParts.push(cv.email)
  if (cv.phone) contactParts.push(cv.phone)
  if (cv.location) contactParts.push(cv.location)

  return (
    <div
      style={{
        fontFamily: "Georgia, serif",
        background: "white",
        padding: "28px 38px",
        color: "#1a1a1a",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        {cv.name && (
          <div
            style={{
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: "1.4px",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {cv.name}
          </div>
        )}
        {cv.headline && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: "#555",
              letterSpacing: "0.5px",
              marginBottom: 4,
            }}
          >
            {cv.headline}
          </div>
        )}
        {contactParts.length > 0 && (
          <div style={{ fontSize: 11.5, color: "#444" }}>
            {contactParts.join(" | ")}
          </div>
        )}
        {(cv.linkedin || cv.website) && (
          <div style={{ fontSize: 11.5, color: "#444", marginTop: 2 }}>
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

      {/* Summary */}
      {cv.summary && (
        <>
          <SectionHeading>Summary</SectionHeading>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: "#1a1a1a", margin: 0 }}>
            {cv.summary}
          </p>
        </>
      )}

      {/* Skills */}
      {cv.skills && cv.skills.length > 0 && (
        <>
          <SectionHeading>Skills</SectionHeading>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: "#1a1a1a", margin: 0 }}>
            Technical Skills: {cv.skills.join(", ")}
          </p>
        </>
      )}

      {/* Experience */}
      {cv.experience && cv.experience.length > 0 && (
        <>
          <SectionHeading>Experience</SectionHeading>
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
          <p style={{ fontSize: 12, lineHeight: 1.55, color: "#1a1a1a", margin: 0 }}>
            Certifications: {cv.certifications.join(", ")}
          </p>
        </>
      )}

      {/* Languages */}
      {cv.languages && cv.languages.length > 0 && (
        <>
          <SectionHeading>Languages</SectionHeading>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: "#1a1a1a", margin: 0 }}>
            Languages: {cv.languages.join(", ")}
          </p>
        </>
      )}
    </div>
  )
}
