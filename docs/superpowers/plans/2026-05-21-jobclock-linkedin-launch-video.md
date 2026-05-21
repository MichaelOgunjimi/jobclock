# JobClock LinkedIn Launch Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 16:9 Remotion launch video that shows the real JobClock workflow from base CV upload through browser-extension save, research, CV tailoring, interview prep, Grill Me practice, and pipeline tracking.

**Architecture:** Add an isolated Remotion video project under `video/` while keeping the Next.js app code untouched. The composition will be data-driven: `video/data.ts` owns role details, copy, and timeline durations; reusable UI primitives render app-faithful JobClock panels; scene components compose those primitives into each workflow beat. Root `package.json` gets scripts for Studio, still render, and full render.

**Tech Stack:** Remotion 4.0.464, React 19, TypeScript, CSS imported through the Remotion entry point, existing JobClock visual language from `src/app/globals.css`.

---

## Source Design

Implement against:

- `docs/superpowers/specs/2026-05-21-jobclock-linkedin-launch-video-design.md`
- `src/app/page.tsx` for public positioning and copy style
- `src/app/(dashboard)/interview/page.tsx` for Story Bank behavior
- `src/app/(dashboard)/applications/[id]/interview/page.tsx` for Interview Prep, Company Research, and Grill Me tabs
- `src/components/app-sidebar.tsx` for dashboard navigation style
- `src/app/globals.css` for colors, typography cues, spacing, and borders

## File Structure

Create:

- `video/index.ts`: Remotion entry point, imports CSS, registers root.
- `video/Root.tsx`: defines `JobClockLaunchVideo` composition and optional still.
- `video/JobClockLaunchVideo.tsx`: assembles scenes with `<Series>`.
- `video/data.ts`: single source of truth for role, company, captions, scene durations, prep questions, story bank entries, and generated snippets.
- `video/timing.ts`: frame helpers and easing helper functions.
- `video/theme.ts`: JobClock color, typography, and layout tokens.
- `video/styles.css`: deterministic global CSS for Remotion render.
- `video/components/AppFrame.tsx`: app-faithful shell with sidebar and workspace.
- `video/components/BrowserFrame.tsx`: browser and extension simulation.
- `video/components/CaptionBar.tsx`: consistent lower caption.
- `video/components/DocumentPanel.tsx`: CV/document preview panels.
- `video/components/GenerationProgress.tsx`: deterministic AI progress rows.
- `video/components/PipelineStepper.tsx`: saved-to-applied status animation.
- `video/components/Tabs.tsx`: app-style tab strip.
- `video/scenes/SceneBaseCv.tsx`
- `video/scenes/SceneBrowserExtension.tsx`
- `video/scenes/SceneApplicationWorkspace.tsx`
- `video/scenes/SceneResearch.tsx`
- `video/scenes/SceneCvTailoring.tsx`
- `video/scenes/SceneStoryBank.tsx`
- `video/scenes/SceneInterviewPrep.tsx`
- `video/scenes/SceneGrillMe.tsx`
- `video/scenes/ScenePipeline.tsx`
- `video/scenes/SceneEndCard.tsx`
- `video/README.md`: render commands and composition notes.

Modify:

- `package.json`: add Remotion dev dependencies and video scripts.
- `package-lock.json`: update after installation.

Do not modify app routes or product behavior.

## Timeline

Use 30fps, 1920x1080, and flexible duration derived from scene data.

Initial scene seconds:

- `baseCv`: 5
- `browserExtension`: 8
- `applicationWorkspace`: 7
- `research`: 8
- `cvTailoring`: 10
- `storyBank`: 8
- `interviewPrep`: 11
- `grillMe`: 12
- `pipeline`: 7
- `endCard`: 5

Total target: 81 seconds. This can stretch only if text becomes unreadable during implementation.

## Task 1: Install Remotion And Add Scripts

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install exact matching Remotion packages**

Run:

```bash
npm install --save-dev remotion@4.0.464 @remotion/cli@4.0.464
```

Expected:

- `package.json` includes both packages in `devDependencies`.
- `package-lock.json` updates.
- No app source files change.

- [ ] **Step 2: Add video scripts to `package.json`**

Add these scripts without removing existing scripts:

```json
{
  "video:studio": "remotion studio video/index.ts",
  "video:still": "remotion still video/index.ts JobClockLaunchVideo out/jobclock-launch-still.png --frame=90 --scale=0.5",
  "video:render": "remotion render video/index.ts JobClockLaunchVideo out/jobclock-linkedin-launch.mp4"
}
```

Expected:

- `npm run video:studio` starts Remotion Studio.
- `npm run video:still` renders a still from the browser-extension beat.
- `npm run video:render` renders the final MP4 to `out/jobclock-linkedin-launch.mp4`.

- [ ] **Step 3: Verify scripts are registered**

Run:

```bash
npm run video:still -- --help
```

Expected:

- Remotion CLI prints help or command usage.
- If the composition does not exist yet, the command may fail after CLI startup; the failure must mention missing entry/composition, not missing package or missing script.

- [ ] **Step 4: Commit installation**

```bash
git add package.json package-lock.json
cat > /tmp/cm.txt << 'EOF'
build(config): add remotion video tooling

- Add Remotion CLI dependencies for local video rendering
- Add scripts for Studio, still rendering, and MP4 rendering
EOF
git commit -F /tmp/cm.txt && rm /tmp/cm.txt && git log -1 --format="committed: %h %s"
```

## Task 2: Create Remotion Root, Theme, Data, And Timing Helpers

**Files:**

- Create: `video/index.ts`
- Create: `video/Root.tsx`
- Create: `video/JobClockLaunchVideo.tsx`
- Create: `video/data.ts`
- Create: `video/theme.ts`
- Create: `video/timing.ts`
- Create: `video/styles.css`

- [ ] **Step 1: Create shared data**

Create `video/data.ts` with these exports:

```ts
export const fps = 30
export const width = 1920
export const height = 1080

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
} as const

export const durationInFrames = Object.values(sceneDurations).reduce(
  (total, seconds) => total + seconds * fps,
  0,
)

export const role = {
  title: "Software Engineer, Platform Tools",
  company: "Northstar Labs",
  location: "London / Remote",
  source: "Company careers page",
  salary: "£65k-£85k",
}

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
} as const

export const baseCv = {
  name: "Michael Ogunjimi - Base CV",
  status: "Uploaded",
  updated: "Updated today",
  sections: ["Summary", "Backend projects", "Platform tooling", "Automation", "Databases"],
}

export const researchFindings = [
  "Platform tooling team",
  "Internal developer workflows",
  "Strong fit for automation experience",
  "Engineering culture values pragmatic ownership",
]

export const tailoringSteps = [
  "Analyzing role requirements",
  "Comparing against base CV",
  "Drafting tailored bullets",
]

export const tailoredBullets = [
  "Improved internal reporting workflows and reduced manual handoff time.",
  "Built automation around data quality checks and operational dashboards.",
  "Partnered with product teams to ship reliable platform tooling.",
]

export const storyBank = [
  {
    title: "Automated a manual reporting workflow",
    tags: ["automation", "ownership", "backend"],
    situation: "A recurring reporting process depended on manual checks and delayed team decisions.",
    task: "Create a reliable workflow that reduced handoffs without hiding failure states.",
    action: "Designed validation steps, built the automation path, and added clear review points.",
    result: "The team got faster, more consistent reporting with fewer manual interruptions.",
  },
  {
    title: "Debugged a production data issue",
    tags: ["debugging", "resilience"],
  },
  {
    title: "Improved developer workflow",
    tags: ["platform", "collaboration"],
  },
]

export const interviewQuestions = [
  "Tell me about a time you improved an internal developer workflow.",
  "How would you approach reliability for a platform tool used by multiple teams?",
  "Describe a time you turned an ambiguous operational problem into a shipped solution.",
]

export const grillMe = {
  question: interviewQuestions[0],
  suggestion:
    "I would structure this around the reporting automation story: start with the manual workflow, explain the validation layer, then close with the operational impact.",
  answerPreview:
    "In a previous project, I noticed a reporting workflow created delays because checks were spread across several manual steps...",
  feedback:
    "Strong structure. Add one concrete result and make the ownership boundary clearer.",
}
```

- [ ] **Step 2: Create theme tokens**

Create `video/theme.ts`:

```ts
export const theme = {
  color: {
    background: "#ffffff",
    foreground: "#0a0a0a",
    card: "#ffffff",
    secondary: "#fafafa",
    muted: "#f5f5f5",
    mutedForeground: "#777777",
    border: "#e5e5e5",
    accent: "#6b2d3c",
    sidebar: "#0a0a0a",
    sidebarPrimary: "#282828",
    sidebarBorder: "rgba(255,255,255,0.08)",
    white: "#ffffff",
  },
  font: {
    sans: "Inter, Arial, sans-serif",
    heading: "Georgia, 'Times New Roman', serif",
    mono: "'SFMono-Regular', Consolas, monospace",
  },
  radius: 0,
  shadow: "0 30px 80px rgba(10,10,10,0.12)",
} as const
```

- [ ] **Step 3: Create timing helpers**

Create `video/timing.ts`:

```ts
import { Easing, interpolate } from "remotion"

export function seconds(value: number, fps: number) {
  return Math.round(value * fps)
}

export function ease(frame: number, from: number, duration: number) {
  return interpolate(frame, [from, from + duration], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
}

export function fadeUp(frame: number, delay: number, duration: number) {
  const progress = ease(frame, delay, duration)
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [28, 0])}px)`,
  }
}

export function stagger(frame: number, index: number, fps: number, startSeconds = 0.3) {
  return fadeUp(frame, seconds(startSeconds, fps) + index * seconds(0.14, fps), seconds(0.55, fps))
}
```

- [ ] **Step 4: Create Remotion entry, root, and shell composition**

Create `video/index.ts`:

```ts
import { registerRoot } from "remotion"
import { RemotionRoot } from "./Root"
import "./styles.css"

registerRoot(RemotionRoot)
```

Create `video/Root.tsx`:

```tsx
import { Composition, Still } from "remotion"
import { JobClockLaunchVideo } from "./JobClockLaunchVideo"
import { durationInFrames, fps, height, width } from "./data"

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="JobClockLaunchVideo"
        component={JobClockLaunchVideo}
        durationInFrames={durationInFrames}
        fps={fps}
        width={width}
        height={height}
      />
      <Still id="JobClockLaunchPoster" component={JobClockLaunchVideo} width={width} height={height} />
    </>
  )
}
```

Create an initial `video/JobClockLaunchVideo.tsx`:

```tsx
import { AbsoluteFill } from "remotion"
import { theme } from "./theme"

export const JobClockLaunchVideo = () => {
  return (
    <AbsoluteFill
      style={{
        background: theme.color.background,
        color: theme.color.foreground,
        fontFamily: theme.font.sans,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ fontFamily: theme.font.heading, fontSize: 96 }}>JobClock</div>
      <div style={{ marginTop: 20, color: theme.color.mutedForeground, fontSize: 30 }}>
        A full workflow for serious job applications.
      </div>
    </AbsoluteFill>
  )
}
```

Create `video/styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Inter, Arial, sans-serif;
}
```

- [ ] **Step 5: Run type check and still render**

Run:

```bash
npx tsc --noEmit
npm run video:still
```

Expected:

- TypeScript passes.
- Remotion writes a still image for `JobClockLaunchVideo`.
- The still is nonblank and shows the starter JobClock end card.

- [ ] **Step 6: Commit root scaffold**

```bash
git add video/index.ts video/Root.tsx video/JobClockLaunchVideo.tsx video/data.ts video/theme.ts video/timing.ts video/styles.css
cat > /tmp/cm.txt << 'EOF'
feat(ui): scaffold jobclock remotion composition

- Add the Remotion root and launch video composition
- Define JobClock video data, timing helpers, and theme tokens
- Add initial still-renderable JobClock end card
EOF
git commit -F /tmp/cm.txt && rm /tmp/cm.txt && git log -1 --format="committed: %h %s"
```

## Task 3: Build Reusable JobClock Video Components

**Files:**

- Create: `video/components/AppFrame.tsx`
- Create: `video/components/BrowserFrame.tsx`
- Create: `video/components/CaptionBar.tsx`
- Create: `video/components/DocumentPanel.tsx`
- Create: `video/components/GenerationProgress.tsx`
- Create: `video/components/PipelineStepper.tsx`
- Create: `video/components/Tabs.tsx`

- [ ] **Step 1: Create `CaptionBar`**

Create a lower caption component with fixed placement and readable text:

```tsx
import { useCurrentFrame, useVideoConfig } from "remotion"
import { fadeUp } from "../timing"
import { theme } from "../theme"

export function CaptionBar({ text }: { text: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const style = fadeUp(frame, Math.round(0.15 * fps), Math.round(0.5 * fps))

  return (
    <div
      style={{
        ...style,
        position: "absolute",
        left: 96,
        right: 96,
        bottom: 54,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          border: `1px solid ${theme.color.border}`,
          background: "rgba(255,255,255,0.92)",
          padding: "16px 26px",
          fontSize: 28,
          letterSpacing: 0,
          color: theme.color.foreground,
          boxShadow: "0 16px 50px rgba(10,10,10,0.08)",
        }}
      >
        {text}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `AppFrame`**

Create `video/components/AppFrame.tsx` with a dark sidebar and light workspace:

```tsx
import type { ReactNode } from "react"
import { LayoutDashboard, Search, Send, BookOpen, BarChart2, FileText, Settings } from "lucide-react"
import { theme } from "../theme"

const nav = [
  ["Dashboard", LayoutDashboard],
  ["Job Search", Search],
  ["Applications", Send],
  ["Interview Prep", BookOpen],
  ["Analytics", BarChart2],
  ["My CV", FileText],
] as const

export function AppFrame({
  active,
  title,
  kicker,
  children,
}: {
  active: string
  title: string
  kicker: string
  children: ReactNode
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", width: "100%", height: "100%" }}>
      <aside style={{ background: theme.color.sidebar, color: theme.color.white, padding: 28, borderRight: `1px solid ${theme.color.sidebarBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 28, borderBottom: `1px solid ${theme.color.sidebarBorder}` }}>
          <div style={{ width: 48, height: 48, border: "1px solid rgba(255,255,255,0.12)", display: "grid", placeItems: "center", fontFamily: theme.font.heading, fontSize: 30 }}>J</div>
          <div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>Job Assistant</div>
            <div style={{ fontFamily: theme.font.heading, fontSize: 28, lineHeight: 1 }}>Workspace</div>
          </div>
        </div>
        <nav style={{ display: "grid", gap: 10, paddingTop: 28 }}>
          {nav.map(([label, Icon]) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                border: `1px solid ${label === active ? "rgba(255,255,255,0.12)" : "transparent"}`,
                background: label === active ? theme.color.sidebarPrimary : "transparent",
                color: label === active ? theme.color.white : "rgba(255,255,255,0.5)",
                padding: "14px 16px",
                fontSize: 15,
              }}
            >
              <Icon size={18} />
              {label}
            </div>
          ))}
          <div style={{ marginTop: 18, color: "rgba(255,255,255,0.45)", display: "flex", gap: 12, padding: "14px 16px", fontSize: 15 }}>
            <Settings size={18} />
            Settings
          </div>
        </nav>
      </aside>
      <main style={{ background: theme.color.background, padding: 52, overflow: "hidden" }}>
        <div style={{ borderBottom: `1px solid ${theme.color.border}`, paddingBottom: 26, marginBottom: 30 }}>
          <div style={{ color: theme.color.mutedForeground, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>{kicker}</div>
          <h1 style={{ margin: "10px 0 0", fontFamily: theme.font.heading, fontSize: 54, lineHeight: 0.95, letterSpacing: "-0.04em", fontWeight: 500 }}>{title}</h1>
        </div>
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create the remaining primitives**

Create:

- `BrowserFrame` with browser chrome, a job listing card, and an extension panel slot.
- `DocumentPanel` with a paper preview and side summary.
- `GenerationProgress` with deterministic check rows driven by frame progress.
- `PipelineStepper` with app statuses and a highlighted current status.
- `Tabs` with active tab styling matching the interview page.

Use inline styles and imported Remotion timing helpers. Do not use CSS animations, CSS transitions, or Tailwind animation classes.

- [ ] **Step 4: Render primitive smoke still**

Temporarily import `AppFrame` in `JobClockLaunchVideo.tsx` and render one frame containing `AppFrame` and `CaptionBar`.

Run:

```bash
npm run video:still
```

Expected:

- Still render succeeds.
- Sidebar looks like JobClock.
- Caption text is readable at 1920x1080.

- [ ] **Step 5: Commit primitives**

```bash
git add video/components video/JobClockLaunchVideo.tsx
cat > /tmp/cm.txt << 'EOF'
feat(ui): add jobclock video primitives

- Add app, browser, document, progress, tabs, caption, and pipeline components
- Match JobClock dashboard styling for video scenes
- Keep motion controlled by Remotion frame interpolation
EOF
git commit -F /tmp/cm.txt && rm /tmp/cm.txt && git log -1 --format="committed: %h %s"
```

## Task 4: Build Workflow Scenes

**Files:**

- Create: `video/scenes/SceneBaseCv.tsx`
- Create: `video/scenes/SceneBrowserExtension.tsx`
- Create: `video/scenes/SceneApplicationWorkspace.tsx`
- Create: `video/scenes/SceneResearch.tsx`
- Create: `video/scenes/SceneCvTailoring.tsx`
- Create: `video/scenes/SceneStoryBank.tsx`
- Create: `video/scenes/SceneInterviewPrep.tsx`
- Create: `video/scenes/SceneGrillMe.tsx`
- Create: `video/scenes/ScenePipeline.tsx`
- Create: `video/scenes/SceneEndCard.tsx`
- Modify: `video/JobClockLaunchVideo.tsx`

- [ ] **Step 1: Build each scene as a self-contained component**

Each scene must:

- Use `useCurrentFrame()` and `useVideoConfig()` for animation.
- End with `<CaptionBar text={captions.<scene>} />`.
- Keep all critical text at 24px or larger.
- Use role data from `video/data.ts`.
- Avoid generic copy; use the exact product vocabulary from the spec.

- [ ] **Step 2: Implement scene-specific content**

Required scene content:

- `SceneBaseCv`: My CV page, base CV upload card, sections list.
- `SceneBrowserExtension`: browser listing for Northstar Labs, extension panel, Save to JobClock button, saved confirmation.
- `SceneApplicationWorkspace`: saved application detail with role, source, selected CV, and next actions.
- `SceneResearch`: Company Research tab/card with four research findings.
- `SceneCvTailoring`: progress rows and tailored bullet preview.
- `SceneStoryBank`: global Story Bank page with three story cards and one expanded STAR story.
- `SceneInterviewPrep`: per-application tabs, active Interview Prep tab, likely questions, best story matches, technical checklist.
- `SceneGrillMe`: active Grill Me tab, question navigator, AI STAR suggestion, answer textarea, Evaluate my answer action.
- `ScenePipeline`: saved-to-applied status stepper and application summary.
- `SceneEndCard`: JobClock, "A full workflow for serious job applications.", "Built by Michael Ogunjimi".

- [ ] **Step 3: Compose scenes using `<Series>`**

Modify `video/JobClockLaunchVideo.tsx` to use `Series`:

```tsx
import { AbsoluteFill, Series } from "remotion"
import { sceneDurations, fps } from "./data"
import { SceneApplicationWorkspace } from "./scenes/SceneApplicationWorkspace"
import { SceneBaseCv } from "./scenes/SceneBaseCv"
import { SceneBrowserExtension } from "./scenes/SceneBrowserExtension"
import { SceneCvTailoring } from "./scenes/SceneCvTailoring"
import { SceneEndCard } from "./scenes/SceneEndCard"
import { SceneGrillMe } from "./scenes/SceneGrillMe"
import { SceneInterviewPrep } from "./scenes/SceneInterviewPrep"
import { ScenePipeline } from "./scenes/ScenePipeline"
import { SceneResearch } from "./scenes/SceneResearch"
import { SceneStoryBank } from "./scenes/SceneStoryBank"
import { theme } from "./theme"

const frames = (seconds: number) => seconds * fps

export const JobClockLaunchVideo = () => {
  return (
    <AbsoluteFill style={{ background: theme.color.background, color: theme.color.foreground, fontFamily: theme.font.sans }}>
      <Series>
        <Series.Sequence durationInFrames={frames(sceneDurations.baseCv)}>
          <SceneBaseCv />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.browserExtension)}>
          <SceneBrowserExtension />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.applicationWorkspace)}>
          <SceneApplicationWorkspace />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.research)}>
          <SceneResearch />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.cvTailoring)}>
          <SceneCvTailoring />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.storyBank)}>
          <SceneStoryBank />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.interviewPrep)}>
          <SceneInterviewPrep />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.grillMe)}>
          <SceneGrillMe />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.pipeline)}>
          <ScenePipeline />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.endCard)}>
          <SceneEndCard />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 4: Render stills at key frames**

Run:

```bash
npm run video:still -- --frame=30
npm run video:still -- --frame=210
npm run video:still -- --frame=780
npm run video:still -- --frame=1650
```

Expected:

- Frame 30: base CV scene.
- Frame 210: browser extension scene.
- Frame 780: CV tailoring or research area depending on exact timing.
- Frame 1650: Grill Me or pipeline area depending on exact timing.
- No blank frames.
- No cropped captions.

- [ ] **Step 5: Commit scenes**

```bash
git add video/JobClockLaunchVideo.tsx video/scenes
cat > /tmp/cm.txt << 'EOF'
feat(ui): add jobclock launch video scenes

- Build workflow scenes for CV upload, extension save, research, tailoring, interview prep, Grill Me, and pipeline
- Compose the full 16:9 Remotion timeline
- Keep role and captions driven by shared video data
EOF
git commit -F /tmp/cm.txt && rm /tmp/cm.txt && git log -1 --format="committed: %h %s"
```

## Task 5: Polish Motion, Readability, And Documentation

**Files:**

- Modify: `video/scenes/*.tsx`
- Modify: `video/components/*.tsx`
- Create: `video/README.md`

- [ ] **Step 1: Review rendered stills for readability**

Open the still outputs from Task 4. Check:

- Captions do not overlap UI.
- Text inside panels is readable.
- Sidebar and tabs resemble JobClock.
- Browser extension save beat is clear.
- Story Bank, Interview Prep, and Grill Me are visually distinct.

- [ ] **Step 2: Adjust text density and timing**

If any scene is cramped:

- Move secondary text into shorter chips.
- Increase that scene's seconds in `video/data.ts`.
- Prefer one focused panel over multiple tiny panels.
- Keep the total duration flexible.

- [ ] **Step 3: Create `video/README.md`**

Write:

```md
# JobClock Launch Video

Remotion composition for the LinkedIn launch video.

## Commands

- `npm run video:studio` opens Remotion Studio.
- `npm run video:still` renders a quick still check.
- `npm run video:render` renders `out/jobclock-linkedin-launch.mp4`.

## Composition

- Composition id: `JobClockLaunchVideo`
- Format: 1920x1080, 30fps
- Story: base CV upload, browser extension save, research, CV tailoring, Story Bank, Interview Prep, Grill Me, pipeline, end card.

The timeline is data-driven in `video/data.ts`; adjust scene durations there when readability needs more time.
```

- [ ] **Step 4: Run verification**

Run:

```bash
npx tsc --noEmit
npm run video:still
npm run video:render
```

Expected:

- TypeScript passes.
- Still render succeeds.
- MP4 renders to `out/jobclock-linkedin-launch.mp4`.
- The rendered video is nonzero size.

- [ ] **Step 5: Commit polish and docs**

```bash
git add video package.json package-lock.json
cat > /tmp/cm.txt << 'EOF'
docs(ui): document jobclock launch video workflow

- Add render commands and composition notes for the Remotion video
- Polish scene timing and readability after still checks
- Verify still and full MP4 rendering
EOF
git commit -F /tmp/cm.txt && rm /tmp/cm.txt && git log -1 --format="committed: %h %s"
```

## Final Verification Checklist

- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run video:still` succeeds.
- [ ] `npm run video:render` succeeds.
- [ ] `out/jobclock-linkedin-launch.mp4` exists and has nonzero size.
- [ ] Video is 16:9.
- [ ] The video works silently through captions.
- [ ] The duration is allowed to be longer than the original 45-55 second idea.
- [ ] Base CV setup appears before AI tailoring.
- [ ] Browser extension save is a clear early highlight.
- [ ] Story Bank, Interview Prep, and Grill Me are all included.
- [ ] End card says "JobClock", "A full workflow for serious job applications.", and "Built by Michael Ogunjimi".

## Self-Review Notes

- Spec coverage: every scene from the approved spec is mapped to Task 4, and Remotion setup/rendering is covered by Tasks 1, 2, and 5.
- Red-flag scan: the plan contains no unfinished-work markers. The only flexible item is duration, which is explicitly allowed by the spec.
- Type consistency: composition id is consistently `JobClockLaunchVideo`; data exports and scene names match the import list in Task 4.
