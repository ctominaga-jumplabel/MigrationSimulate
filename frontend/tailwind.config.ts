import type { Config } from "tailwindcss";

/**
 * Design tokens — Cogna Migration Mission Control.
 * Tema dark premium. Acento Cogna (laranja/coral) + superfícies near-black.
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
        // Fundo e superfícies (near-black em camadas).
        base: {
          DEFAULT: "#07080c",
          900: "#0a0c12",
          800: "#0f121a",
          700: "#161a24",
          600: "#1e2330",
        },
        // Acento Cogna.
        accent: {
          DEFAULT: "#ff6a3d",
          soft: "#ff8a63",
          deep: "#e2531f",
        },
        // Acento secundário (azul elétrico — Databricks/tech).
        electric: {
          DEFAULT: "#4d8dff",
          soft: "#7aa9ff",
        },
        success: "#36d399",
        warn: "#fbbf24",
        danger: "#f87272",
        // Texto.
        ink: {
          DEFAULT: "#eef1f8",
          muted: "#9aa3b8",
          faint: "#5e6680",
        },
        line: "rgba(255,255,255,0.08)",
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
        glass: "0 8px 40px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
        glow: "0 0 0 1px rgba(255,106,61,0.25), 0 8px 30px -8px rgba(255,106,61,0.35)",
        card: "0 1px 0 rgba(255,255,255,0.04), 0 12px 40px -16px rgba(0,0,0,0.7)",
      },
      backgroundImage: {
        "grad-base":
          "radial-gradient(1200px 600px at 15% -10%, rgba(77,141,255,0.10), transparent 60%), radial-gradient(1000px 500px at 100% 0%, rgba(255,106,61,0.10), transparent 55%)",
        "grad-accent": "linear-gradient(135deg, #ff6a3d 0%, #e2531f 100%)",
        "grad-electric": "linear-gradient(135deg, #4d8dff 0%, #2f6bdb 100%)",
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
