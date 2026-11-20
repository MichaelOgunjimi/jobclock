import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Which token or connected app is making the current MCP request. Set once by the endpoint after authentication, so the
 * audit trail can record who made each change and the daily limit can be counted per connection, without threading the
 * connection through every tool.
 */
export interface McpConnection {
  kind: "token" | "oauth"
  id: string
  /** New applications this connection may add in 24 hours; 0 = unlimited. */
  dailyCreateCap: number
}

const storage = new AsyncLocalStorage<McpConnection>()

export const runAsConnection = <T>(connection: McpConnection, fn: () => T): T => storage.run(connection, fn)
export const currentConnection = () => storage.getStore()
