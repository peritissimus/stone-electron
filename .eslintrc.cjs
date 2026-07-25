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
    // TypeScript's own resolver handles undefined identifiers far better than
    // ESLint's no-undef, which false-positives on ambient types (NodeJS,
    // Electron, the React namespace, DOM lib types like MediaRecorderOptions).
    // Disabling it is the typescript-eslint-recommended posture.
    'no-undef': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-types': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
  ignorePatterns: ['dist', 'node_modules'],
  overrides: [
    // Hooks are renderer orchestration boundaries. They may read models and
    // command/service hooks may call API, but hooks never depend outward on UI
    // leaves or the workbench shell.
    {
      files: ['src/renderer/**/hooks/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer/**/views',
                  '@renderer/**/views/*',
                  '@renderer/components',
                  '@renderer/components/*',
                  '@renderer/workbench',
                  '@renderer/workbench/*',
                ],
                message: 'Hooks must not depend on views, components, or the workbench shell.',
              },
            ],
          },
        ],
      },
    },
    // Feature views are renderer leaves: data and mutations arrive through hooks/commands.
    {
      files: ['src/renderer/features/*/views/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer/api',
                  '@renderer/api/*',
                  '@renderer/**/model',
                  '@renderer/**/model/*',
                ],
                message:
                  'Feature views must use focused hooks or commands, not API or models directly.',
              },
            ],
          },
        ],
      },
    },
    // Models own serializable application state and remain independent of React and UI code.
    {
      files: [
        'src/renderer/features/*/model/**/*.{ts,tsx}',
        'src/renderer/services/*/model/**/*.{ts,tsx}',
      ],
      rules: {
        'no-restricted-imports': 'off',
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react',
                message: 'Models must remain free of the React runtime.',
                allowTypeImports: true,
              },
            ],
            patterns: [
              {
                group: [
                  '@renderer/**/hooks',
                  '@renderer/**/hooks/*',
                  '@renderer/**/views',
                  '@renderer/**/views/*',
                  '@renderer/workbench',
                  '@renderer/workbench/*',
                  '@renderer/components',
                  '@renderer/components/*',
                ],
                message: 'Models must not depend on hooks, views, workbench, or components.',
              },
            ],
          },
        ],
      },
    },
    // The persistent shell coordinates feature views through hooks and view contracts only.
    {
      files: ['src/renderer/workbench/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer/api',
                  '@renderer/api/*',
                  '@renderer/**/model',
                  '@renderer/**/model/*',
                ],
                message: 'Workbench code must not import API or feature/service models directly.',
              },
            ],
          },
        ],
      },
    },
    // Shared components are renderer leaves. State and IPC arrive through focused hooks.
    {
      files: ['src/renderer/components/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer/api',
                  '@renderer/api/*',
                  '@renderer/**/model',
                  '@renderer/**/model/*',
                ],
                message:
                  'Shared components must not import models or API directly. Use a focused hook.',
              },
            ],
          },
        ],
      },
    },
    // Model contracts also cover nested model folders not matched by the feature override above.
    {
      files: ['src/renderer/**/model/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': 'off',
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react',
                message: 'Models must stay React-free. Move React lifecycle state into a hook.',
                allowTypeImports: true,
              },
            ],
            patterns: [
              {
                group: [
                  '@renderer/**/hooks',
                  '@renderer/**/hooks/*',
                  '@renderer/**/views',
                  '@renderer/**/views/*',
                  '@renderer/workbench',
                  '@renderer/workbench/*',
                  '@renderer/components',
                  '@renderer/components/*',
                ],
                message: 'Models must not depend on hooks, views, the workbench, or components.',
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
                  '@renderer/api',
                  '@renderer/api/*',
                  '@renderer/features',
                  '@renderer/features/*',
                  '@renderer/services',
                  '@renderer/services/*',
                  '@renderer/workbench',
                  '@renderer/workbench/*',
                  '@renderer/components',
                  '@renderer/components/*',
                  '@renderer/lib',
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
                  '@renderer/features',
                  '@renderer/features/*',
                  '@renderer/services',
                  '@renderer/services/*',
                  '@renderer/workbench',
                  '@renderer/workbench/*',
                  '@renderer/components',
                  '@renderer/components/*',
                ],
                message: 'API modules must only depend on shared contracts and IPC utilities.',
              },
            ],
          },
        ],
      },
    },
    // Service-owned views follow the same rendering boundary as feature views.
    {
      files: ['src/renderer/services/*/views/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer/api',
                  '@renderer/api/*',
                  '@renderer/**/model',
                  '@renderer/**/model/*',
                ],
                message:
                  'Service views must not import models or API directly. Use a focused hook.',
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
                  '@renderer/components/composites',
                  '@renderer/components/composites/*',
                  '@renderer/features',
                  '@renderer/features/*',
                  '@renderer/services',
                  '@renderer/services/*',
                  '@renderer/workbench',
                  '@renderer/workbench/*',
                  '@renderer/api',
                  '@renderer/api/*',
                ],
                message:
                  'base/ primitives must stay leaf-level. Only import from other base primitives or lib utilities.',
              },
            ],
          },
        ],
      },
    },
    // Hooks and commands integrate models/API with React, but never reach into UI surfaces.
    {
      files: [
        'src/renderer/features/*/{hooks,commands}/**/*.{ts,tsx}',
        'src/renderer/services/*/{hooks,commands}/**/*.{ts,tsx}',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer/components',
                  '@renderer/components/*',
                  '@renderer/workbench',
                  '@renderer/workbench/*',
                  '@renderer/**/views',
                  '@renderer/**/views/*',
                ],
                message: 'Hooks and commands must not depend on components, views, or workbench.',
              },
            ],
          },
        ],
      },
    },
    // The workbench editor group is a composition root, not a data-access layer.
    {
      files: ['src/renderer/workbench/editor-group/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer/api',
                  '@renderer/api/*',
                  '@renderer/**/model',
                  '@renderer/**/model/*',
                ],
                message: 'Workbench composition must not import models or API directly.',
              },
            ],
          },
        ],
      },
    },
    // Lib: leaf utilities. No renderer runtime dependencies.
    {
      files: ['src/renderer/lib/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer/components',
                  '@renderer/components/*',
                  '@renderer/api',
                  '@renderer/api/*',
                  '@renderer/workbench',
                  '@renderer/workbench/*',
                ],
                message: 'lib/ utilities must stay independent of API, workbench, and rendered UI.',
              },
            ],
          },
        ],
      },
    },
    // TipTap extensions may wrap React node views, but cannot own application state or IPC.
    {
      files: ['src/renderer/features/notes/editor/extensions/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer/**/model',
                  '@renderer/**/model/*',
                  '@renderer/api',
                  '@renderer/api/*',
                  '@renderer/**/hooks',
                  '@renderer/**/hooks/*',
                ],
                message:
                  'Extensions may import node-view components, but not models, API, or hooks directly.',
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
