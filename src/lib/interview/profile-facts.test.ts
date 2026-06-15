import { describe, expect, it } from "vitest"
import { extractProfileFactDrafts } from "./profile-facts"

describe("extractProfileFactDrafts", () => {
  it("extracts deterministic education, experience, and project drafts", () => {
    const drafts = extractProfileFactDrafts({
      education: [
        {
          degree: "MSc AI",
          institution: "University of Manchester",
          start_date: "2024",
          end_date: "2025",
        },
      ],
      experience: [
        {
          title: "Assistant",
          company: "Example",
          start_date: "2023",
          end_date: "2024",
          description: "",
          highlights: ["Supported weekly reporting"],
        },
      ],
      projects: [
        {
          name: "JobClock",
          description: "Job search assistant",
          technologies: ["Next.js"],
          highlights: [],
        },
      ],
      skills: ["TypeScript"],
      languages: [],
      certifications: [],
      activities: [],
    })

    expect(drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "education",
          label: "MSc AI",
          sourceType: "cv",
        }),
        expect.objectContaining({
          category: "experience",
          label: "Assistant at Example",
        }),
        expect.objectContaining({ category: "project", label: "JobClock" }),
      ]),
    )
    expect(drafts.every((draft) => draft.confirmedAt === null)).toBe(true)
  })

  it("returns identical output across repeated calls", () => {
    const data = {
      summary: "Software engineer focused on useful tools.",
      education: [{ degree: "BSc Computing", institution: "Example University" }],
      experience: [],
      projects: [],
      skills: ["TypeScript"],
      languages: ["English"],
      certifications: [],
      activities: [],
    }

    expect(extractProfileFactDrafts(data)).toEqual(extractProfileFactDrafts(data))
  })

  it("omits blank entries and uses the existing CV sanitizer", () => {
    const drafts = extractProfileFactDrafts({
      summary: "   ",
      education: [
        { degree: "   ", institution: "Example University" },
        { degree: "MSc AI", institution: "   " },
      ],
      experience: [
        {
          title: " ",
          company: " ",
          description: " ",
          highlights: ["  ", " Shipped reporting tools "],
        },
      ],
      projects: [
        {
          name: " ",
          description: " ",
          technologies: [" ", " Next.js "],
          highlights: [" "],
        },
      ],
      skills: ["  TypeScript  ", " "],
      languages: [" English ", ""],
      certifications: ["  AWS Cloud Practitioner  ", " "],
      activities: [],
    })

    expect(drafts.map((draft) => draft.label)).toEqual([
      "TypeScript",
      "English",
      "AWS Cloud Practitioner",
    ])
    expect(drafts.some((draft) => draft.detail.includes("Shipped reporting tools"))).toBe(false)
    expect(drafts.some((draft) => draft.detail.includes("Next.js"))).toBe(false)
  })

  it("keeps records with identifying source fields and blank optional detail", () => {
    const drafts = extractProfileFactDrafts({
      education: [{ degree: "BSc Computing", institution: "Example University" }],
      experience: [
        {
          title: "Assistant",
          company: "Example",
          description: "",
          highlights: [],
        },
      ],
      projects: [{ name: "Portfolio", description: "", highlights: [] }],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    })

    expect(drafts.map((draft) => draft.label)).toEqual([
      "BSc Computing",
      "Assistant at Example",
      "Portfolio",
    ])
    expect(drafts.every((draft) => draft.detail.length > 0)).toBe(true)
  })

  it("creates stable distinct source references for same-named records", () => {
    const data = {
      education: [],
      experience: [],
      projects: [
        { name: "Portfolio", description: "First version" },
        { name: "Portfolio", description: "Second version" },
      ],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    }

    const first = extractProfileFactDrafts(data)
    const second = extractProfileFactDrafts(data)

    expect(first).toHaveLength(2)
    expect(new Set(first.map((draft) => draft.sourceRef)).size).toBe(2)
    expect(first.map((draft) => draft.sourceRef)).toEqual(
      second.map((draft) => draft.sourceRef),
    )
  })

  it("keeps source references attached to the same source content after reordering", () => {
    const education = [
      {
        degree: "MSc AI",
        institution: "University of Manchester",
        start_date: "2024",
        end_date: "2025",
      },
      {
        degree: "BSc Computing",
        institution: "Example University",
        start_date: "2020",
        end_date: "2023",
      },
    ]
    const experience = [
      {
        title: "Assistant",
        company: "Example",
        description: "Supported reporting.",
        start_date: "2023",
        end_date: "2024",
      },
      {
        title: "Intern",
        company: "Sample",
        description: "Built internal tools.",
        start_date: "2022",
        end_date: "2022",
      },
    ]
    const projects = [
      { name: "JobClock", description: "Job search assistant" },
      { name: "Portfolio", description: "Personal website" },
    ]
    const data = {
      education,
      experience,
      projects,
      skills: ["TypeScript", "React"],
      languages: ["English", "French"],
      certifications: ["AWS Cloud Practitioner", "Azure Fundamentals"],
      activities: [],
    }
    const reordered = {
      ...data,
      education: [...education].reverse(),
      experience: [...experience].reverse(),
      projects: [...projects].reverse(),
      skills: [...data.skills].reverse(),
      languages: [...data.languages].reverse(),
      certifications: [...data.certifications].reverse(),
    }
    const refsByContent = (input: typeof data) =>
      Object.fromEntries(
        extractProfileFactDrafts(input).map((draft) => [
          `${draft.category}|${draft.label}|${draft.detail}`,
          draft.sourceRef,
        ]),
      )

    expect(refsByContent(reordered)).toEqual(refsByContent(data))
  })

  it("distinguishes same-named records using explicit source content", () => {
    const drafts = extractProfileFactDrafts({
      education: [
        {
          degree: "MSc AI",
          institution: "University of Manchester",
          start_date: "2024",
          end_date: "2025",
        },
        {
          degree: "MSc AI",
          institution: "University of Leeds",
          start_date: "2024",
          end_date: "2025",
        },
      ],
      experience: [
        {
          title: "Assistant",
          company: "Example",
          description: "",
          start_date: "2023",
          end_date: "2024",
        },
        {
          title: "Assistant",
          company: "Example",
          description: "",
          start_date: "2024",
          end_date: "2025",
        },
      ],
      projects: [
        {
          name: "Portfolio",
          description: "First version",
          start_date: "2023",
        },
        {
          name: "Portfolio",
          description: "Second version",
          start_date: "2024",
        },
      ],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    })

    for (const category of ["education", "experience", "project"] as const) {
      const refs = drafts
        .filter((draft) => draft.category === category)
        .map((draft) => draft.sourceRef)
      expect(new Set(refs).size).toBe(2)
    }
  })

  it("versions mutable content while preserving logical source identity", () => {
    const experienceBefore = extractProfileFactDrafts({
      education: [],
      experience: [
        {
          title: "Assistant",
          company: "Example",
          start_date: "2023",
          end_date: "2024",
          description: "Supported reporting.",
          highlights: ["Prepared weekly updates"],
        },
      ],
      projects: [],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    })
    const experienceAfter = extractProfileFactDrafts({
      education: [],
      experience: [
        {
          title: "Assistant",
          company: "Example",
          start_date: "2023",
          end_date: "2024",
          description: "Supported reporting.",
          highlights: ["Prepared weekly updates", "Improved the handover notes"],
        },
      ],
      projects: [],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    })
    const projectBefore = extractProfileFactDrafts({
      education: [],
      experience: [],
      projects: [
        {
          name: "Portfolio",
          description: "First description",
          url: "https://example.com",
          start_date: "2024",
        },
      ],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    })
    const projectAfter = extractProfileFactDrafts({
      education: [],
      experience: [],
      projects: [
        {
          name: "Portfolio",
          description: "Rewritten description",
          url: "https://example.com",
          start_date: "2024",
        },
      ],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    })

    expect(experienceAfter[0].logicalSourceRef).toBe(
      experienceBefore[0].logicalSourceRef,
    )
    expect(experienceAfter[0].contentDigest).not.toBe(
      experienceBefore[0].contentDigest,
    )
    expect(experienceAfter[0].sourceRef).not.toBe(experienceBefore[0].sourceRef)
    expect(projectAfter[0].logicalSourceRef).toBe(
      projectBefore[0].logicalSourceRef,
    )
    expect(projectAfter[0].contentDigest).not.toBe(
      projectBefore[0].contentDigest,
    )
    expect(projectAfter[0].sourceRef).not.toBe(projectBefore[0].sourceRef)
    expect(experienceAfter[0].sourceRef).toBe(
      `${experienceAfter[0].logicalSourceRef}:${experienceAfter[0].contentDigest}`,
    )
  })

  it("disambiguates records that share logical anchors but differ in content", () => {
    const drafts = extractProfileFactDrafts({
      education: [],
      experience: [
        {
          title: "Assistant",
          company: "Example",
          start_date: "2023",
          end_date: "2024",
          description: "Supported reporting.",
        },
        {
          title: "Assistant",
          company: "Example",
          start_date: "2023",
          end_date: "2024",
          description: "Supported customer onboarding.",
        },
      ],
      projects: [
        {
          name: "Portfolio",
          description: "First version",
          url: "https://example.com",
          start_date: "2024",
        },
        {
          name: "Portfolio",
          description: "Second version",
          url: "https://example.com",
          start_date: "2024",
        },
      ],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    })

    for (const category of ["experience", "project"] as const) {
      const refs = drafts
        .filter((draft) => draft.category === category)
        .map((draft) => draft.sourceRef)
      expect(refs).toHaveLength(2)
      expect(new Set(refs).size).toBe(2)
    }
  })

  it("keeps versioned references stable when same-anchor siblings are added or removed", () => {
    const firstProject = {
      name: "Portfolio",
      description: "First version",
      url: "https://example.com",
      start_date: "2024",
    }
    const secondProject = {
      ...firstProject,
      description: "Second version",
    }
    const extractProjects = (projects: typeof firstProject[]) =>
      extractProfileFactDrafts({
        education: [],
        experience: [],
        projects,
        skills: [],
        languages: [],
        certifications: [],
        activities: [],
      }).filter((draft) => draft.category === "project")

    const alone = extractProjects([firstProject])[0]
    const together = extractProjects([firstProject, secondProject])
    const firstTogether = together.find(
      (draft) => draft.detail === "First version | 2024 | https://example.com",
    )
    const secondTogether = together.find(
      (draft) => draft.detail === "Second version | 2024 | https://example.com",
    )
    const secondAlone = extractProjects([secondProject])[0]

    expect(firstTogether?.sourceRef).toBe(alone.sourceRef)
    expect(secondTogether?.sourceRef).toBe(secondAlone.sourceRef)
    expect(firstTogether?.logicalSourceRef).toBe(
      secondTogether?.logicalSourceRef,
    )
    expect(firstTogether?.contentDigest).not.toBe(secondTogether?.contentDigest)
  })

  it("keeps projects distinct when their source content collides under a 32-bit hash", () => {
    const drafts = extractProfileFactDrafts({
      education: [],
      experience: [],
      projects: [
        { name: "Portfolio", description: "m3zdsr-1g4s85a-1666" },
        { name: "Portfolio", description: "nhnqw3-ktdk9y-41894" },
      ],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    })
    const projectDrafts = drafts.filter(
      (draft) => draft.category === "project",
    )

    expect(projectDrafts).toHaveLength(2)
    expect(new Set(projectDrafts.map((draft) => draft.sourceRef)).size).toBe(2)
  })

  it("emits one draft for exact duplicate source records", () => {
    const duplicateExperience = {
      title: "Assistant",
      company: "Example",
      start_date: "2023",
      end_date: "2024",
      description: "Supported weekly reporting.",
      highlights: ["Prepared status updates"],
    }
    const drafts = extractProfileFactDrafts({
      education: [],
      experience: [duplicateExperience, { ...duplicateExperience }],
      projects: [],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    })
    const experienceDrafts = drafts.filter(
      (draft) => draft.category === "experience",
    )

    expect(experienceDrafts).toHaveLength(1)
    expect(new Set(experienceDrafts.map((draft) => draft.sourceRef)).size).toBe(1)
  })

  it("includes source-derived summary, skills, certifications, activities, and languages", () => {
    const drafts = extractProfileFactDrafts({
      summary: "Built web products for student communities.",
      education: [],
      experience: [],
      projects: [],
      skills: ["TypeScript"],
      languages: ["English"],
      certifications: ["AWS Cloud Practitioner"],
      activities: [
        {
          title: "Volunteer",
          company: "Community Lab",
          description: "Helped learners use web tools.",
          highlights: ["Ran weekly workshops"],
        },
      ],
    })

    expect(drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "summary",
          label: "Profile summary",
          detail: "Built web products for student communities.",
        }),
        expect.objectContaining({
          category: "skill",
          label: "TypeScript",
          detail: "TypeScript",
        }),
        expect.objectContaining({
          category: "certification",
          label: "AWS Cloud Practitioner",
          detail: "AWS Cloud Practitioner",
        }),
        expect.objectContaining({
          category: "activity",
          label: "Volunteer at Community Lab",
          detail: expect.stringContaining("Ran weekly workshops"),
        }),
        expect.objectContaining({
          category: "language",
          label: "English",
          detail: "English",
        }),
      ]),
    )
    expect(
      drafts.every(
        (draft) =>
          !draft.detail.includes("demonstrates") &&
          !draft.detail.includes("excellent") &&
          !draft.detail.includes("successful"),
      ),
    ).toBe(true)
  })

  it("returns no drafts for missing CV data", () => {
    expect(extractProfileFactDrafts(null)).toEqual([])
    expect(extractProfileFactDrafts(undefined)).toEqual([])
  })
})
