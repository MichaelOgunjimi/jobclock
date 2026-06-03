import { Bot, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AppFrame } from "../components/AppFrame";
import { CaptionBar } from "../components/CaptionBar";
import { Tabs } from "../components/Tabs";
import { captions, grillMe, interviewQuestions } from "../data";
import { stagger } from "../timing";
import { theme } from "../theme";

export const SceneGrillMe = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
      <AppFrame active="Interview Prep" kicker="Mock interview" title="Grill Me">
        <div
          style={{
            backgroundColor: theme.color.white,
            border: `1px solid ${theme.color.border}`,
            display: "grid",
            gap: 24,
            height: "100%",
            padding: 32,
          }}
        >
          <Tabs
            active="grill"
            tabs={[
              { value: "overview", label: "Overview" },
              { value: "interview", label: "Interview Prep" },
              {
                value: "grill",
                label: "Grill Me",
                icon: <Zap size={22} strokeWidth={1.8} />,
              },
            ]}
          />
          <div
            style={{
              display: "grid",
              gap: 24,
              gridTemplateColumns: "520px minmax(0, 1fr)",
              minHeight: 0,
            }}
          >
            <aside style={{ display: "grid", gap: 18, alignContent: "start" }}>
              <div
                style={{
                  ...stagger(frame, 0, fps),
                  border: `1px solid ${theme.color.border}`,
                  display: "grid",
                  gap: 18,
                  padding: 24,
                }}
              >
                <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
                  <ChevronLeft size={28} />
                  <span style={{ fontSize: 28, fontWeight: 800 }}>Question 1 of 3</span>
                  <ChevronRight size={28} />
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.22 }}>
                  {interviewQuestions[0]}
                </div>
              </div>
              <div
                style={{
                  ...stagger(frame, 1, fps),
                  border: `1px solid ${theme.color.border}`,
                  display: "grid",
                  gap: 14,
                  padding: 24,
                }}
              >
                <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
                  <Bot color={theme.color.accent} size={32} strokeWidth={1.8} />
                  <span style={{ fontSize: 28, fontWeight: 800 }}>
                    AI STAR suggestion
                  </span>
                </div>
                <p style={{ fontSize: 25, lineHeight: 1.35, margin: 0 }}>
                  {grillMe.suggestion}
                </p>
              </div>
            </aside>
            <section
              style={{
                ...stagger(frame, 2, fps),
                border: `1px solid ${theme.color.border}`,
                display: "grid",
                gap: 20,
                gridTemplateRows: "auto 1fr auto",
                padding: 28,
              }}
            >
              <h2
                style={{
                  fontFamily: theme.font.heading,
                  fontSize: 46,
                  fontWeight: 400,
                  lineHeight: 1.08,
                  margin: 0,
                }}
              >
                Practice answer
              </h2>
              <div
                style={{
                  backgroundColor: "#fbfbfb",
                  border: `1px solid ${theme.color.border}`,
                  color: theme.color.foreground,
                  fontSize: 28,
                  lineHeight: 1.42,
                  padding: 24,
                }}
              >
                {grillMe.answerPreview}
              </div>
              <div
                style={{
                  backgroundColor: theme.color.foreground,
                  color: theme.color.white,
                  fontSize: 29,
                  fontWeight: 800,
                  padding: "21px 24px",
                  textAlign: "center",
                }}
              >
                Evaluate my answer
              </div>
              <div
                style={{
                  backgroundColor: "rgba(107,45,60,0.08)",
                  border: `1px solid rgba(107,45,60,0.22)`,
                  color: theme.color.accent,
                  fontSize: 24,
                  fontWeight: 750,
                  lineHeight: 1.28,
                  padding: "16px 18px",
                }}
              >
                {grillMe.feedback}
              </div>
            </section>
          </div>
        </div>
      </AppFrame>
      <CaptionBar text={captions.grillMe} />
    </AbsoluteFill>
  );
};
