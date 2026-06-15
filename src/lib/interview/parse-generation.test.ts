import { describe, expect, it } from "vitest"
import { parseDiscoveryDraft } from "./parse-generation"

describe("parseDiscoveryDraft", () => {
  it("parses a real story draft", () => {
    expect(
      parseDiscoveryDraft(
        JSON.stringify({
          outcome: "story_found",
          story: {
            title: "Supported a teammate through a deadline",
            situation: "A teammate was behind before a group deadline.",
            task: "I needed to help while completing my own work.",
            action: "I split the remaining tasks and checked in with them.",
            result: "We submitted the work on time.",
            tags: ["teamwork"],
          },
        }),
      ),
    ).toEqual({
      outcome: "story_found",
      story: expect.objectContaining({
        title: "Supported a teammate through a deadline",
        tags: ["teamwork"],
      }),
    })
  })

  it("rejects incomplete AI output", () => {
    expect(() =>
      parseDiscoveryDraft('{"outcome":"story_found"}'),
    ).toThrow("AI returned an invalid discovery draft")
  })

  it("accepts honest no-example guidance", () => {
    expect(
      parseDiscoveryDraft(
        JSON.stringify({
          outcome: "no_example",
          honestAnswer: "I have not handled that exact situation yet.",
          hypotheticalApproach: "I would first clarify the disagreement.",
        }),
      ),
    ).toMatchObject({ outcome: "no_example" })
  })
})
