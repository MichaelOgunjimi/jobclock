import type { GenerationJob, GenerationKind } from "./jobs"

// A handler runs the generation for one job and returns the result_ref
// (the id in the relevant existing result table).
export type GenerationHandler = (job: GenerationJob) => Promise<string>

const registry: Partial<Record<GenerationKind, GenerationHandler>> = {}

export function registerHandler(kind: GenerationKind, handler: GenerationHandler): void {
  registry[kind] = handler
}

export function getHandler(kind: GenerationKind): GenerationHandler {
  const handler = registry[kind]
  if (!handler) {
    throw new Error(`No generation handler registered for kind: ${kind}`)
  }
  return handler
}
