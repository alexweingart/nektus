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
          light: '#004D40',
          DEFAULT: '#ffffff',
          dark: '#f5f5f5',
        },
      },
      backgroundColor: {
        background: "#004D40",
      },
      gradientColorStops: {
        'theme-start': '#004D40',
        'theme-end': '#004D40',
        'nekt-light': '#E7FED2', // From logo - pale cream/green
        'nekt-dark': '#71E454',  // From logo - bright lime green
      },
      backgroundImage: {
        'nekt-gradient': 'linear-gradient(135deg, #E7FED2, #71E454)',
      },
    },
  },
  plugins: [],
} satisfies Config;
