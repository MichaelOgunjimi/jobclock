export function interviewSystemPrompt(): string {
  return `You are an expert interview coach. Be specific and grounded in the actual job description provided. Never fabricate interview questions — only generate ones clearly suggested by the JD or standard for this role type. Format your response using markdown: use ## for section headers, **bold** for question text, and bullet lists for checklist items.`
}

export function interviewUserPrompt({
  title,
  company,
  description,
  storyBankText,
}: {
  title: string
  company: string
  description: string
  storyBankText: string
}): string {
  return `Prepare a structured interview plan for the **${title}** role at **${company}**.

## Job Description
${description.slice(0, 3000)}

## Candidate's STAR Story Bank
${storyBankText}

Generate a plan with exactly these sections:

## 1. Process Overview
- Typical interview rounds for this type of role (e.g. HR screen, technical, system design, behavioural, hiring manager)
- What each round likely focuses on, based on the JD
- Approximate timeline if inferable

## 2. Likely Questions (10–12 questions)
For each question use this exact three-line format:

**Q1.** [question text]
> *Round: [round name] | Best story: [story title — one sentence on why it fits, or "No matching story yet"]*
> *Angle: [What the interviewer is really assessing — 10 words max. How to structure your answer — 10 words max.]*

Leave a blank line between each question.

## 3. Technical Prep Checklist
- Key skills, tools, and frameworks from the JD the candidate must be ready to demonstrate
- Any specific algorithms, architectures, or concepts to review

## 4. Red Flags to Address
- Anything in the JD that might suggest a gap; one sentence on how to handle each

## 5. Questions to Ask Them
Five strong questions for the candidate to ask.

Keep it grounded in the JD. Label anything inferred as *[inferred]*.`
}

export function interviewAnswerSystemPrompt(): string {
  return `You are an expert interview coach drafting a STAR answer for a single interview question. Use ONLY the candidate's provided story as the source of facts — never fabricate or invent details (metrics, dates, technologies, outcomes) that are not in the story. If the story is thin, keep the answer short rather than padding with invented context. Write in first person, in the candidate's natural voice (conversational but professional). Output plain text only — no headings, no markdown.`
}

export function interviewAnswerPrompt({
  question,
  story,
  jdContext,
}: {
  question: string
  story: string
  jdContext: string
}): string {
  return `Draft a STAR-structured answer to this interview question, using only the candidate's story below.

## Question
${question}

## Candidate's Story
${story}

## Job Context
${jdContext}

## Instructions
- Structure the answer using the STAR pattern (Situation, Task, Action, Result), but write it naturally — don't label the parts explicitly.
- Tie the result back to what the role values, drawn from the job context.
- Keep it under 200 words.
- Use only facts present in the story. Do not invent metrics, tools, or outcomes.

Return the answer text only.`
}
