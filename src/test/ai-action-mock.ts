// Stand-in for "@/lib/ai/action" in handler tests: resolves config from the (mocked) "@/lib/ai" module and
// delegates to its generateText / generateTextWithWebSearch mocks. runAiAction itself is covered in lib/ai/action.test.ts.
type Generate = (system: string, user: string, maxTokens?: number, options?: unknown) => Promise<string>

export async function aiActionMock() {
  const ai = (await import("@/lib/ai")) as unknown as {
    resolveAiConfig: (preferences: unknown) => { settings: unknown; apiKey: string }
    generateText: (...args: unknown[]) => Promise<string>
    generateTextWithWebSearch?: (...args: unknown[]) => Promise<string>
  }
  return {
    runAiAction: (
      request: { preferences: unknown },
      operation: (client: { generate: Generate; generateWithWebSearch: Generate }) => unknown,
    ) => {
      const { settings, apiKey } = ai.resolveAiConfig(request.preferences)
      return operation({
        generate: (system, user, maxTokens, options) => ai.generateText(settings, apiKey, system, user, maxTokens, options),
        generateWithWebSearch: (system, user, maxTokens, options) =>
          ai.generateTextWithWebSearch!(settings, apiKey, system, user, maxTokens, options),
      })
    },
  }
}
