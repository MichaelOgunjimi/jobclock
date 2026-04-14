import type { CvData, CvExperience, CvEducation, CvProject } from "@/lib/supabase/database.types"

interface CvTemplateProps {
  cv: CvData
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color: "#333",
        borderBottom: "1px solid #ddd",
        paddingBottom: 2,
        marginTop: 14,
        marginBottom: 6,
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
  const headerLabel = [entry.company, entry.title].filter(Boolean).join(" — ")

  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>{headerLabel}</span>
        {dates && (
          <span style={{ fontSize: 11, color: "#777", whiteSpace: "nowrap" }}>{dates}</span>
        )}
      </div>
      {entry.location && (
        <div style={{ fontSize: 11, color: "#777", marginTop: 1, fontStyle: "italic" }}>
          {entry.location}
        </div>
      )}
      {entry.highlights && entry.highlights.length > 0 && (
        <ul style={{ margin: "4px 0 0", paddingLeft: 14 }}>
          {entry.highlights.map((highlight, index) => (
            <li
              key={index}
              style={{
                fontSize: 11.5,
                lineHeight: 1.5,
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
        <p style={{ margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "#1a1a1a" }}>
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
      <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>{entry.institution}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 11.5, fontStyle: "italic", color: "#1a1a1a" }}>{degreeLabel}</span>
        {dates && (
          <span style={{ fontSize: 11, color: "#777", whiteSpace: "nowrap" }}>{dates}</span>
        )}
      </div>
      {entry.location && (
        <div style={{ fontSize: 11, color: "#777", marginTop: 1 }}>{entry.location}</div>
      )}
      {entry.gpa && (
        <div style={{ fontSize: 11.5, color: "#1a1a1a", marginTop: 1 }}>GPA: {entry.gpa}</div>
      )}
      {entry.honors && (
        <div style={{ fontSize: 11.5, color: "#1a1a1a", marginTop: 1 }}>{entry.honors}</div>
      )}
      {entry.grade && !entry.gpa && (
        <div style={{ fontSize: 11.5, color: "#1a1a1a", marginTop: 1 }}>{entry.grade}</div>
      )}
      {entry.relevant_modules && entry.relevant_modules.length > 0 && (
        <div style={{ fontSize: 11.5, color: "#1a1a1a", marginTop: 1 }}>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        {entry.url ? (
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, fontWeight: 700, color: "inherit", textDecoration: "underline" }}
          >
            {entry.name}
          </a>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>{entry.name}</span>
        )}
        {dates && (
          <span style={{ fontSize: 11, color: "#777", whiteSpace: "nowrap" }}>{dates}</span>
        )}
      </div>
      {entry.highlights && entry.highlights.length > 0 && (
        <ul style={{ margin: "4px 0 0", paddingLeft: 14 }}>
          {entry.highlights.map((highlight, index) => (
            <li
              key={index}
              style={{
                fontSize: 11.5,
                lineHeight: 1.5,
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
        <p style={{ margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "#1a1a1a" }}>
          {entry.description}
        </p>
      )}
      {entry.technologies && entry.technologies.length > 0 && (
        <div style={{ fontSize: 11.5, color: "#1a1a1a", marginTop: 2 }}>
          Technologies: {entry.technologies.join(", ")}
        </div>
      )}
    </div>
  )
}

export function TemplateCompact({ cv }: CvTemplateProps) {
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
        padding: "24px 28px",
        color: "#1a1a1a",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: 10 }}>
        {cv.name && (
          <div style={{ fontSize: 19, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
            {cv.name}
          </div>
        )}
        {(contactParts.length > 0 || linkParts.length > 0) && (
          <div style={{ fontSize: 11, color: "#555", lineHeight: 1.4 }}>
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

      <div style={{ borderBottom: "1px solid #ddd", marginBottom: 10 }} />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ width: "65%" }}>
          {cv.experience && cv.experience.length > 0 && (
            <>
              <SectionHeading>Experience</SectionHeading>
              {cv.experience.map((experience, index) => (
                <ExperienceEntry key={index} entry={experience} />
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
        </div>

        <div style={{ width: "35%" }}>
          {cv.education && cv.education.length > 0 && (
            <>
              <SectionHeading>Education</SectionHeading>
              {cv.education.map((education, index) => (
                <EducationEntry key={index} entry={education} />
              ))}
            </>
          )}

          {cv.skills && cv.skills.length > 0 && (
            <>
              <SectionHeading>Skills</SectionHeading>
              <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "#1a1a1a" }}>
                {cv.skills.join(", ")}
              </p>
            </>
          )}

          {cv.certifications && cv.certifications.length > 0 && (
            <>
              <SectionHeading>Certifications</SectionHeading>
              <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "#1a1a1a" }}>
                {cv.certifications.join(", ")}
              </p>
            </>
          )}

          {cv.languages && cv.languages.length > 0 && (
            <>
              <SectionHeading>Languages</SectionHeading>
              <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "#1a1a1a" }}>
                {cv.languages.join(", ")}
              </p>
            </>
          )}

          {cv.summary && (
            <>
              <SectionHeading>Summary</SectionHeading>
              <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "#1a1a1a" }}>
                {cv.summary}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
