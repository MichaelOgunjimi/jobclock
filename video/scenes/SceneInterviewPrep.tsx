import { BookOpen, CheckSquare, MessageSquareText } from "lucide-react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AppFrame } from "../components/AppFrame";
import { CaptionBar } from "../components/CaptionBar";
import { Tabs } from "../components/Tabs";
import { captions, interviewQuestions, role, storyBank } from "../data";
import { stagger } from "../timing";
import { theme } from "../theme";

export const SceneInterviewPrep = () => {
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
      <AppFrame active="Applications" kicker={role.company} title="Application Prep">
        <div
          style={{
            backgroundColor: theme.color.white,
            border: `1px solid ${theme.color.border}`,
            display: "grid",
            gap: 26,
            height: "100%",
            padding: 32,
          }}
        >
          <Tabs
            active="interview"
            tabs={[
              { value: "overview", label: "Overview" },
              { value: "research", label: "Research" },
              {
                value: "interview",
                label: "Interview Prep",
                icon: <BookOpen size={22} strokeWidth={1.8} />,
              },
              { value: "grill", label: "Grill Me" },
            ]}
          />
          <div
            style={{
              display: "grid",
              gap: 22,
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.9fr) 360px",
              minHeight: 0,
            }}
          >
            <section style={{ display: "grid", gap: 14 }}>
              <h2
                style={{
                  fontFamily: theme.font.heading,
                  fontSize: 42,
                  fontWeight: 400,
                  lineHeight: 1.08,
                  margin: 0,
                }}
              >
                Likely questions
              </h2>
              {interviewQuestions.map((question, index) => (
                <div
                  key={question}
                  style={{
                    ...stagger(frame, index, fps),
                    border: `1px solid ${theme.color.border}`,
                    fontSize: 26,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    padding: "18px 20px",
                  }}
                >
                  {question}
                </div>
              ))}
            </section>
            <section style={{ display: "grid", gap: 14 }}>
              <h2
                style={{
                  fontFamily: theme.font.heading,
                  fontSize: 42,
                  fontWeight: 400,
                  lineHeight: 1.08,
                  margin: 0,
                }}
              >
                Best story matches
              </h2>
              {storyBank.slice(0, 3).map((story, index) => (
                <div
                  key={story.title}
                  style={{
                    ...stagger(frame, index + 1, fps),
                    border: `1px solid ${theme.color.border}`,
                    display: "grid",
                    gap: 10,
                    padding: "18px 20px",
                  }}
                >
                  <MessageSquareText
                    color={theme.color.accent}
                    size={28}
                    strokeWidth={1.8}
                  />
                  <span style={{ fontSize: 25, fontWeight: 800, lineHeight: 1.2 }}>
                    {story.title}
                  </span>
                </div>
              ))}
            </section>
            <section style={{ display: "grid", gap: 14 }}>
              <h2
                style={{
                  fontFamily: theme.font.heading,
                  fontSize: 42,
                  fontWeight: 400,
                  lineHeight: 1.08,
                  margin: 0,
                }}
              >
                Technical checklist
              </h2>
              {["Platform tradeoffs", "Reliability plan", "Automation examples"].map(
                (item, index) => (
                  <div
                    key={item}
                    style={{
                      ...stagger(frame, index + 2, fps),
                      alignItems: "center",
                      border: `1px solid ${theme.color.border}`,
                      display: "flex",
                      fontSize: 25,
                      fontWeight: 750,
                      gap: 12,
                      padding: "18px 20px",
                    }}
                  >
                    <CheckSquare color={theme.color.accent} size={28} />
                    {item}
                  </div>
                ),
              )}
            </section>
          </div>
        </div>
      </AppFrame>
      <CaptionBar text={captions.interviewPrep} />
    </AbsoluteFill>
  );
};
