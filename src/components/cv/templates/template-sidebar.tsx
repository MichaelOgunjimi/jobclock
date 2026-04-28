import type { CvData, CvExperience, CvEducation, CvProject } from "@/lib/supabase/database.types"
import { ProjectLinks } from "@/components/cv/templates/project-links"

interface CvTemplateProps {
  cv: CvData
}

function SidebarSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "1.1px",
        textTransform: "uppercase",
        color: "#f5f5f5",
        borderBottom: "1px solid #444",
        paddingBottom: 3,
        marginTop: 14,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  )
}

function MainSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "1.1px",
        textTransform: "uppercase",
        borderBottom: "1.5px solid #333",
        paddingBottom: 3,
        marginBottom: 7,
        marginTop: 14,
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
        <span style={{ fontWeight: 700, fontSize: 12.5, color: "#1a1a1a" }}>{entry.title}</span>
        {dates && (
          <span style={{ fontSize: 11.3, color: "#555", whiteSpace: "nowrap", marginLeft: 8 }}>
            {dates}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.3, color: "#555", fontStyle: "italic", marginTop: 1 }}>
        {entry.company}
        {entry.location && ` — ${entry.location}`}
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
        <span style={{ fontWeight: 700, fontSize: 12.5, color: "#1a1a1a" }}>{entry.institution}</span>
        {entry.location && (
          <span style={{ fontSize: 11.3, color: "#555" }}>{entry.location}</span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 1 }}>
        <span style={{ fontSize: 11.3, color: "#555", fontStyle: "italic" }}>{degreeLabel}</span>
        {dates && (
          <span style={{ fontSize: 11.3, color: "#777", whiteSpace: "nowrap" }}>{dates}</span>
        )}
      </div>
      {entry.gpa && (
        <div style={{ fontSize: 11.3, color: "#555", marginTop: 2 }}>GPA: {entry.gpa}</div>
      )}
      {entry.honors && (
        <div style={{ fontSize: 11.3, color: "#555", marginTop: 2 }}>{entry.honors}</div>
      )}
      {entry.grade && !entry.gpa && (
        <div style={{ fontSize: 11.3, color: "#555", marginTop: 2 }}>{entry.grade}</div>
      )}
      {entry.relevant_modules && entry.relevant_modules.length > 0 && (
        <div style={{ fontSize: 11.3, color: "#555", marginTop: 3 }}>
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
        <span style={{ fontWeight: 700, fontSize: 12.5, color: "#1a1a1a" }}>
          {entry.name}
          <ProjectLinks project={entry} style={{ fontSize: 10, fontWeight: 700, color: "#2563eb" }} />
        </span>
        {dates && (
          <span style={{ fontSize: 11.3, color: "#555", whiteSpace: "nowrap", marginLeft: 8 }}>
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
        <div style={{ fontSize: 11.3, color: "#555", marginTop: 4 }}>
          Technologies: {entry.technologies.join(", ")}
        </div>
      )}
    </div>
  )
}

export function TemplateSidebar({ cv }: CvTemplateProps) {
  return (
    <div
      style={{
        fontFamily: "'Arial', sans-serif",
        background: "white",
        minHeight: "297mm",
        display: "flex",
        boxSizing: "border-box",
      }}
    >
      {/* Left sidebar */}
      <div
        style={{
          width: "30%",
          background: "#1a1a1a",
          color: "#f5f5f5",
          padding: "26px 18px",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        {/* Name */}
        {cv.name && (
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "white",
              marginBottom: 4,
              lineHeight: 1.2,
            }}
          >
            {cv.name}
          </div>
        )}
        {cv.headline && (
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 8 }}>
            {cv.headline}
          </div>
        )}

        {/* Contact details */}
        <div style={{ marginTop: 10 }}>
          {cv.email && (
            <div style={{ fontSize: 11, color: "#ccc", marginBottom: 2, wordBreak: "break-all" }}>
              {cv.email}
            </div>
          )}
          {cv.phone && (
            <div style={{ fontSize: 11, color: "#ccc", marginBottom: 2 }}>
              {cv.phone}
            </div>
          )}
          {cv.location && (
            <div style={{ fontSize: 11, color: "#ccc", marginBottom: 2 }}>
              {cv.location}
            </div>
          )}
          {cv.linkedin && (
            <div style={{ fontSize: 11, color: "#ccc", marginBottom: 2, wordBreak: "break-all" }}>
              <a
                href={cv.linkedin.startsWith("http") ? cv.linkedin : `https://${cv.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                {cv.linkedin}
              </a>
            </div>
          )}
          {cv.website && (
            <div style={{ fontSize: 11, color: "#ccc", marginBottom: 2, wordBreak: "break-all" }}>
              <a
                href={cv.website.startsWith("http") ? cv.website : `https://${cv.website}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                {cv.website}
              </a>
            </div>
          )}
        </div>

        {/* Skills */}
        {cv.skills && cv.skills.length > 0 && (
          <>
            <SidebarSectionHeading>Skills</SidebarSectionHeading>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {cv.skills.map((skill, i) => (
                <div
                  key={i}
                  style={{
                    background: "#333",
                    padding: "2px 8px",
                    fontSize: 11,
                    color: "#eee",
                    marginBottom: 3,
                  }}
                >
                  {skill}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Languages */}
        {cv.languages && cv.languages.length > 0 && (
          <>
            <SidebarSectionHeading>Languages</SidebarSectionHeading>
            {cv.languages.map((lang, i) => (
              <div key={i} style={{ fontSize: 11, color: "#ccc", marginBottom: 2 }}>
                {lang}
              </div>
            ))}
          </>
        )}

        {/* Certifications */}
        {cv.certifications && cv.certifications.length > 0 && (
          <>
            <SidebarSectionHeading>Certifications</SidebarSectionHeading>
            {cv.certifications.map((cert, i) => (
              <div key={i} style={{ fontSize: 11, color: "#ccc", marginBottom: 2 }}>
                {cert}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Right main content */}
      <div
        style={{
          width: "70%",
          padding: "26px 24px",
          boxSizing: "border-box",
        }}
      >
        {/* Summary */}
        {cv.summary && (
          <>
            <MainSectionHeading>Profile</MainSectionHeading>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: "#1a1a1a", margin: 0 }}>
              {cv.summary}
            </p>
          </>
        )}

        {/* Education */}
        {cv.education && cv.education.length > 0 && (
          <>
            <MainSectionHeading>Education</MainSectionHeading>
            {cv.education.map((edu, i) => (
              <EducationEntry key={i} entry={edu} />
            ))}
          </>
        )}

        {/* Experience */}
        {cv.experience && cv.experience.length > 0 && (
          <>
            <MainSectionHeading>Experience</MainSectionHeading>
            {cv.experience.map((exp, i) => (
              <ExperienceEntry key={i} entry={exp} />
            ))}
          </>
        )}

        {/* Projects */}
        {cv.projects && cv.projects.length > 0 && (
          <>
            <MainSectionHeading>Projects</MainSectionHeading>
            {cv.projects.map((proj, i) => (
              <ProjectEntry key={i} entry={proj} />
            ))}
          </>
        )}

        {/* Activities */}
        {cv.activities && cv.activities.length > 0 && (
          <>
            <MainSectionHeading>Activities</MainSectionHeading>
            {cv.activities.map((act, i) => (
              <ExperienceEntry key={i} entry={act} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
