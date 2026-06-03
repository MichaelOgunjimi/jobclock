import type { ReactNode } from "react";
import { theme } from "../theme";

type Tab = {
  value: string;
  label: string;
  icon?: ReactNode;
};

type TabsProps = {
  tabs: Tab[];
  active: string;
};

export const Tabs = ({ tabs, active }: TabsProps) => {
  return (
    <div
      style={{
        borderBottom: `1px solid ${theme.color.border}`,
        display: "flex",
        gap: 4,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active || tab.label === active;

        return (
          <div
            key={tab.value}
            style={{
              alignItems: "center",
              borderBottom: `3px solid ${
                isActive ? theme.color.foreground : "transparent"
              }`,
              color: isActive
                ? theme.color.foreground
                : theme.color.mutedForeground,
              display: "flex",
              fontSize: 14,
              fontWeight: 650,
              gap: 7,
              marginBottom: -1,
              padding: "12px 10px",
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </div>
        );
      })}
    </div>
  );
};
