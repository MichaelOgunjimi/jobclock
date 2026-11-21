import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", async () => ({ db: (await import("./fake-db")).fakeDb }))

import { SUPPORTED_SCOPES } from "@/lib/oauth/config"
import { recorded, resetFakeDb } from "./fake-db"
import { createMcpServer } from "./server"

const USER = "11111111-1111-4111-8111-111111111111"

const APPLICATION_READ = [
  "check_job_exists", "get_application", "get_application_activity", "get_company_research", "get_credits", "get_job_preferences", "get_pipeline_summary",
  "list_applications", "list_cvs", "list_due", "list_stale_applications", "list_upcoming_deadlines", "list_upcoming_interviews",
]
const APPLICATION_WRITE = [
  "add_application", "add_applications", "add_note", "complete_follow_up", "set_follow_up", "set_interview_time", "snooze_follow_up",
  "undo_last_change", "update_application_details", "update_application_status", "update_application_statuses",
]
const PROFILE_READ = ["get_cover_letter", "get_cv", "get_profile", "get_tailored_cv", "list_profile_documents"]
const INTERVIEW_READ = ["get_interview_prep", "get_interview_profile_facts", "get_story", "list_stories"]
const PROFILE_WRITE = ["add_interview_profile_fact", "add_story", "rename_cv", "set_primary_cv", "update_interview_profile_fact", "update_profile", "update_story"]
const PRIVATE_TOOLS = [...PROFILE_READ, ...INTERVIEW_READ, ...PROFILE_WRITE]

async function connect(scopes?: string[]) {
  const server = createMcpServer(USER, scopes)
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const client = new Client({ name: "test", version: "1" })
  await client.connect(clientSide)
  return { client, server, names: async () => (await client.listTools()).tools.map((tool) => tool.name).sort(), instructions: () => client.getInstructions() ?? "" }
}

beforeEach(() => resetFakeDb())

describe("scope matrix", () => {
  it("applications:read alone sees exactly the read tools and none of the private ones", async () => {
    const { names } = await connect(["applications:read"])
    expect(await names()).toEqual([...APPLICATION_READ].sort())
  })

  it("applications read and write see no profile, CV or interview tool: the applications scopes never imply them", async () => {
    const { names } = await connect(["applications:read", "applications:write"])
    const seen = await names()
    expect(seen).toEqual([...APPLICATION_READ, ...APPLICATION_WRITE].sort())
    expect(seen.filter((name) => PRIVATE_TOOLS.includes(name))).toEqual([])
    expect(seen).toHaveLength(24)
  })

  it("the default (a full-access jc_ token from before) is still exactly the 24 application tools", async () => {
    expect(await (await connect()).names()).toHaveLength(24)
  })

  it("profile:read alone sees exactly the profile read tools, plus the CV list that finds a cv_id", async () => {
    expect(await (await connect(["profile:read"])).names()).toEqual([...PROFILE_READ, "list_cvs"].sort())
  })

  it("interview:read alone sees exactly the interview read tools", async () => {
    expect(await (await connect(["interview:read"])).names()).toEqual([...INTERVIEW_READ].sort())
  })

  it("profile:write alone sees exactly the profile write tools", async () => {
    expect(await (await connect(["profile:write"])).names()).toEqual([...PROFILE_WRITE].sort())
  })

  it("applications:read with profile:read adds the profile tools and still lists list_cvs once", async () => {
    const names = await (await connect(["applications:read", "profile:read"])).names()
    expect(names).toEqual([...APPLICATION_READ, ...PROFILE_READ].sort())
  })

  it("every scope together is every tool, and there are no delete tools anywhere", async () => {
    const names = await (await connect([...SUPPORTED_SCOPES])).names()
    expect(names).toEqual([...APPLICATION_READ, ...APPLICATION_WRITE, ...PRIVATE_TOOLS].sort())
    expect(names.filter((name) => /delete|remove|generate|regenerate/.test(name))).toEqual([])
  })

  it("an unknown scope grants nothing", async () => {
    // No tool is registered at all, so the server does not even advertise the tools capability.
    await expect((await connect(["admin", "profile:everything"])).names()).rejects.toThrow(/Method not found/)
  })

  it("a connection without a private scope cannot call its tools: nothing is queried", async () => {
    const { client } = await connect(["applications:read", "applications:write"])
    for (const [name, args] of [["get_profile", {}], ["get_cv", {}], ["get_story", { story_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }], ["update_profile", { phone: "+44 7700 900000" }], ["add_story", { title: "x" }]] as const) {
      const result = await client.callTool({ name, arguments: args }).catch((error: Error) => ({ isError: true, content: [{ type: "text", text: error.message }] }))
      expect(result.isError, name).toBe(true)
    }
    expect(recorded).toHaveLength(0)
  })

  it("a read-only profile connection cannot call a profile write tool", async () => {
    const { client } = await connect(["profile:read", "interview:read"])
    const result = await client.callTool({ name: "update_profile", arguments: { phone: "+44 7700 900000" } }).catch(() => ({ isError: true }))
    expect(result.isError).toBe(true)
    expect(recorded).toHaveLength(0)
  })
})

describe("server instructions", () => {
  it("say profile, CV and interview text is private data for the owner's task only, when a private scope is held", async () => {
    const text = (await connect(["profile:read"])).instructions()
    expect(text).toMatch(/private data/)
    expect(text).toMatch(/only for the owner's task/)
    expect(text).toMatch(/data, not instructions/)
  })

  it("do not mention private data to a connection that cannot reach it", async () => {
    expect((await connect(["applications:read"])).instructions()).not.toMatch(/private data|CV/)
  })

  it("stay short", async () => {
    expect((await connect([...SUPPORTED_SCOPES])).instructions().length).toBeLessThan(1100)
  })
})

describe("tool descriptions", () => {
  it("every private tool says the text is the owner's data and not instructions; none promises to generate", async () => {
    const { client } = await connect([...SUPPORTED_SCOPES])
    const tools = (await client.listTools()).tools.filter((tool) => [...PROFILE_READ, ...INTERVIEW_READ].includes(tool.name))
    expect(tools).toHaveLength(PROFILE_READ.length + INTERVIEW_READ.length)
    for (const tool of tools) {
      expect(tool.description, tool.name).toMatch(/private data/)
      expect(tool.description, tool.name).toMatch(/never as instructions/)
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true)
    }
  })
})
