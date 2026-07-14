import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

const rendererChunks: Array<[string, string[]]> = [
  ['react-vendor', ['react', 'react-dom']],
  ['tiptap-core', ['@tiptap/core', '@tiptap/react', '@tiptap/starter-kit']],
  ['mermaid', ['mermaid']],
  ['highlight', ['highlight.js']],
  ['icons', ['@phosphor-icons/react', 'lucide-react']],
  [
    'radix-ui',
    [
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-toggle',
      '@radix-ui/react-slot',
    ],
  ],
  ['zustand', ['zustand']],
]

function rendererManualChunks(id: string): string | undefined {
  const normalizedId = id.replaceAll('\\', '/')

  for (const [chunkName, packages] of rendererChunks) {
    if (packages.some((packageName) => normalizedId.includes(`/node_modules/${packageName}/`))) {
      return chunkName
    }
  }

  return undefined
}

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
  // Optimize dev server startup by pre-bundling dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      '@tiptap/core',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/extension-placeholder',
      '@tiptap/extension-link',
      '@tiptap/extension-image',
      '@tiptap/extension-highlight',
      '@tiptap/extension-code-block-lowlight',
      '@tiptap/extension-task-list',
      '@tiptap/extension-task-item',
      '@tiptap/extension-table',
      '@tiptap/extension-table-row',
      '@tiptap/extension-table-header',
      '@tiptap/extension-table-cell',
      '@tiptap/suggestion',
      '@tiptap/pm/state',
      'lowlight',
      '@phosphor-icons/react',
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-toggle',
      '@radix-ui/react-slot',
      'tippy.js',
      'nanoid',
      'clsx',
      'tailwind-merge',
    ],
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
    // Electron 43 embeds Chromium 150, so target the actual renderer runtime.
    target: 'chrome150',
    cssTarget: 'chrome150',
    outDir: 'dist/renderer',
    emptyOutDir: true,
    sourcemap: false, // Disable sourcemaps for smaller bundle
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Better code splitting for lazy loading
        manualChunks: rendererManualChunks,
      },
    },
  },
})
