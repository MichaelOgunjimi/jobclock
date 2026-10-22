import type { Instrumentation } from "next"

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
