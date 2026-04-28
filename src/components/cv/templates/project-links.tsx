import type { CSSProperties } from "react"
import type { CvProject } from "@/lib/supabase/database.types"

function normalizeHref(value: string): string {
  return value.startsWith("http") ? value : `https://${value}`
}

function isCodeHost(value: string): boolean {
  return /github\.com|gitlab\.com|bitbucket\.org/i.test(value)
}

export function getProjectLinks(project: CvProject): Array<{ label: string; href: string }> {
  const links: Array<{ label: string; href: string }> = []

  if (project.url) {
    links.push({
      label: isCodeHost(project.url) ? "Code" : "Live",
      href: normalizeHref(project.url),
    })
  }

  if (project.code_url && project.code_url !== project.url) {
    links.push({
      label: "Code",
      href: normalizeHref(project.code_url),
    })
  }

  return links
}

export function ProjectLinks({
  project,
  style,
}: {
  project: CvProject
  style?: CSSProperties
}) {
  const links = getProjectLinks(project)
  if (links.length === 0) return null

  return (
    <span style={{ display: "inline-flex", gap: 5, marginLeft: 6, ...style }}>
      {links.map((link) => (
        <a
          key={`${link.label}-${link.href}`}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          {link.label}
        </a>
      ))}
    </span>
  )
}
