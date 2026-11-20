import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LIMITS } from "@/lib/mcp/limits"

/** Built from the same list as docs/mcp-agent-access.md, so what Settings says and what the server enforces cannot drift apart. */
export function AgentLimitsCard() {
  const limits = LIMITS.filter((limit) => limit.owner)
  return (
    <Card>
      <CardHeader className="border-b pb-6">
        <p className="section-label">AI Agent</p>
        <CardTitle>Limits</CardTitle>
        <CardDescription>
          Every limit that applies to your agents, and why it exists. When an agent hits one, its error says which, why and how to change it.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <dl className="divide-y border">
          {limits.map((limit) => (
            <div key={limit.name} className="space-y-1 p-4">
              <dt className="text-sm font-medium text-foreground">{limit.name}</dt>
              <dd className="text-sm text-foreground">{limit.value}</dd>
              <dd className="text-xs text-muted-foreground">{limit.reason}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
