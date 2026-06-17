import type { Config } from "tailwindcss";

/**
 * Design tokens — Cogna Migration Mission Control.
 * Tema claro (alinhado à identidade Cogna). Acento roxo Cogna (#8629FF)
 * sobre superfícies brancas/claras.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fundo e superfícies (claras em camadas). Página levemente cinza,
        // cards/navs em branco para "subirem" sobre o fundo.
        base: {
          DEFAULT: "#e9ebf3", // fundo da página
          900: "#f6f7fb", // superfícies frosted (nav/topbar) e insets claros
          800: "#ffffff", // cards/dropdowns sólidos
          700: "#ffffff",
          600: "#eef0f7",
        },
        // Acento Cogna (roxo).
        accent: {
          DEFAULT: "#8629ff",
          soft: "#7b22e6", // tom legível como texto sobre fundo claro
          deep: "#5e15b5",
        },
        // Acento secundário (azul — Databricks/tech).
        electric: {
          DEFAULT: "#3366ff",
          soft: "#2456d6",
        },
        success: "#15a06b",
        warn: "#c77d0a",
        danger: "#dc2626",
        // Texto (escuro com leve viés roxo). Hierarquia: DEFAULT (títulos) >
        // soft (descrições/corpo legível) > muted (legendas) > faint (mais sutil).
        ink: {
          DEFAULT: "#1a1430",
          soft: "#3c3651",
          muted: "#5b556e",
          faint: "#928da3",
        },
        line: "rgba(26,20,48,0.10)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        glass:
          "0 8px 30px -12px rgba(26,20,48,0.14), 0 2px 8px -4px rgba(26,20,48,0.08)",
        glow: "0 0 0 1px rgba(134,41,255,0.20), 0 8px 30px -8px rgba(134,41,255,0.30)",
        card: "0 1px 2px rgba(26,20,48,0.05), 0 12px 30px -16px rgba(26,20,48,0.16)",
      },
      backgroundImage: {
        "grad-base":
          "radial-gradient(1200px 600px at 15% -10%, rgba(134,41,255,0.10), transparent 60%), radial-gradient(1000px 500px at 100% 0%, rgba(51,102,255,0.08), transparent 55%)",
        "grad-accent": "linear-gradient(135deg, #8629ff 0%, #5e15b5 100%)",
        "grad-electric": "linear-gradient(135deg, #3366ff 0%, #2456d6 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
