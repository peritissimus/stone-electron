import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@main': path.resolve(__dirname, './src/main'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
    conditions: ['node'],
  },
  build: {
    target: 'node18',
    outDir: 'dist/main',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/main/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.cjs',
    },
    rollupOptions: {
      external: [
        'electron',
        '@libsql/client',
        '@libsql/client/sqlite3',
        'vectra',
        'electron-store',
        'electron-log',
        'nanoid',
        'path',
        'fs',
        'fs/promises',
        'crypto',
        'os',
        'node:path',
        'node:fs',
        'node:fs/promises',
        'node:crypto',
        'node:os',
      ],
    },
  },
});
