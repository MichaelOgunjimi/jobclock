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
const APPLICATION_MANAGE = ["archive_application", "restore_application", "set_applied_at", "set_source", "set_tags"]
const DELETE = ["delete_application"]
const AI_GENERATE = ["generate_company_research", "generate_cover_letter", "generate_interview_prep", "get_generation_status", "review_cv", "tailor_cv"]
const NEW_TOOLS = [...DELETE, ...AI_GENERATE]
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
    expect(seen).toEqual([...APPLICATION_READ, ...APPLICATION_WRITE, ...APPLICATION_MANAGE].sort())
    expect(seen.filter((name) => PRIVATE_TOOLS.includes(name))).toEqual([])
    expect(seen).toHaveLength(29)
    expect(seen.filter((name) => NEW_TOOLS.includes(name))).toEqual([])
  })

  it("the default (a full-access jc_ token from before) is still exactly the 29 application tools and none of the delete or AI ones", async () => {
    const names = await (await connect()).names()
    expect(names).toHaveLength(29)
    expect(names.filter((name) => NEW_TOOLS.includes(name))).toEqual([])
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

  it("every scope together is every tool", async () => {
    const names = await (await connect([...SUPPORTED_SCOPES])).names()
    expect(names).toEqual([...APPLICATION_READ, ...APPLICATION_WRITE, ...APPLICATION_MANAGE, ...PRIVATE_TOOLS, ...NEW_TOOLS].sort())
  })

  it("applications:delete (with the always-present read) adds exactly delete_application", async () => {
    expect(await (await connect(["applications:read", "applications:delete"])).names()).toEqual([...APPLICATION_READ, ...DELETE].sort())
  })

  it("ai:generate (with read) adds exactly the generation tools and get_generation_status", async () => {
    expect(await (await connect(["applications:read", "ai:generate"])).names()).toEqual([...APPLICATION_READ, ...AI_GENERATE].sort())
  })

  it("ai:generate or applications:delete alone register only their own tools, never write or private ones", async () => {
    expect(await (await connect(["applications:delete"])).names()).toEqual(DELETE)
    expect(await (await connect(["ai:generate"])).names()).toEqual([...AI_GENERATE].sort())
  })

  it("write alone does not bring delete or generation, and the manage tools need write", async () => {
    const names = await (await connect(["applications:read", "applications:write"])).names()
    for (const name of [...APPLICATION_MANAGE]) expect(names).toContain(name)
    expect(names.filter((name) => NEW_TOOLS.includes(name))).toEqual([])
    const readOnly = await (await connect(["applications:read"])).names()
    expect(readOnly.filter((name) => [...APPLICATION_MANAGE, ...NEW_TOOLS].includes(name))).toEqual([])
  })

  it("profile-only connections see none of the new tools", async () => {
    for (const scopes of [["profile:read"], ["interview:read"], ["profile:write"], ["profile:read", "interview:read", "profile:write"]]) {
      const names = await (await connect(scopes)).names()
      expect(names.filter((name) => [...APPLICATION_MANAGE, ...NEW_TOOLS].includes(name)), scopes.join()).toEqual([])
    }
  })

  it("a connection without the scope cannot call the tool: nothing is queried", async () => {
    const { client } = await connect(["applications:read", "applications:write"])
    for (const [name, args] of [
      ["delete_application", { application_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", confirm_title: "x" }],
      ["generate_company_research", { application_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
      ["review_cv", { cv_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
      ["get_generation_status", { job_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
    ] as const) {
      const result = await client.callTool({ name, arguments: args }).catch(() => ({ isError: true }))
      expect(result.isError, name).toBe(true)
    }
    expect(recorded).toHaveLength(0)
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
    expect((await connect([...SUPPORTED_SCOPES])).instructions().length).toBeLessThan(1800)
  })

  it("mention credits and permanent deletion only when those scopes are held", async () => {
    const plain = (await connect(["applications:read", "applications:write"])).instructions()
    expect(plain).not.toMatch(/credits|permanently delete/)
    expect(plain).toMatch(/cannot delete/)
    expect(plain).toMatch(/cannot start AI generation/)
    const strong = (await connect(["applications:read", "applications:write", "applications:delete", "ai:generate"])).instructions()
    expect(strong).toMatch(/permanently delete/)
    expect(strong).toMatch(/deletion cannot be undone/)
    expect(strong).toMatch(/credits/)
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
