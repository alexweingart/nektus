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
        // Define colors directly in the Tailwind config
        background: "#118541", // Green background
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
} satisfies Config;
