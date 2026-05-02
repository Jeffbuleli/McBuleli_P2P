import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effdf7",
          100: "#cffae9",
          200: "#9ef4d4",
          300: "#5ee9bc",
          400: "#26d19f",
          500: "#10b589",
          600: "#069170",
          700: "#06735d",
          800: "#085c4c",
          900: "#084b40",
          950: "#032b26",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
