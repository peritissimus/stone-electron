import { defineConfig } from 'vite';
import path from 'path';

/**
 * Vite config for building the embedding worker
 * Workers run in their own thread with `self` defined
 */
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
    outDir: 'dist/main/workers',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/main/workers/embedding.worker.ts'),
      formats: ['cjs'],
      fileName: () => 'embedding.worker.js',
    },
    rollupOptions: {
      external: [
        // Node.js built-ins
        'worker_threads',
        'path',
        'fs',
        'fs/promises',
        'crypto',
        'os',
        'url',
        'util',
        'http',
        'https',
        'stream',
        'zlib',
        'net',
        'tls',
        'assert',
        'node:path',
        'node:fs',
        'node:fs/promises',
        'node:crypto',
        'node:os',
        'node:url',
        'node:util',
        'node:http',
        'node:https',
        'node:stream',
        'node:zlib',
        'node:net',
        'node:tls',
        'node:assert',
        'node:worker_threads',
        // ONNX runtime - must be external, loaded at runtime
        'onnxruntime-node',
        'onnxruntime-web',
        'onnxruntime-common',
        'sharp',
        // Transformers.js - must be external for proper ONNX backend selection
        '@xenova/transformers',
      ],
    },
  },
});
