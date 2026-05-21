import type { ReactNode } from "react";
import {
  BarChart2,
  BookOpen,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Search,
  Send,
  Settings,
} from "lucide-react";
import { theme } from "../theme";

type AppFrameProps = {
  active?: string;
  title: string;
  kicker?: string;
  children: ReactNode;
};

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Job Search", icon: Search },
  { label: "Applications", icon: Send },
  { label: "Interview Prep", icon: BookOpen },
  { label: "Analytics", icon: BarChart2 },
  { label: "My CV", icon: FileText },
  { label: "Settings", icon: Settings },
];

export const AppFrame = ({
  active = "Dashboard",
  title,
  kicker = "Workspace",
  children,
}: AppFrameProps) => {
  return (
    <div
      style={{
        backgroundColor: theme.color.background,
        boxShadow: theme.shadow,
        color: theme.color.foreground,
        display: "grid",
        fontFamily: theme.font.sans,
        gridTemplateColumns: "288px 1fr",
        height: 900,
        overflow: "hidden",
        width: 1600,
      }}
    >
      <aside
        style={{
          backgroundColor: theme.color.sidebar,
          borderRight: `1px solid ${theme.color.sidebarBorder}`,
          color: "rgba(255,255,255,0.52)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            alignItems: "center",
            borderBottom: `1px solid ${theme.color.sidebarBorder}`,
            display: "flex",
            gap: 14,
            height: 74,
            padding: "0 22px",
          }}
        >
          <div
            style={{
              alignItems: "center",
              backgroundColor: theme.color.sidebarPrimary,
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              height: 42,
              justifyContent: "center",
              width: 42,
            }}
          >
            <LockKeyhole color={theme.color.white} size={20} strokeWidth={1.8} />
          </div>
          <div>
            <div
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1.8,
                textTransform: "uppercase",
              }}
            >
              Job Assistant
            </div>
            <div
              style={{
                color: theme.color.white,
                fontFamily: theme.font.heading,
                fontSize: 28,
                lineHeight: 1,
                marginTop: 4,
              }}
            >
              Workspace
            </div>
          </div>
        </div>

        <nav
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            gap: 10,
            padding: "28px 16px",
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.label === active;

            return (
              <div
                key={item.label}
                style={{
                  alignItems: "center",
                  backgroundColor: isActive
                    ? theme.color.sidebarPrimary
                    : "transparent",
                  border: `1px solid ${
                    isActive ? "rgba(255,255,255,0.1)" : "transparent"
                  }`,
                  color: isActive ? theme.color.white : "rgba(255,255,255,0.54)",
                  display: "flex",
                  fontSize: 14,
                  fontWeight: 650,
                  gap: 13,
                  letterSpacing: 0.3,
                  padding: "15px 16px",
                }}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </nav>
      </aside>

      <main
        style={{
          backgroundColor: theme.color.secondary,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <header
          style={{
            alignItems: "center",
            backgroundColor: theme.color.background,
            borderBottom: `1px solid ${theme.color.border}`,
            display: "flex",
            minHeight: 94,
            padding: "0 48px",
          }}
        >
          <div>
            <div
              style={{
                color: theme.color.mutedForeground,
                fontSize: 13,
                fontWeight: 750,
                letterSpacing: 1.7,
                textTransform: "uppercase",
              }}
            >
              {kicker}
            </div>
            <h1
              style={{
                color: theme.color.foreground,
                fontFamily: theme.font.heading,
                fontSize: 38,
                fontWeight: 400,
                lineHeight: 1.08,
                margin: "7px 0 0",
              }}
            >
              {title}
            </h1>
          </div>
        </header>
        <section
          style={{
            flex: 1,
            minHeight: 0,
            padding: 44,
          }}
        >
          {children}
        </section>
      </main>
    </div>
  );
};
