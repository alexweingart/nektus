import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: ["@typescript-eslint", "react-hooks"],
    extends: [
      "plugin:@typescript-eslint/recommended",
      "plugin:react-hooks/recommended"
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/exhaustive-deps": "warn"
    }
  },
  {
    files: ["**/*.tsx"],
    rules: {
      "react/no-unescaped-entities": "warn",
      "@next/next/no-img-element": "warn"
    }
  }
];

export default eslintConfig;
