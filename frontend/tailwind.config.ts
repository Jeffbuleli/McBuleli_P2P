import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        card: "0 4px 24px -6px rgba(0, 0, 0, 0.35)",
        "card-lg": "0 12px 40px -12px rgba(0, 0, 0, 0.45)",
        glow: "0 0 40px -8px rgba(16, 185, 129, 0.35)",
      },
      colors: {
        /** Bleu profond — confiance (fintech / Binance-like headers) */
        primary: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#b9defe",
          300: "#7cc4fd",
          400: "#36a7fa",
          500: "#0c8ee7",
          600: "#0070d1",
          700: "#0059ab",
          800: "#054a8c",
          900: "#0a2744",
          950: "#051a2e",
        },
        /**
         * Aligné sur « McBuleli APP » / app.mcbuleli.live (Design System v2 — theme.css).
         * Primaire emerald #10b981 · secondaire marron #5d4037 · surfaces sombres neutres.
         */
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        earth: {
          50: "#faf8f6",
          100: "#efe8e4",
          200: "#dccdc8",
          300: "#c4b5af",
          400: "#a08981",
          500: "#795548",
          600: "#5d4037",
          700: "#4e342e",
          800: "#3e342e",
          900: "#2d2624",
          950: "#151210",
        },
        /** Fonds — même grille que --color-bg-* dans McBuleli APP */
        surface: {
          DEFAULT: "#0d0d0f",
          secondary: "#1a1a1d",
          tertiary: "#242427",
          elevated: "#2d2d31",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Inter",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        ticker: "ticker 32s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
