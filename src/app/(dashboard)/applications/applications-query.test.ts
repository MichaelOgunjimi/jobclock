import { describe, expect, it } from "vitest"
import { assertApplicationsQuerySucceeded } from "./applications-query"

describe("assertApplicationsQuerySucceeded", () => {
  it("throws instead of treating a failed applications query as an empty list", () => {
    const queryError = {
      code: "42703",
      message: "column applications.slug does not exist",
    }

    expect(() => assertApplicationsQuerySucceeded(queryError, "applications")).toThrow(
      "Unable to load applications."
    )
  })

  it("allows successful queries to render normally", () => {
    expect(() => assertApplicationsQuerySucceeded(null, "applications")).not.toThrow()
  })
})
