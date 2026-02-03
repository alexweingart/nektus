import type { Config } from "tailwindcss";

// Inline color constants (from src/shared/colors.ts) for Tailwind config
// Tailwind config files are processed separately and can't import TypeScript modules
const TEXT_BLACK = '#004D40';
const BRAND_LIGHT_GREEN = '#E7FED2';
const BRAND_DARK_GREEN = '#71E454';

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: TEXT_BLACK,
        foreground: "var(--foreground)",
        theme: {
          light: TEXT_BLACK,
          DEFAULT: '#ffffff',
          dark: '#f5f5f5',
        },
      },
      backgroundColor: {
        background: TEXT_BLACK,
      },
      gradientColorStops: {
        'nekt-light': BRAND_LIGHT_GREEN,
        'nekt-dark': BRAND_DARK_GREEN,
      },
      backgroundImage: {
        'nekt-gradient': `linear-gradient(135deg, ${BRAND_LIGHT_GREEN}, ${BRAND_DARK_GREEN})`,
      },
      padding: {
        'safe': 'env(safe-area-inset-bottom)',
      },
      margin: {
        'safe': 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
} satisfies Config;
