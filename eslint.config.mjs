import { FlatCompat } from '@eslint/eslintrc';

// Setup FlatCompat for Next.js compatibility
const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default [
  // Base config
  {
    ignores: ['**/*.d.ts', '**/*.config.js', '**/*.config.mjs', '**/.next/**', '**/node_modules/**', '**/dist/**', '**/out/**'],
  },
  
  // Use Next.js recommended config via FlatCompat
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript'],
  }),
  
  // Custom rule overrides
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
  
  // Overrides for specific files
  {
    files: ['**/app/privacy/page.tsx', '**/app/terms/page.tsx'],
    rules: {
      'react/no-unescaped-entities': 'off', // Legal text should be readable in source
    },
  },
  
  {
    files: ['**/app/api/**/route.ts', '**/app/api/**/route.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_|^request$', // Allow unused 'request' param in API routes
      }],
    },
  },
];
