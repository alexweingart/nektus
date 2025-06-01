import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundColor: {
        background: "#004D40",
      },
      colors: {
        background: "#004D40",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
} satisfies Config;
