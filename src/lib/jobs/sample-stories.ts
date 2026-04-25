export interface SampleStory {
  title: string
  situation: string
  task: string
  action: string
  result: string
  tags: string[]
}

export const SAMPLE_STORIES: SampleStory[] = [
  {
    title: "Resolved critical production outage",
    situation:
      "Our payment service went down during peak trading hours on a Friday afternoon, affecting roughly 4,000 active users and blocking all transactions.",
    task:
      "As the on-call engineer I needed to identify the root cause, co-ordinate the response across three teams, and restore service within our SLA of 30 minutes.",
    action:
      "I pulled logs and traced the failure to a misconfigured circuit-breaker introduced in that morning's deploy. I rolled back the offending service, verified metrics, then ran a post-mortem template in real time so we could act on findings immediately rather than wait for a retro.",
    result:
      "Service was restored in 22 minutes, within SLA. The post-mortem produced two concrete action items — automated circuit-breaker validation in CI and a canary deploy policy — both shipped the following week.",
    tags: ["problem-solving", "incident management", "pressure", "leadership"],
  },
  {
    title: "Delivered feature under tight deadline despite scope creep",
    situation:
      "Three weeks before a major client demo the product team expanded the scope of the feature I was building by roughly 40%, adding real-time notifications on top of the existing batch workflow.",
    task:
      "I had to decide what to cut, re-plan the work, and still deliver something credible for the demo without burning out the team.",
    action:
      "I ran a quick MoSCoW session with the PM and designer to separate must-haves from nice-to-haves. We agreed a phased plan: a polling-based notification stub for the demo, replaced by a WebSocket implementation in the sprint after launch. I updated the timeline in Jira, communicated the trade-off to the client contact, and pair-programmed the stub with a junior to keep velocity up.",
    result:
      "The demo landed well; the client signed the contract. The WebSocket implementation shipped 12 days later as planned, with no rework on the stub.",
    tags: ["delivery", "prioritisation", "stakeholder management", "communication"],
  },
  {
    title: "Disagreed with technical direction and changed the outcome",
    situation:
      "The team had decided to build a custom caching layer. I believed we were solving a problem that Redis already solved, and that maintaining bespoke infrastructure would become a long-term burden.",
    task:
      "I needed to make my case without undermining the colleague who had championed the original approach, and get a fair hearing before the build began.",
    action:
      "I spent an evening building a small prototype that benchmarked Redis against the proposed design under realistic load. I presented the numbers at the next architecture review, framing it as a risk to future maintainability rather than a criticism of the original idea. I also acknowledged two scenarios where the custom approach would genuinely win.",
    result:
      "The team adopted Redis. Three months later, when we needed to support pub/sub for a new feature, the decision paid off doubly — we used Redis Streams rather than building a second system.",
    tags: ["influence without authority", "technical decision-making", "conflict resolution"],
  },
  {
    title: "Mentored a junior engineer from onboarding to independent contributor",
    situation:
      "A graduate joined the team with strong academic knowledge but no commercial experience. The team was stretched on a deadline and there was no formal mentorship programme.",
    task:
      "I volunteered to be their buddy and create a structured ramp-up path that would make them productive within 6 weeks without derailing my own sprint commitments.",
    action:
      "I broke the onboarding into weekly goals and had a 30-minute check-in every Monday. I assigned increasingly complex tickets starting from well-scoped bug fixes, always reviewing their code in detail with written comments explaining the why. I deliberately let them debug issues themselves before stepping in, to build problem-solving confidence.",
    result:
      "By week 7 they were reviewing other people's PRs and owned the first solo feature end-to-end. They scored highest on the team in the quarterly peer feedback round. The approach became an informal template the team now uses for all new starters.",
    tags: ["mentoring", "leadership", "coaching", "teamwork"],
  },
  {
    title: "Improved deployment process to eliminate a recurring pain point",
    situation:
      "Deployments took around 45 minutes end-to-end and required a senior engineer to be present because several manual steps had no runbooks. This blocked releases to evenings and caused a backlog.",
    task:
      "As part of a 20% time initiative I proposed automating the deployment pipeline so that any engineer could ship safely without supervision.",
    action:
      "I audited every manual step, documented them, then rewrote the deployment scripts with pre-flight checks and automatic rollback on failure. I added Slack notifications for each stage so the team had visibility without babysitting a terminal. I shipped it incrementally, running it in parallel with the old process for two weeks to build confidence.",
    result:
      "Deploy time dropped to 11 minutes. Any engineer on the team could now run a release. We went from an average of 2 releases per week to 7. On-call burden dropped noticeably because fewer post-deploy issues slipped through.",
    tags: ["initiative", "process improvement", "impact", "automation"],
  },
  {
    title: "Led cross-functional project with competing priorities",
    situation:
      "We were rebuilding the checkout flow involving engineering, design, product, and the data science team. Each function had its own timeline and OKRs that didn't naturally align.",
    task:
      "I was asked to technical-lead the engineering work but found myself acting as de facto project manager because no one had defined cross-team dependencies.",
    action:
      "I set up a shared RAID log (Risks, Assumptions, Issues, Dependencies) and ran a weekly 30-minute sync that replaced 4 separate ad-hoc meetings. I made the dependency graph visible in Notion so everyone could see blockers before they became fires. When the data science timeline slipped, I negotiated a feature-flag approach so engineering could continue without being blocked.",
    result:
      "We shipped on the original external deadline with two minor internal milestones moved behind a flag. The checkout conversion rate improved by 11% in the first month, hitting the target set at project kick-off.",
    tags: ["leadership", "cross-functional collaboration", "project management", "stakeholder management"],
  },
  {
    title: "Navigated ambiguity on a greenfield project",
    situation:
      "I was handed a brief to 'build an internal analytics tool' with almost no further specification — no design, no defined users, no tech constraints — and a 6-week window before a board review.",
    task:
      "I needed to scope the problem, validate assumptions, choose a technical approach, and deliver something meaningful, all without the usual product process.",
    action:
      "I spent the first week interviewing six stakeholders to understand what decisions they actually needed data for. I distilled three core use-cases and drew wireframes to get early sign-off. I chose a lightweight stack (Next.js + Recharts hitting a read replica) rather than a full BI platform, which let me ship an MVP in week 4. I used weeks 5 and 6 to iterate based on real usage.",
    result:
      "The board demo went well and the tool was adopted by two teams immediately. Two months later it had 15 weekly active users across finance and ops. The three original use-cases were still the ones generating the most value.",
    tags: ["adaptability", "ambiguity", "decision-making", "product thinking"],
  },
  {
    title: "Learned from a project that failed",
    situation:
      "I led a six-week effort to migrate our search infrastructure to Elasticsearch. Halfway through, we discovered the data volume was 10× our estimate and the migration window would need to triple, which wasn't feasible.",
    task:
      "I had to decide whether to continue, pivot, or stop — and communicate the situation honestly to stakeholders without losing credibility.",
    action:
      "I called an early stop rather than dragging it out, documented the assumptions that had been wrong, and ran a brief retro. I presented to the engineering manager with a revised proposal: solve the immediate search pain with a targeted index on Postgres using pg_trgm as an interim while we gathered accurate load data for a proper Elasticsearch sizing exercise.",
    result:
      "The Postgres approach was live in 4 days and reduced search latency by 60% — enough to take the pressure off. The Elasticsearch migration was re-planned with correct data and completed successfully 3 months later. Stakeholders appreciated the transparency; it became a reference example in our engineering principles doc.",
    tags: ["accountability", "resilience", "communication", "decision-making"],
  },
]
