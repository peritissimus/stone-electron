import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'bundle-stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // treemap, sunburst, or network
    }),
  ],
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
          // UI libraries
          'icons': ['phosphor-react', 'lucide-react'],
          'radix-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-toggle',
            '@radix-ui/react-slot',
          ],
          // State management
          'zustand': ['zustand'],
        },
      },
    },
  },
})
