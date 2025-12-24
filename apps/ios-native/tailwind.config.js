/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}", "./index.ts"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Match web app colors
        background: "#004D40",
        foreground: "#ffffff",
        theme: {
          light: "#004D40",
          DEFAULT: "#ffffff",
          dark: "#f5f5f5",
        },
        // Nekt brand colors from web
        "nekt-light": "#E7FED2", // Pale cream/green
        "nekt-dark": "#71E454", // Bright lime green
        "nekt-green": "#4ade80", // Button green
      },
    },
  },
  plugins: [],
};
