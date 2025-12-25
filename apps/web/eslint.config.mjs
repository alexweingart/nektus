import nextPlugin from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  // Base config - ignore files
  {
    ignores: [
      '**/*.d.ts',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/.next/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/public/**',
    ],
  },

  // TypeScript and React files
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      '@next/next': nextPlugin,
      '@typescript-eslint': tseslint,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // Next.js rules
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // Custom TypeScript rules
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',

      // React rules
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/react-in-jsx-scope': 'off', // Not needed in Next.js
    },
  },

  // Overrides for specific files
  {
    files: ['**/app/privacy/page.tsx', '**/app/terms/page.tsx'],
    rules: {
      'react/no-unescaped-entities': 'off',
    },
  },

  {
    files: ['**/app/api/**/route.ts', '**/app/api/**/route.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_|^request$',
      }],
    },
  },
];
