export function researchSystemPrompt(): string {
  return `You are a professional company researcher and career strategist. Provide accurate, structured company intelligence. Be specific. If you are uncertain about a fact, say so explicitly rather than guessing. Format your response using markdown: use ## for section headers and bullet lists throughout.`
}

export function researchUserPrompt({
  company,
  title,
  description,
}: {
  company: string
  title: string
  description: string
}): string {
  return `Research **${company}** for a candidate interviewing for the **${title}** role.

Provide a structured report across exactly these 6 axes:

## 1. AI / Product Strategy
- Core products and services
- Known tech stack and engineering approach
- AI initiatives, LLM integrations, or ML product lines
- Notable engineering blog posts, papers, or open-source work

## 2. Recent Moves *(last 12 months)*
- Funding rounds, M&A activity, major pivots
- Key leadership changes
- Major product launches or announcements
- Headcount trajectory (growing? restructuring?)

## 3. Engineering Culture
- Remote vs hybrid vs on-site policy
- Known engineering practices (mono-repo, open source, etc.)
- What engineers and employees say about working there
- Shipping cadence and team structure

## 4. Probable Challenges
- What business or technical problems this team is likely solving right now
- Scaling, cost, or competitive pressures they face
- Why they are likely hiring for this specific role

## 5. Competitive Landscape
- Main competitors and how ${company} differentiates
- Market position and trajectory
- Any threats or tailwinds

## 6. Your Personal Angle
Based on this job description:
> ${description}

- What specific experience or perspective would make a candidate stand out?
- What 2–3 insightful questions could the candidate ask to impress the interviewer?
- What company-specific context should the candidate reference in their answers?

Be honest about the limits of your knowledge. Use *"likely"* or *"as of my last update"* where appropriate.`
}
