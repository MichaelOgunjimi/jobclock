import type { CvData, CvExperience, CvEducation, CvProject } from "@/lib/supabase/database.types"
import { ProjectLinks } from "@/components/cv/templates/project-links"

interface CvTemplateProps {
  cv: CvData
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <>
      <hr
        style={{
          border: 0,
          borderTop: "0.5px solid #e0e0e0",
          margin: "18px 0 6px",
        }}
      />
      <div
        style={{
          fontSize: 9.5,
          textTransform: "uppercase",
          letterSpacing: "2px",
          color: "#999",
          marginBottom: 6,
        }}
      >
        {children}
      </div>
    </>
  )
}

function dateRange(start?: string, end?: string): string {
  if (!start && !end) return ""
  return [start, end].filter(Boolean).join(" – ")
}

function ExperienceEntry({ entry }: { entry: CvExperience }) {
  const dates = dateRange(entry.start_date, entry.end_date)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#333" }}>{entry.company}</span>
        {dates && (
          <span style={{ fontSize: 12, color: "#999", whiteSpace: "nowrap", marginLeft: 8 }}>
            {dates}
          </span>
        )}
      </div>
      <div style={{ fontStyle: "italic", fontSize: 12.5, color: "#555", marginTop: 1 }}>
        {entry.title}
        {entry.location && ` · ${entry.location}`}
      </div>
      {entry.highlights && entry.highlights.length > 0 && (
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {entry.highlights.map((highlight, index) => (
            <li
              key={index}
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: "#333",
                marginBottom: 2,
              }}
            >
              {highlight}
            </li>
          ))}
        </ul>
      )}
      {(!entry.highlights || entry.highlights.length === 0) && entry.description && (
        <p style={{ fontSize: 12, lineHeight: 1.5, color: "#333", margin: "6px 0 0" }}>
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
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#333" }}>{entry.institution}</span>
        {dates && (
          <span style={{ fontSize: 12, color: "#999", whiteSpace: "nowrap", marginLeft: 8 }}>
            {dates}
          </span>
        )}
      </div>
      <div style={{ fontStyle: "italic", fontSize: 12.5, color: "#555", marginTop: 1 }}>
        {degreeLabel}
        {entry.location && ` · ${entry.location}`}
      </div>
      {entry.gpa && (
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#333", marginTop: 3 }}>GPA: {entry.gpa}</div>
      )}
      {entry.honors && (
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#333", marginTop: 2 }}>{entry.honors}</div>
      )}
      {entry.grade && !entry.gpa && (
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#333", marginTop: 2 }}>{entry.grade}</div>
      )}
      {entry.relevant_modules && entry.relevant_modules.length > 0 && (
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#333", marginTop: 2 }}>
          Relevant Modules: {entry.relevant_modules.join(", ")}
        </div>
      )}
    </div>
  )
}

function ProjectEntry({ entry }: { entry: CvProject }) {
  const dates = dateRange(entry.start_date, entry.end_date)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#333" }}>
          {entry.name}
          <ProjectLinks project={entry} style={{ fontSize: 9.5, fontWeight: 700, color: "#2563eb" }} />
        </span>
        {dates && (
          <span style={{ fontSize: 12, color: "#999", whiteSpace: "nowrap", marginLeft: 8 }}>
            {dates}
          </span>
        )}
      </div>
      {entry.highlights && entry.highlights.length > 0 && (
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {entry.highlights.map((highlight, index) => (
            <li
              key={index}
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: "#333",
                marginBottom: 2,
              }}
            >
              {highlight}
            </li>
          ))}
        </ul>
      )}
      {(!entry.highlights || entry.highlights.length === 0) && entry.description && (
        <p style={{ fontSize: 12, lineHeight: 1.5, color: "#333", margin: "6px 0 0" }}>
          {entry.description}
        </p>
      )}
      {entry.technologies && entry.technologies.length > 0 && (
        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "#777", marginTop: 3 }}>
          {entry.technologies.join(", ")}
        </div>
      )}
    </div>
  )
}

export function TemplateMinimal({ cv }: CvTemplateProps) {
  const contactParts: string[] = []
  if (cv.email) contactParts.push(cv.email)
  if (cv.phone) contactParts.push(cv.phone)
  if (cv.location) contactParts.push(cv.location)
  const linkParts = [cv.linkedin, cv.website].filter(Boolean)

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "white",
        padding: "34px 42px",
        color: "#333",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        {cv.name && (
          <div
            style={{
              fontSize: 19,
              fontWeight: 300,
              letterSpacing: "2.2px",
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
              fontSize: 12.5,
              color: "#777",
              letterSpacing: "0.5px",
              marginBottom: 4,
            }}
          >
            {cv.headline}
          </div>
        )}
        {(contactParts.length > 0 || linkParts.length > 0) && (
          <div style={{ fontSize: 11.5, color: "#777" }}>
            {contactParts.join(" · ")}
            {contactParts.length > 0 && linkParts.length > 0 && " · "}
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
                {i < arr.length - 1 && " · "}
              </span>
            ))}
          </div>
        )}
      </div>

      {cv.summary && (
        <>
          <SectionHeading>Summary</SectionHeading>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: "#333", margin: 0 }}>{cv.summary}</p>
        </>
      )}

      {cv.education && cv.education.length > 0 && (
        <>
          <SectionHeading>Education</SectionHeading>
          {cv.education.map((edu, index) => (
            <EducationEntry key={index} entry={edu} />
          ))}
        </>
      )}

      {cv.experience && cv.experience.length > 0 && (
        <>
          <SectionHeading>Experience</SectionHeading>
          {cv.experience.map((exp, index) => (
            <ExperienceEntry key={index} entry={exp} />
          ))}
        </>
      )}

      {cv.projects && cv.projects.length > 0 && (
        <>
          <SectionHeading>Projects</SectionHeading>
          {cv.projects.map((project, index) => (
            <ProjectEntry key={index} entry={project} />
          ))}
        </>
      )}

      {cv.activities && cv.activities.length > 0 && (
        <>
          <SectionHeading>Activities</SectionHeading>
          {cv.activities.map((activity, index) => (
            <ExperienceEntry key={index} entry={activity} />
          ))}
        </>
      )}

      {cv.skills && cv.skills.length > 0 && (
        <>
          <SectionHeading>Skills</SectionHeading>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: "#333", margin: 0 }}>
            {cv.skills.join(", ")}
          </p>
        </>
      )}

      {cv.certifications && cv.certifications.length > 0 && (
        <>
          <SectionHeading>Certifications</SectionHeading>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: "#333", margin: 0 }}>
            {cv.certifications.join(", ")}
          </p>
        </>
      )}

      {cv.languages && cv.languages.length > 0 && (
        <>
          <SectionHeading>Languages</SectionHeading>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: "#333", margin: 0 }}>
            {cv.languages.join(", ")}
          </p>
        </>
      )}
    </div>
  )
}
