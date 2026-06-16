// Definição da navegação (8 áreas do plano §4).
export interface NavItem {
  href: string;
  label: string;
  icon: string; // nome do ícone iconsax
  group: "principal" | "migrate" | "planejamento" | "saída";
}

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: "Chart2", group: "principal" },
  { href: "/scenario", label: "Scenario Builder", icon: "Setting4", group: "principal" },
  { href: "/migrate", label: "Tempo de Desenvolvimento", icon: "MagicStar", group: "migrate" },
  { href: "/migrate/config", label: "Calibrar Migrate", icon: "Setting2", group: "migrate" },
  { href: "/pipelines", label: "Pipelines", icon: "Hierarchy", group: "planejamento" },
  { href: "/orphans", label: "SAS Órfãos", icon: "DocumentText", group: "planejamento" },
  { href: "/sprints", label: "Sprint Planner", icon: "Calendar", group: "planejamento" },
  { href: "/timeline", label: "Timeline", icon: "Clock", group: "planejamento" },
  { href: "/analytics", label: "Analytics", icon: "ChartSquare", group: "planejamento" },
  { href: "/export", label: "Export", icon: "ExportSquare", group: "saída" },
];
