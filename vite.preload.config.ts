import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  build: {
    target: 'node18',
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/preload.ts'),
      formats: ['cjs'],
      fileName: () => 'preload.cjs',
    },
    rollupOptions: {
      external: ['electron'],
    },
  },
})
