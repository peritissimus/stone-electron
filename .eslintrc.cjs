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
    // Base UI: primitives cannot depend on higher-level composites or features.
    {
      files: ['src/renderer/components/base/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer/components/composites/*',
                  '@renderer/components/features/*',
                  '@renderer/stores/*',
                  '@renderer/api/*',
                  '@renderer/hooks/*',
                ],
                message:
                  'base/ primitives must stay leaf-level. Only import from other base primitives or lib utilities.',
              },
            ],
          },
        ],
      },
    },
    // Hooks: combine stores + api + lifecycle. Cannot reach into components or pages.
    {
      files: ['src/renderer/hooks/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@renderer/components/*', '@renderer/pages/*'],
                message:
                  'Hooks must not depend on components or pages. Dependency direction is components → hooks, not the reverse.',
              },
            ],
          },
        ],
      },
    },
    // Pages: route-level. Same rules as features — no sibling pages, no direct stores/api.
    {
      files: ['src/renderer/pages/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@renderer/stores/*', '@renderer/api/*'],
                message:
                  'Pages must not import stores or API directly. Use a hook from @renderer/hooks.',
              },
            ],
          },
        ],
      },
    },
    // Lib: leaf utilities. No renderer runtime dependencies.
    {
      files: ['src/renderer/lib/**/*.{ts,tsx}'],
      excludedFiles: ['src/renderer/lib/extensions/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer/components/*',
                  '@renderer/hooks/*',
                  '@renderer/stores/*',
                  '@renderer/api/*',
                  '@renderer/pages/*',
                ],
                message:
                  'lib/ utilities must stay leaf-level. Only import from other lib utilities, specs, or external packages.',
              },
            ],
          },
        ],
      },
    },
    // TipTap extensions: known exception. Extensions wrap React components as node views.
    // TODO: move to components/features/Editor/extensions/ to eliminate this exception.
    {
      files: ['src/renderer/lib/extensions/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@renderer/stores/*', '@renderer/api/*', '@renderer/hooks/*'],
                message:
                  'Extensions may import components for node views, but not stores, api, or hooks directly.',
              },
            ],
          },
        ],
      },
    },
    // ======================================================================
    // BACKEND (main process) — Hexagonal architecture boundaries
    // Dependency rule: domain ← application ← adapters ← infrastructure
    // ======================================================================
    // Domain: pure. No other layer may be imported. No npm packages that carry I/O.
    {
      files: ['src/main/domain/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '../application/*',
                  '../../application/*',
                  '../../../application/*',
                  '../adapters/*',
                  '../../adapters/*',
                  '../../../adapters/*',
                  '../infrastructure/*',
                  '../../infrastructure/*',
                  '../../../infrastructure/*',
                  '../shared/*',
                  '../../shared/*',
                  '../../../shared/*',
                  '@main/application/*',
                  '@main/adapters/*',
                  '@main/infrastructure/*',
                  '@main/shared/*',
                  '@application/*',
                  '@adapters/*',
                  '@infrastructure/*',
                ],
                message:
                  'Domain must stay pure. It cannot import from application, adapters, infrastructure, or shared.',
              },
            ],
          },
        ],
      },
    },
    // Application: may import domain only.
    {
      files: ['src/main/application/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '../adapters/*',
                  '../../adapters/*',
                  '../../../adapters/*',
                  '../infrastructure/*',
                  '../../infrastructure/*',
                  '../../../infrastructure/*',
                  '@main/adapters/*',
                  '@main/infrastructure/*',
                  '@adapters/*',
                  '@infrastructure/*',
                ],
                message:
                  'Application layer must not import from adapters or infrastructure. Use ports (domain/ports/) instead.',
              },
            ],
          },
        ],
      },
    },
    // Adapters: may import domain + application. Must not reach into infrastructure.
    {
      files: ['src/main/adapters/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '../infrastructure/di/*',
                  '../../infrastructure/di/*',
                  '../../../infrastructure/di/*',
                  '@main/infrastructure/di/*',
                  '@infrastructure/di/*',
                ],
                message:
                  'Adapters must not import from infrastructure/di. Wire concrete instances there instead of importing them outward.',
              },
            ],
          },
        ],
      },
    },
    // Shared: neutral zone. Must not depend on any main-process layer.
    {
      files: ['src/main/shared/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '../domain/*',
                  '../../domain/*',
                  '../application/*',
                  '../../application/*',
                  '../adapters/*',
                  '../../adapters/*',
                  '../infrastructure/*',
                  '../../infrastructure/*',
                  '@main/domain/*',
                  '@main/application/*',
                  '@main/adapters/*',
                  '@main/infrastructure/*',
                  '@domain/*',
                  '@application/*',
                  '@adapters/*',
                  '@infrastructure/*',
                ],
                message:
                  'Shared must stay neutral. It cannot depend on domain, application, adapters, or infrastructure.',
              },
            ],
          },
        ],
      },
    },
  ],
};
