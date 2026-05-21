export const fps = 30;
export const width = 1920;
export const height = 1080;

export const sceneDurations = {
  baseCv: 5,
  browserExtension: 8,
  applicationWorkspace: 7,
  research: 8,
  cvTailoring: 10,
  storyBank: 8,
  interviewPrep: 11,
  grillMe: 12,
  pipeline: 7,
  endCard: 5,
} as const;

export const durationInFrames =
  Object.values(sceneDurations).reduce(
    (total, seconds) => total + seconds * fps,
    0,
  );

export const role = {
  title: "Software Engineer, Platform Tools",
  company: "Northstar Labs",
  location: "London / Remote",
  source: "Company careers page",
  salary: "£65k-£85k",
};

export const captions = {
  baseCv: "Start with your base CV.",
  browserExtension: "Capture a role from the browser.",
  applicationWorkspace: "Bring the opportunity into one workspace.",
  research: "Research the company and role.",
  cvTailoring: "Tailor the CV from your source material.",
  storyBank: "Keep interview stories ready.",
  interviewPrep: "Generate prep from the role and your stories.",
  grillMe: "Practice before the interview.",
  pipeline: "Track every application deliberately.",
  endCard: "A full workflow for serious job applications.",
} as const;

export const baseCv = {
  name: "Michael Ogunjimi - Base CV",
  status: "Uploaded",
  updated: "Updated today",
  sections: [
    "Summary",
    "Backend projects",
    "Platform tooling",
    "Automation",
    "Databases",
  ],
};

export const researchFindings = [
  "Platform tooling team",
  "Internal developer workflows",
  "Strong fit for automation experience",
  "Engineering culture values pragmatic ownership",
];

export const tailoringSteps = [
  "Analyzing role requirements",
  "Comparing against base CV",
  "Drafting tailored bullets",
];

export const tailoredBullets = [
  "Improved internal reporting workflows and reduced manual handoff time.",
  "Built automation around data quality checks and operational dashboards.",
  "Partnered with product teams to ship reliable platform tooling.",
];

export const storyBank = [
  {
    title: "Automated a manual reporting workflow",
    tags: ["automation", "ownership", "backend"],
    situation:
      "A recurring reporting process depended on manual checks and delayed team decisions.",
    task: "Create a reliable workflow that reduced handoffs without hiding failure states.",
    action:
      "Designed validation steps, built the automation path, and added clear review points.",
    result:
      "The team got faster, more consistent reporting with fewer manual interruptions.",
  },
  {
    title: "Debugged a production data issue",
    tags: ["debugging", "resilience"],
  },
  {
    title: "Improved developer workflow",
    tags: ["platform", "collaboration"],
  },
];

export const interviewQuestions = [
  "Tell me about a time you improved an internal developer workflow.",
  "How would you approach reliability for a platform tool used by multiple teams?",
  "Describe a time you turned an ambiguous operational problem into a shipped solution.",
];

export const grillMe = {
  question: interviewQuestions[0],
  suggestion:
    "I would structure this around the reporting automation story: start with the manual workflow, explain the validation layer, then close with the operational impact.",
  answerPreview:
    "In a previous project, I noticed a reporting workflow created delays because checks were spread across several manual steps...",
  feedback:
    "Strong structure. Add one concrete result and make the ownership boundary clearer.",
};
