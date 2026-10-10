import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import typescript from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import prettier from 'eslint-config-prettier/flat';

// Keep the renderer and hexagonal import boundaries when migrating to flat config.
const architectureBoundaries = [
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
              message: 'Service views must not import models or API directly. Use a focused hook.',
            },
          ],
        },
      ],
    },
  },
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
  {
    files: ['src/main/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'effect',
              importNames: [
                'Layer',
                'Schedule',
                'Semaphore',
                'Queue',
                'Ref',
                'Fiber',
                'Clock',
                'Runtime',
                'ManagedRuntime',
              ],
              message:
                'Domain may use only Effect data vocabulary. Execution, concurrency, time, and wiring belong outside domain.',
            },
          ],
          patterns: [
            {
              group: ['effect/*', '@effect/*'],
              message:
                'Domain imports Effect only from the bare `effect` package; deep and scoped imports are forbidden.',
            },
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
];

export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'test-results/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { '@typescript-eslint': typescript },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  ...architectureBoundaries,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  prettier,
];
