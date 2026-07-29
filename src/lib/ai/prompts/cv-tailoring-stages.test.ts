import { describe, expect, it } from "vitest"
import { STAGE_D_SYSTEM_PROMPT, STAGE_E_SYSTEM_PROMPT } from "./cv-tailoring-stages"

describe("CV tailoring prompts — skills provenance", () => {
  it("makes the planner select exact entries only from the original skills array", () => {
    expect(STAGE_D_SYSTEM_PROMPT).toMatch(/exclusively from the candidate_cv\.skills array/i)
    expect(STAGE_D_SYSTEM_PROMPT).toMatch(/jd.+never a source of new cv skills/i)
    expect(STAGE_D_SYSTEM_PROMPT).toMatch(/add_if_present_in_cv.+always return \[\]/i)
  })

  it("forbids the writer from copying new skills out of the JD", () => {
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/every output skill must be copied exactly from original_cv\.skills/i)
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/jd is used only to decide which existing skills/i)
    expect(STAGE_E_SYSTEM_PROMPT).toContain("AI-powered development tools")
    expect(STAGE_E_SYSTEM_PROMPT).toContain("collaborative development workflows")
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/exclude generic soft skills/i)
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/attention to detail.+teamwork.+problem-solving/i)
  })
})

describe("STAGE_E_SYSTEM_PROMPT — bullet quality", () => {
  it("requires each rewritten bullet to evidence at least 2 of the four axes", () => {
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/at least 2 of/i)
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/measurable result/i)
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/strategic contribution/i)
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/cross-functional/i)
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/tools|platforms/i)
  })

  it("frames 'strategic contribution' as a decision or choice, not just work done", () => {
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/strategic contribution.*\(.*decision|choice.*\)/i)
  })
})

describe("STAGE_E_SYSTEM_PROMPT — transferable framing for missing must-haves", () => {
  it("instructs the model to surface adjacent experience by the candidate's actual tool name", () => {
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/(adjacent|transferable).+(tool|experience)/i)
  })

  it("forbids using the JD's must-have phrase without the candidate's actual tool name attached", () => {
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/never use the jd's must-have phrase/i)
  })

  it("uses a concrete example showing the bridge framing (Docker / Kubernetes)", () => {
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/container orchestration with Docker/i)
  })
})

describe("STAGE_E_SYSTEM_PROMPT — summary shape guidance", () => {
  it("instructs summaries to open with role identity + years of experience, then capability, then commercial impact", () => {
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/role identity.+years of experience/i)
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/strongest capability/i)
    expect(STAGE_E_SYSTEM_PROMPT).toMatch(/commercial impact|specialisation|specialization/i)
  })
})
