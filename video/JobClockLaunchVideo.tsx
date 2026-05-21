import { AbsoluteFill } from "remotion";
import { BookOpen, Building2, Zap } from "lucide-react";
import { AppFrame } from "./components/AppFrame";
import { CaptionBar } from "./components/CaptionBar";
import { DocumentPanel } from "./components/DocumentPanel";
import { GenerationProgress } from "./components/GenerationProgress";
import { PipelineStepper } from "./components/PipelineStepper";
import { Tabs } from "./components/Tabs";
import { baseCv, captions, role, tailoringSteps } from "./data";
import { theme } from "./theme";

export const JobClockLaunchVideo = () => {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        backgroundColor: theme.color.background,
        color: theme.color.foreground,
        display: "flex",
        fontFamily: theme.font.sans,
        justifyContent: "center",
        padding: "70px 96px 150px",
      }}
    >
      <AppFrame
        active="Applications"
        kicker={`${role.company} / ${role.location}`}
        title={role.title}
      >
        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "minmax(0, 1fr) 420px",
            height: "100%",
            minWidth: 0,
          }}
        >
          <DocumentPanel
            title={baseCv.name}
            subtitle={`${baseCv.status} / ${baseCv.updated}`}
            sections={[
              {
                heading: "Profile",
                bullets: [
                  "Platform-minded software engineer focused on practical automation.",
                  "Turns repeated operational work into reliable internal tooling.",
                ],
              },
              {
                heading: "Relevant experience",
                bullets: [
                  "Improved reporting workflows and reduced manual handoff time.",
                  "Built data quality checks around operational dashboards.",
                  "Partnered with product teams to ship dependable tooling.",
                ],
              },
            ]}
            items={baseCv.sections}
          />
          <div
            style={{
              display: "grid",
              gap: 22,
              gridTemplateRows: "auto auto 1fr",
            }}
          >
            <Tabs
              active="prep"
              tabs={[
                {
                  value: "prep",
                  label: "Interview Prep",
                  icon: <BookOpen size={18} strokeWidth={1.8} />,
                },
                {
                  value: "research",
                  label: "Research",
                  icon: <Building2 size={18} strokeWidth={1.8} />,
                },
                {
                  value: "grill",
                  label: "Grill Me",
                  icon: <Zap size={18} strokeWidth={1.8} />,
                },
              ]}
            />
            <GenerationProgress rows={tailoringSteps} startFrame={12} />
            <PipelineStepper progress={0.25} />
          </div>
        </div>
      </AppFrame>
      <CaptionBar text={captions.applicationWorkspace} />
    </AbsoluteFill>
  );
};
