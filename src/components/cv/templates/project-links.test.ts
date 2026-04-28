import { describe, expect, it } from "vitest"
import { getProjectLinks } from "./project-links"

describe("getProjectLinks", () => {
  it("labels a non-repository project URL as live", () => {
    expect(getProjectLinks({ name: "Portfolio", description: "", url: "example.com" })).toEqual([
      { label: "Live", href: "https://example.com" },
    ])
  })

  it("labels repository URLs as code", () => {
    expect(getProjectLinks({ name: "Tool", description: "", url: "https://github.com/user/tool" })).toEqual([
      { label: "Code", href: "https://github.com/user/tool" },
    ])
  })

  it("returns live and code links when both are present", () => {
    expect(
      getProjectLinks({
        name: "App",
        description: "",
        url: "https://app.example.com",
        code_url: "https://github.com/user/app",
      }),
    ).toEqual([
      { label: "Live", href: "https://app.example.com" },
      { label: "Code", href: "https://github.com/user/app" },
    ])
  })
})
