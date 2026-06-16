// Tema compartilhado dos gráficos (recharts).
export const CHART = {
  accent: "#ff6a3d",
  accentSoft: "#ff8a63",
  electric: "#4d8dff",
  electricSoft: "#7aa9ff",
  grid: "rgba(255,255,255,0.06)",
  axis: "#5e6680",
  text: "#9aa3b8",
};

// Cor por categoria de complexidade (coerente com Badge.categoriaTone).
export const CATEGORIA_COLOR: Record<string, string> = {
  Trivial: "#5e6680",
  Simples: "#4d8dff",
  Médio: "#fbbf24",
  Complexo: "#ff6a3d",
  "Muito Complexo": "#f87272",
};

export const tooltipStyle = {
  background: "rgba(15,18,26,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#eef1f8",
  fontSize: 12,
};
