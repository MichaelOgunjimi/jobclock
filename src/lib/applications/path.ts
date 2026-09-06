export function applicationPath(slug: string, childPath = ""): string {
  return `/applications/${slug}${childPath}`
}
