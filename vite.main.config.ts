import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@main': path.resolve(__dirname, './src/main'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  build: {
    target: 'node18',
    outDir: 'dist/main',
    emptyOutDir: true,
    ssr: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/main/index.ts'),
      external: ['electron', 'better-sqlite3', 'vectra'],
      output: {
        format: 'esm',
        entryFileNames: 'index.js',
      },
    },
  },
})
