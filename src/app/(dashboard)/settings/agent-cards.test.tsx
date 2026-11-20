import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { createAgentToken, revokeAgentToken, revokeAgentConnection, setAgentDailyLimit } = vi.hoisted(() => ({
  createAgentToken: vi.fn(),
  revokeAgentToken: vi.fn(),
  revokeAgentConnection: vi.fn(),
  setAgentDailyLimit: vi.fn(),
}))
vi.mock("./actions", () => ({ createAgentToken, revokeAgentToken, revokeAgentConnection, setAgentDailyLimit }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { AgentAccessCard } from "./agent-access-card"
import { AgentLimitsCard } from "./agent-limits-card"
import { ConnectedAppsCard } from "./connected-apps-card"
import type { ApiTokenMetadata } from "@/lib/mcp/tokens"
import type { ConnectedApp } from "@/lib/oauth/tokens"

const MCP_URL = "https://jobclock.dev/api/mcp"
const DAY = 86_400_000
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString()

const token = (overrides: Partial<ApiTokenMetadata> = {}): ApiTokenMetadata => ({
  id: "t1",
  label: "Laptop",
  tokenPrefix: "jc_abcde",
  scopes: ["applications:read", "applications:write"],
  expiresAt: null,
  dailyCreateCap: 100,
  createdAt: iso(-10),
  lastUsedAt: null,
  revokedAt: null,
  ...overrides,
})

const app = (overrides: Partial<ConnectedApp> = {}): ConnectedApp => ({
  id: "g1",
  clientName: "Claude",
  redirectHost: "claude.ai",
  scopes: ["applications:read"],
  expiresAt: iso(20),
  dailyCreateCap: 100,
  createdAt: iso(-10),
  lastUsedAt: null,
  ...overrides,
})

beforeEach(() => vi.clearAllMocks())

const typeName = (value: string) => fireEvent.change(screen.getByLabelText("Token name"), { target: { value } })
const choose = async (combobox: string, option: string) => {
  fireEvent.click(screen.getByRole("combobox", { name: combobox }))
  const item = await screen.findByRole("option", { name: option })
  fireEvent.mouseMove(item)
  fireEvent.click(item)
}

describe("access tokens card", () => {
  it("shows each token's access, expiry with days left, and an Expired badge for a lapsed one", () => {
    render(
      <AgentAccessCard
        mcpUrl={MCP_URL}
        activity={{}}
        tokens={[
          token({ id: "a", label: "Full", expiresAt: null }),
          token({ id: "b", label: "Reader", scopes: ["applications:read"], expiresAt: iso(30) }),
          token({ id: "c", label: "Old", expiresAt: iso(-3) }),
        ]}
      />,
    )
    const rows = screen.getAllByRole("listitem").filter((li) => li.textContent?.includes("jc_abcde"))
    const [full, reader, old] = rows
    expect(within(full).getByText("Read and change")).toBeInTheDocument()
    expect(within(full).getByText("Never expires")).toBeInTheDocument()
    expect(within(reader).getByText("Read only")).toBeInTheDocument()
    expect(within(reader).getByText(/Expires .* \(in (29|30) days\)/)).toBeInTheDocument()
    expect(within(old).getByText("Expired")).toBeInTheDocument()
    expect(within(old).getByRole("button", { name: "Remove" })).toBeInTheDocument()
    expect(within(old).queryByText("Active")).toBeNull()
  })

  it("offers read only and 90 days by default, and sends the choice when creating", async () => {
    createAgentToken.mockResolvedValue({ success: true, token: "jc_realtokenvalue", metadata: token({ id: "new", label: "Mine", scopes: ["applications:read"] }) })
    render(<AgentAccessCard mcpUrl={MCP_URL} activity={{}} tokens={[]} />)
    expect(screen.getByRole("combobox", { name: "Access" })).toHaveTextContent("Read only")
    expect(screen.getByRole("combobox", { name: "Expires" })).toHaveTextContent("90 days")

    typeName("Mine")
    fireEvent.click(screen.getByRole("button", { name: "Create token" }))
    await waitFor(() => expect(createAgentToken).toHaveBeenCalledWith("Mine", "read", "90"))
  })

  it("lets you choose read + changes and any of the five lifetimes", async () => {
    render(<AgentAccessCard mcpUrl={MCP_URL} activity={{}} tokens={[]} />)
    await choose("Access", "Read + changes")
    fireEvent.click(screen.getByRole("combobox", { name: "Expires" }))
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["7 days", "30 days", "90 days", "1 year", "Never expires"])
    fireEvent.click(screen.getByRole("option", { name: "7 days" }))
    typeName("Short")
    fireEvent.click(screen.getByRole("button", { name: "Create token" }))
    await waitFor(() => expect(createAgentToken).toHaveBeenCalledWith("Short", "write", "7"))
  })

  it("the only placeholder is the token itself, and once created the command contains the real token and URL", async () => {
    createAgentToken.mockResolvedValue({ success: true, token: "jc_realtokenvalue", metadata: token({ id: "new" }) })
    render(<AgentAccessCard mcpUrl={MCP_URL} activity={{}} tokens={[]} />)
    const command = () => (screen.getByLabelText("Claude Code command") as HTMLInputElement).value
    expect(command()).toBe(`claude mcp add --transport http jobclock ${MCP_URL} --header "Authorization: Bearer jc_YOUR_TOKEN"`)
    expect(document.body.textContent).not.toMatch(/<host>|your-jobclock|<token>|<your/i)

    typeName("Mine")
    fireEvent.click(screen.getByRole("button", { name: "Create token" }))
    await waitFor(() => expect(command()).toBe(`claude mcp add --transport http jobclock ${MCP_URL} --header "Authorization: Bearer jc_realtokenvalue"`))
    expect(command()).not.toContain("YOUR_TOKEN")
    expect(screen.getByLabelText("New agent token")).toHaveValue("jc_realtokenvalue")
  })

  it("shows the recent activity of each token and says reads are not recorded", () => {
    render(
      <AgentAccessCard
        mcpUrl={MCP_URL}
        tokens={[token({ id: "a" }), token({ id: "b", label: "Quiet" })]}
        activity={{ a: [{ id: "e1", tool: "add_note", detail: null, applicationSlug: "acme-eng", applicationTitle: "Engineer", at: iso(-1) }] }}
      />,
    )
    expect(screen.getByText("Recent activity (1)")).toBeInTheDocument()
    expect(screen.getByText("add_note")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Engineer" })).toHaveAttribute("href", "/applications/acme-eng")
    expect(screen.getByText("Recent activity (0)")).toBeInTheDocument()
    expect(screen.getByText(/reading applications leaves no record/)).toBeInTheDocument()
  })

  it("saves the daily limit for a token with write access, and hides it for a read-only one", async () => {
    setAgentDailyLimit.mockResolvedValue({ success: true, dailyCreateCap: 0 })
    render(<AgentAccessCard mcpUrl={MCP_URL} activity={{}} tokens={[token({ id: "w" }), token({ id: "r", label: "Reader", scopes: ["applications:read"] })]} />)
    expect(screen.getAllByLabelText("New applications per day")).toHaveLength(1)
    fireEvent.change(screen.getByLabelText("New applications per day"), { target: { value: "0" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(setAgentDailyLimit).toHaveBeenCalledWith("token", "w", 0))
    expect(await screen.findByText(/No limit\. 0 means no limit\./)).toBeInTheDocument()
  })
})

describe("connected apps card", () => {
  it("shows access, when the connection ends, and the daily limit", () => {
    render(<ConnectedAppsCard mcpUrl={MCP_URL} activity={{}} apps={[app({ scopes: ["applications:read", "applications:write"] }), app({ id: "g2", clientName: "Forever", expiresAt: null })]} />)
    expect(screen.getByText("Read and change")).toBeInTheDocument()
    expect(screen.getByText(/Expires .* \(in (19|20) days\)/)).toBeInTheDocument()
    expect(screen.getByText("Stays connected until you revoke it")).toBeInTheDocument()
    expect(screen.getAllByLabelText("New applications per day")).toHaveLength(1) // only the one that can add jobs
    expect(screen.getByLabelText("MCP server URL")).toHaveValue(MCP_URL)
  })

  it("marks an app whose period has passed as Expired", () => {
    render(<ConnectedAppsCard mcpUrl={MCP_URL} activity={{}} apps={[app({ expiresAt: iso(-1) })]} />)
    expect(screen.getByText("Expired")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument()
  })
})

describe("limits card", () => {
  it("lists the limits that affect you with their reasons, and none of the server-only ones", () => {
    render(<AgentLimitsCard />)
    for (const name of ["Daily new applications", "Requests per minute", "Jobs per batch call", "Request size", "Stored text length", "Token expiry", "Connected app period"]) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    expect(screen.getByText(/120 per account/)).toBeInTheDocument()
    expect(screen.queryByText("Failed sign-ins per IP")).toBeNull()
    expect(document.body.textContent).not.toMatch(/<host>|your-jobclock|TODO/i)
  })
})
