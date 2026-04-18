module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-types': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
  ignorePatterns: ['dist', 'node_modules'],
  overrides: [
    // Components: cannot import stores or api directly. Must go through hooks.
    {
      files: ['src/renderer/components/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@renderer/stores/*', '@renderer/api/*'],
                message:
                  'Components must not import stores or API directly. Use a hook from @renderer/hooks.',
              },
            ],
          },
        ],
      },
    },
    // Stores: must stay framework-agnostic. No React runtime, no hooks, no components.
    // Type-only react imports are allowed for UI contract types like ReactNode.
    {
      files: ['src/renderer/stores/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': 'off',
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react',
                message: 'Stores must stay React-free. Move React state into a hook.',
                allowTypeImports: true,
              },
            ],
            patterns: [
              {
                group: ['@renderer/hooks/*', '@renderer/components/*'],
                message: 'Stores must not depend on hooks or components.',
              },
            ],
          },
        ],
      },
    },
    // Specs: zero-runtime contracts. Type-only world.
    {
      files: ['src/renderer/specs/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer/api/*',
                  '@renderer/stores/*',
                  '@renderer/hooks/*',
                  '@renderer/components/*',
                  '@renderer/pages/*',
                  '@renderer/lib/*',
                ],
                message:
                  'Specs are zero-runtime contracts. Only import from other specs or shared types.',
              },
            ],
          },
        ],
      },
    },
    // API layer: thin IPC wrappers. No state, no hooks, no components.
    {
      files: ['src/renderer/api/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react',
                message: 'API modules must stay React-free.',
              },
            ],
            patterns: [
              {
                group: [
                  '@renderer/stores/*',
                  '@renderer/hooks/*',
                  '@renderer/components/*',
                  '@renderer/pages/*',
                ],
                message: 'API modules must only depend on specs and lib utilities.',
              },
            ],
          },
        ],
      },
    },
    // Features: must be leaves. No imports from sibling features.
    {
      files: ['src/renderer/components/features/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@renderer/stores/*', '@renderer/api/*'],
                message:
                  'Components must not import stores or API directly. Use a hook from @renderer/hooks.',
              },
              {
                group: ['@renderer/components/features/*'],
                message:
                  'features/ are leaves — no sibling-feature imports. Promote shared pieces to composites/.',
              },
            ],
          },
        ],
      },
    },
  ],
};
