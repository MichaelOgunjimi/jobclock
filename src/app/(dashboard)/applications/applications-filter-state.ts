import type { ApplicationStatus } from "@/lib/supabase/database.types"

export const APPLICATIONS_FILTER_STATE_COOKIE = "applications-filter-state"

const DEFAULT_SORT = "saved_desc"
const APPLICATION_LIST_PARAMS = new Set(["page", "status", "sort", "q"])
const VALID_STATUSES = new Set<ApplicationStatus>([
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
  "ghosted",
])
const VALID_SORTS = new Set([DEFAULT_SORT, "saved_asc", "applied_desc", "company_asc"])

type SearchParamValue = string | string[] | undefined

interface ApplicationsFilterState {
  status?: string
  sort?: string
  q?: string
}

export function hasApplicationsListParams(
  searchParams: Record<string, SearchParamValue> | undefined
) {
  if (!searchParams) return false

  return Object.entries(searchParams).some(([key, value]) => {
    if (!APPLICATION_LIST_PARAMS.has(key)) return false
    return firstSearchParamValue(value) !== undefined
  })
}

export function serializeApplicationsFilterState(state: ApplicationsFilterState) {
  const params = new URLSearchParams()
  const status = state.status ?? "all"
  const sort = state.sort ?? DEFAULT_SORT
  const q = (state.q ?? "").trim().slice(0, 100)

  if (status !== "all" && VALID_STATUSES.has(status as ApplicationStatus)) {
    params.set("status", status)
  }
  if (sort !== DEFAULT_SORT && VALID_SORTS.has(sort)) {
    params.set("sort", sort)
  }
  if (q) {
    params.set("q", q)
  }

  const serialized = params.toString()
  return serialized || null
}

export function buildApplicationsFilterHref(serializedFilterState: string | null | undefined) {
  return serializedFilterState ? `/applications?${serializedFilterState}` : "/applications"
}

export function getPersistedApplicationsFilterHref(cookieValue: string | undefined) {
  if (!cookieValue) return null

  let params: URLSearchParams
  try {
    params = new URLSearchParams(decodeURIComponent(cookieValue))
  } catch {
    return null
  }
  const status = params.get("status")
  const sort = params.get("sort")
  const q = params.get("q")

  if (status && !VALID_STATUSES.has(status as ApplicationStatus)) return null
  if (sort && !VALID_SORTS.has(sort)) return null

  const serialized = serializeApplicationsFilterState({
    status: status ?? "all",
    sort: sort ?? DEFAULT_SORT,
    q: q ?? "",
  })

  return serialized ? buildApplicationsFilterHref(serialized) : null
}

function firstSearchParamValue(value: SearchParamValue) {
  if (Array.isArray(value)) return value[0]
  return value
}
