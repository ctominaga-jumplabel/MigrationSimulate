// Tema compartilhado dos gráficos (recharts). Alinhado ao tema claro Cogna.
export const CHART = {
  accent: "#8629ff",
  accentSoft: "#a45cff",
  electric: "#3366ff",
  electricSoft: "#6f93ff",
  success: "#15a06b",
  grid: "rgba(26,20,48,0.08)",
  axis: "#928da3",
  text: "#5b556e",
};

// Cor por categoria de complexidade (coerente com Badge.categoriaTone).
export const CATEGORIA_COLOR: Record<string, string> = {
  Trivial: "#928da3",
  Simples: "#3366ff",
  Médio: "#c77d0a",
  Complexo: "#8629ff",
  "Muito Complexo": "#dc2626",
};

export const tooltipStyle = {
  background: "rgba(255,255,255,0.97)",
  border: "1px solid rgba(26,20,48,0.10)",
  borderRadius: 12,
  color: "#1a1430",
  fontSize: 12,
  boxShadow: "0 8px 30px -12px rgba(26,20,48,0.25)",
};
