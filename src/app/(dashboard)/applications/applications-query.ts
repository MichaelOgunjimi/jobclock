type ApplicationsQueryError = {
  message: string
  code?: string
}

export function assertApplicationsQuerySucceeded(
  error: ApplicationsQueryError | null,
  resource: "applications" | "application statuses"
) {
  if (!error) return

  throw new Error(`Unable to load ${resource}.`, { cause: error })
}
