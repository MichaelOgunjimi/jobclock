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
For each question use this exact two-line format — question on line 1, blockquote on line 2:

**Q1.** [question text]
> *Round: [round name] | Best story: [story title — one sentence on why it fits, or "No matching story yet"]*

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
