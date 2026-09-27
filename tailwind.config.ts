import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep forest green — academic, editorial, grounded
        brand: {
          50:  "#f2f5f0",
          100: "#e0e8db",
          200: "#c3d1b9",
          300: "#9fb68e",
          400: "#7a9a66",
          500: "#5c7d4a",
          600: "#476338",
          700: "#384e2e",
          800: "#2d3e25",
          900: "#1e2b1a",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-libre)", "Georgia", "Cambria", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
