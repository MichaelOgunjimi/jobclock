import type { Instrumentation } from "next"
import { runtimeEnvProblem } from "./lib/env-guard"

export function register() {
  // The build only collects pages; the check is about the server that will actually run.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return

  const problem = runtimeEnvProblem(process.env)
  if (problem?.level === "error") throw new Error(problem.message)
  if (problem) console.warn(`⚠️  ${problem.message}`)
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const requestError = error as Error & { digest?: string }

  console.error("[request-error]", JSON.stringify({
    message: requestError.message,
    digest: requestError.digest,
    method: request.method,
    path: request.path,
    route: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  }))
}
