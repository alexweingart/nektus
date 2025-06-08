import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#004D40",
        foreground: "var(--foreground)",
        theme: {
          light: '#E7FED2',
          DEFAULT: '#ffffff',
          dark: '#f5f5f5',
        },
      },
      backgroundColor: {
        background: "#004D40",
      },
      gradientColorStops: {
        'theme-start': '#E7FED2',
        'theme-end': '#71E454',
      },
    },
  },
  plugins: [],
} satisfies Config;
