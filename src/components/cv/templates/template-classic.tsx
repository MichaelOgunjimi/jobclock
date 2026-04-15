import type { CvData, CvExperience, CvEducation, CvProject } from "@/lib/supabase/database.types"

interface CvTemplateProps {
  cv: CvData
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "1.8px",
        textTransform: "uppercase",
        borderBottom: "1.5px solid #1a1a1a",
        paddingBottom: 4,
        marginBottom: 12,
        marginTop: 20,
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
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{entry.company}</span>
        {entry.location && (
          <span style={{ fontSize: 13, color: "#444" }}>{entry.location}</span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 1 }}>
        <span style={{ fontStyle: "italic", fontSize: 13, color: "#333" }}>{entry.title}</span>
        {dates && (
          <span style={{ fontSize: 13, color: "#444", whiteSpace: "nowrap" }}>{dates}</span>
        )}
      </div>
      {entry.highlights && entry.highlights.length > 0 && (
        <ul style={{ margin: "5px 0 0", paddingLeft: 18 }}>
          {entry.highlights.map((h, i) => (
            <li key={i} style={{ fontSize: 13, lineHeight: 1.65, color: "#1a1a1a", marginBottom: 2 }}>
              {h}
            </li>
          ))}
        </ul>
      )}
      {(!entry.highlights || entry.highlights.length === 0) && entry.description && (
        <p style={{ fontSize: 13, lineHeight: 1.65, color: "#1a1a1a", margin: "5px 0 0" }}>
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
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{entry.institution}</span>
        {entry.location && (
          <span style={{ fontSize: 13, color: "#444" }}>{entry.location}</span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 1 }}>
        <span style={{ fontStyle: "italic", fontSize: 13, color: "#333" }}>{degreeLabel}</span>
        {dates && (
          <span style={{ fontSize: 13, color: "#444", whiteSpace: "nowrap" }}>{dates}</span>
        )}
      </div>
      <div style={{ paddingLeft: 12, marginTop: 3 }}>
        {entry.gpa && (
          <div style={{ fontSize: 13, color: "#444" }}>GPA: {entry.gpa}</div>
        )}
        {entry.honors && (
          <div style={{ fontSize: 13, color: "#444" }}>{entry.honors}</div>
        )}
        {entry.grade && !entry.gpa && (
          <div style={{ fontSize: 13, color: "#444" }}>{entry.grade}</div>
        )}
        {entry.relevant_modules && entry.relevant_modules.length > 0 && (
          <div style={{ fontSize: 13, color: "#444", marginTop: 2 }}>
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
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        {entry.url ? (
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontWeight: 700, fontSize: 14, color: "inherit", textDecoration: "underline" }}
          >
            {entry.name}
          </a>
        ) : (
          <span style={{ fontWeight: 700, fontSize: 14 }}>{entry.name}</span>
        )}
        {dates && (
          <span style={{ fontSize: 13, color: "#444", whiteSpace: "nowrap" }}>{dates}</span>
        )}
      </div>
      {entry.highlights && entry.highlights.length > 0 && (
        <ul style={{ margin: "5px 0 0", paddingLeft: 18 }}>
          {entry.highlights.map((h, i) => (
            <li key={i} style={{ fontSize: 13, lineHeight: 1.65, color: "#1a1a1a", marginBottom: 2 }}>
              {h}
            </li>
          ))}
        </ul>
      )}
      {(!entry.highlights || entry.highlights.length === 0) && entry.description && (
        <p style={{ fontSize: 13, lineHeight: 1.65, color: "#1a1a1a", margin: "5px 0 0" }}>
          {entry.description}
        </p>
      )}
      {entry.technologies && entry.technologies.length > 0 && (
        <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
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
        padding: "32px 44px",
        color: "#1a1a1a",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        {cv.name && (
          <div
            style={{
              fontSize: 23,
              fontWeight: 700,
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {cv.name}
          </div>
        )}
        {contactParts.length > 0 && (
          <div style={{ fontSize: 13, color: "#444" }}>
            {contactParts.join(" | ")}
          </div>
        )}
        {(cv.linkedin || cv.website) && (
          <div style={{ fontSize: 13, color: "#444", marginTop: 2 }}>
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
          <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "#1a1a1a", margin: 0 }}>
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
          <SectionHeading>Skills</SectionHeading>
          <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "#1a1a1a", margin: 0 }}>
            Technical Skills: {cv.skills.join(", ")}
          </p>
        </>
      )}

      {/* Certifications */}
      {cv.certifications && cv.certifications.length > 0 && (
        <>
          <SectionHeading>Certifications</SectionHeading>
          <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "#1a1a1a", margin: 0 }}>
            Certifications: {cv.certifications.join(", ")}
          </p>
        </>
      )}

      {/* Languages */}
      {cv.languages && cv.languages.length > 0 && (
        <>
          <SectionHeading>Languages</SectionHeading>
          <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "#1a1a1a", margin: 0 }}>
            Languages: {cv.languages.join(", ")}
          </p>
        </>
      )}
    </div>
  )
}
