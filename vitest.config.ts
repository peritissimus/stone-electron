import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/renderer/**/*',
        'src/preload.ts',
        // Electron entry points - require full runtime, not unit testable
        'src/main/index.ts',
        'src/main/ipc/index.ts',
        // Type definitions - no runtime code to test
        'src/shared/types/**/*',
        // Declarative schema definitions - no logic to test
        'src/main/database/schema.ts',
        // Logger initialization - runs at module load, depends on Electron
        'src/main/utils/logger.ts',
        // Repository index - just singleton factory, tested via other repo tests
        'src/main/repositories/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@main': path.resolve(__dirname, './src/main'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
    },
  },
})
