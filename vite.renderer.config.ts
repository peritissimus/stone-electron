import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for Electron
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    middlewareMode: true,
    hmr: {
      host: 'localhost',
      port: 5173,
    },
  },
  build: {
    target: 'ES2020',
    outDir: 'dist/renderer',
    emptyOutDir: true,
    sourcemap: false, // Disable sourcemaps for smaller bundle
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Better code splitting for lazy loading
        manualChunks: {
          // Core React
          'react-vendor': ['react', 'react-dom'],
          // Editor core
          'tiptap-core': ['@tiptap/core', '@tiptap/react', '@tiptap/starter-kit'],
          // Heavy features - loaded on demand
          'mermaid': ['mermaid'],
          'highlight': ['highlight.js'],
        },
      },
    },
  },
})
