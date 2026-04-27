export const navigationItems = [
  {
    href: "/overview",
    label: "Overview",
    description: "Dashboard and system status",
    icon: "overview",
    step: null
  },
  {
    href: "/snapshots",
    label: "Snapshots",
    description: "Uploaded business data",
    icon: "database",
    step: 1
  },
  {
    href: "/scenarios",
    label: "Scenarios",
    description: "Policy configurations",
    icon: "sliders",
    step: 2
  },
  {
    href: "/results",
    label: "Result Ref",
    description: "Saved run references",
    icon: "results",
    step: 3
  },
  {
    href: "/compare",
    label: "Compare",
    description: "Side-by-side results",
    icon: "columns",
    step: 4
  }
] as const;
