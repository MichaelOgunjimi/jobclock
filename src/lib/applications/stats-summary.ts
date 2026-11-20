/** Statuses that mean an employer replied (as opposed to still waiting or no answer). */
const REPLIED = ["screening", "interview", "offer", "rejected"]

/** Totals behind the response rate: applications tracked, sent (not just saved), and replied to. Shared by the Telegram and email digests. */
export function summarizeStats(byStatus: Record<string, number>) {
  const n = (status: string) => byStatus[status] ?? 0
  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0)
  return { total, submitted: total - n("saved"), replied: REPLIED.reduce((sum, status) => sum + n(status), 0) }
}
