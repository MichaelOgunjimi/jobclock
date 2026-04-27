export interface Job {
  id: string
  title: string
  company: string
  location: string | null
  description: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  postedAt: string | null
  url: string
  source: string
  isEasyApply: boolean | null
  applyDeadline?: string | null
  lastSeenAt?: string | null
  isRemote?: boolean | null
  remoteType?: string | null
}
