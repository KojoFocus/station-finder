import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f7ee",
          100: "#d4e8cc",
          200: "#7da87b",
          300: "#4a7c59",
          400: "#3d6649",
          500: "#2e4f38",
          600: "#1e3326",
          700: "#1a2416",
          800: "#141f12",
          900: "#0d1a0b",
        },
      },
      // Lets us use h-dvh via Tailwind
      height: {
        dvh: "100dvh",
      },
      minHeight: {
        dvh: "100dvh",
      },
    },
  },
  plugins: [],
};

export default config;
