# AI Job Application System — CV Optimization & Review Reference

<!--
SNAPSHOT — 2026-05-15.
This document was used as one-shot input to a grilling session that produced GitHub issue #58.
It is NOT a living spec. Prompt rules now live in:
  - src/lib/ai/prompts/      (CV tailoring stages, cover letter, CV review, CV parser, etc.)
  - src/lib/prompts/         (interview prep, interview answer, company research)
Edit those files, not this one.
-->

## Purpose

This document acts as the master internal reference for improving the following systems inside the AI job tracking and application platform:

- CV generation
- Cover letter generation
- Interview preparation
- Resume review engine
- ATS optimization engine
- Experience/title adaptation engine

This file combines:
1. The original CV optimization prompt
2. Resume review feedback
3. ATS findings
4. Strategic enhancement rules
5. Dynamic title adaptation logic
6. Premium candidate positioning logic

---

# MASTER CV OPTIMIZATION OBJECTIVE

## Core Goal

Transform the candidate into a top 1% applicant for the target role by:

- Rewriting experience into measurable business impact
- Positioning transferable experience strategically
- Optimizing for ATS parsing and keyword relevance
- Improving recruiter readability
- Creating premium positioning and commercial awareness
- Adapting titles and descriptions dynamically based on role targets

---

# ORIGINAL CORE PROMPT LOGIC

## CV Transformation Instructions

Rewrite the CV to position the candidate as a top 1% applicant for the specific role.

### Mandatory Rules

- Transform all bullet points into:
  - Results-driven statements
  - Quantified achievements
  - Commercial impact narratives

- Replace generic responsibilities with:
  - Outcomes
  - Scale
  - Revenue impact
  - Efficiency improvements
  - Strategic contributions

- Use:
  - Strong action verbs
  - Active voice
  - Commercial language
  - Technical precision

- Avoid:
  - Weak wording
  - Passive phrasing
  - Generic duties
  - Empty buzzwords

---

# ATS OPTIMIZATION RULES

## ATS Requirements

The system must:

- Extract keywords directly from job descriptions
- Naturally inject relevant terminology
- Match industry-standard tooling references
- Align job titles with target industry expectations
- Improve semantic relevance for ATS scoring

---

## ATS Optimization Priorities

### Include:
- Exact role keywords
- Relevant frameworks
- Platforms
- Technical tools
- Methodologies
- Domain-specific language

### Avoid:
- Keyword stuffing
- Robotic phrasing
- Irrelevant technical jargon
- Duplicate skill repetition

---

# PROFESSIONAL SUMMARY GENERATION RULES

## Objective

Generate a 3-line professional summary that:

- Hooks recruiters within 10 seconds
- Positions the candidate strategically
- Highlights strongest commercial value
- Matches target role expectations

---

## Professional Summary Formula

### Line 1
Role identity + years of experience + industry alignment

### Line 2
Most valuable technical/commercial capability

### Line 3
Business impact + specialization + strategic positioning

---

## Example Style

Results-driven Software Engineer with experience building scalable web applications, automation systems, and data-driven workflows across healthcare and operational environments.

Skilled in modern full-stack development, API integrations, cloud tooling, and workflow automation with a strong focus on efficiency and user experience.

Recognized for combining technical execution with commercial awareness to deliver systems that improve operations, reduce manual workload, and support scalable growth.

---

# EXPERIENCE REWRITING ENGINE

## Mandatory Structure Per Role

Each role must contain:

- 3–4 bullet points maximum
- Quantified achievements
- Strategic contributions
- Cross-functional collaboration
- Tools/platforms/processes used

---

# EXPERIENCE TRANSFORMATION LOGIC

## Weak Example

"Responsible for updating websites and helping with marketing."

## Strong Example

"Led website optimization and digital growth initiatives that contributed to a 100%+ year-over-year increase in provider engagement and revenue growth across multi-state healthcare operations."

---

# DYNAMIC TITLE ADAPTATION SYSTEM

## Core Logic

Experience titles should be strategically adapted to align with the target role while remaining truthful and defensible.

The objective is semantic alignment, not fabrication.

---

# Example Transformations

| Original Title | Target Role | Adapted Title |
|---|---|---|
| Research Assistant | Software Engineer | Software Research Assistant |
| Research Assistant | Data Analyst | Data Research Analyst |
| Marketing Assistant | Growth Operations | Growth & Operations Associate |
| Patient Porter | Healthcare Operations | Healthcare Operations Support Assistant |
| Domestic Assistant | Compliance Role | Environmental Services & Compliance Assistant |

---

# TITLE ADAPTATION RULES

## Allowed
- Expand titles
- Add industry context
- Add functional specialization
- Improve semantic alignment

## Not Allowed
- Invent seniority
- Create fake management experience
- Add fake certifications
- Claim unperformed technical work

---

# RESUME REVIEW ENGINE RULES

# CV Review Feedback Integration

## Organization & Appearance Rules

### Required:
- Professional summary
- One-page layout preferred
- Consistent formatting
- Chronological ordering

### Font Rules:
- Use one font only
- Use 2–3 font sizes maximum
- Use maximum two colors

---

# Resume Length Logic

## Preferred:
- 1 page for junior/graduate candidates
- Concise and recruiter-friendly
- High information density

---

# WORK EXPERIENCE VALIDATION RULES

## Required:
- Month + year for every role
- Reverse chronological order
- Achievement-focused bullets
- ATS-readable formatting

---

# EDUCATION RULES

## Ordering Logic

Always:
- Most recent qualification first
- Reverse chronological order

---

# SKILLS SECTION OPTIMIZATION

## Skills Constraints

### Ideal Skill Count:
8–15 skills maximum

### Prioritize:
- Technical relevance
- Job-description alignment
- ATS keywords
- Modern tooling

---

# ATS PARSING RULES

## ATS Safe Formatting

### Avoid:
- Complex tables
- Heavy graphics
- Multiple columns
- Icons inside core sections

### Prefer:
- Standard headings
- Simple hierarchy
- Clean spacing
- Text-based structure

---

# ATS EXTRACTION FEEDBACK

## Current ATS Interpretation

### Most Recent Employer
Manchester Metropolitan University

### Most Recent Position
Research Assistant

### Top Extracted Skills
- JavaScript
- TypeScript
- C#
- React
- SQL
- PostgreSQL
- Git
- Agile/Scrum
- REST APIs
- HTML5

---

# ATS IMPROVEMENT STRATEGY

## Objective

Control how ATS systems classify the candidate.

---

## Problem

The ATS currently categorizes the candidate too narrowly.

---

## Solution

The AI system should:
- Reframe experiences strategically
- Improve title alignment
- Improve semantic relevance
- Strengthen technical positioning
- Add measurable business outcomes

---

# COVER LETTER GENERATION RULES

## Cover Letter Objectives

The system should:
- Reference company priorities
- Match role responsibilities
- Show commercial awareness
- Demonstrate business understanding
- Connect experience to outcomes

---

## Cover Letter Structure

### Paragraph 1
Hook + interest + alignment

### Paragraph 2
Relevant experience + measurable impact

### Paragraph 3
Business understanding + value proposition

### Paragraph 4
Strong close + enthusiasm + action

---

# INTERVIEW PREP ENGINE

## Interview Generation Logic

Generate:
- Technical questions
- Behavioral questions
- Commercial awareness questions
- Scenario-based questions

---

## Interview Preparation Objectives

The AI should:
- Identify likely interview themes
- Generate STAR-based answers
- Tailor responses to the role
- Link answers to measurable impact

---

# PREMIUM CANDIDATE POSITIONING SYSTEM

## Top 1% Candidate Characteristics

The CV should communicate:

- Strategic thinking
- Business awareness
- Technical competence
- Communication ability
- Cross-functional collaboration
- Ownership mindset
- Execution capability

---

# TONE REQUIREMENTS

## Required Tone

The final CV must feel:
- Premium
- Sharp
- Executive-aware
- Commercially intelligent
- High-performing
- Modern
- ATS-optimized

---

## Avoid

- Generic graduate tone
- Empty buzzwords
- Overinflated language
- Weak achievement descriptions
- Excessive fluff

---

# FUTURE AI SYSTEM FEATURES

## Recommended Future Improvements

### CV Engine
- Dynamic title adaptation
- ATS scoring simulation
- Industry-specific phrasing
- Keyword gap analysis

### Cover Letter Engine
- Company research integration
- Tone adaptation
- Hiring manager simulation

### Interview Engine
- Mock interview simulation
- Weakness detection
- Confidence scoring
- Technical depth analysis

### Resume Review Engine
- Recruiter simulation
- ATS simulation
- Readability analysis
- Commercial impact scoring

---

# FINAL STRATEGIC OBJECTIVE

The system should not simply generate resumes.

It should strategically reposition candidates based on:
- Target role
- Industry expectations
- ATS systems
- Recruiter psychology
- Commercial positioning
- Market competitiveness

The output should consistently make candidates appear:
- More aligned
- More commercially valuable
- More technically credible
- More strategically positioned
- More interview-ready
