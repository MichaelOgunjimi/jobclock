import { cn } from "@/lib/utils"

const STAGES = ["Saved", "Tailored", "Applied", "Interview"] as const

// Illustrative rows only; the card is labelled as example data.
const rows = [
  { company: "Northgate Health", role: "Product Designer", stage: 3, day: 9 },
  { company: "Lumen Bank", role: "Frontend Engineer", stage: 2, day: 4 },
  { company: "Fieldwork Studio", role: "Design Engineer", stage: 1, day: 1 },
  { company: "Harbour & Co", role: "Data Analyst", stage: 0, day: 0 },
] as const

/** A product-shaped specimen of the pipeline: ruled rows, stage ticks and a stamped status. */
export function ApplicationLedger({ className }: { className?: string }) {
  return (
    <figure
      aria-label="Example application ledger"
      className={cn("lp-ledger relative border border-foreground/15 bg-card shadow-[0_30px_80px_-30px_rgba(40,25,10,0.35)]", className)}
    >
      <figcaption className="flex items-center justify-between border-b border-foreground/15 px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>Applications · Ledger</span>
        <span>4 open</span>
      </figcaption>

      <ol>
        {rows.map((row) => (
          <li
            key={row.company}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 border-b border-dashed border-foreground/15 px-5 py-5 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate text-base font-medium tracking-[-0.02em]">{row.company}</p>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{row.role}</p>
            </div>

            <div className="relative text-right">
              {row.stage === 3 ? (
                <span className="inline-block border-2 border-accent px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                  Interview
                </span>
              ) : (
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {STAGES[row.stage]}
                </span>
              )}
            </div>

            <div className="col-span-2 flex items-center gap-3">
              <div className="flex flex-1 gap-1" role="img" aria-label={`Stage ${row.stage + 1} of ${STAGES.length}: ${STAGES[row.stage]}`}>
                {STAGES.map((stage, stageIndex) => (
                  <span
                    key={stage}
                    className={cn("h-1 flex-1", stageIndex <= row.stage ? (row.stage === 3 ? "bg-accent" : "bg-foreground") : "bg-foreground/12")}
                  />
                ))}
              </div>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {row.day === 0 ? "today" : `day ${row.day}`}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <p className="border-t border-foreground/15 px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
        Example data
      </p>
    </figure>
  )
}
