import { builtinModules } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vite';
import packageJson from './package.json';

const dependencies = Object.keys(packageJson.dependencies);
const external = new Set([
  ...builtinModules,
  ...builtinModules.map((module) => `node:${module}`),
  ...dependencies,
]);

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@main': path.resolve(__dirname, './src/main'),
      '@domain': path.resolve(__dirname, './src/main/domain'),
      '@application': path.resolve(__dirname, './src/main/application'),
      '@adapters': path.resolve(__dirname, './src/main/adapters'),
      '@infrastructure': path.resolve(__dirname, './src/main/infrastructure'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
    conditions: ['node'],
  },
  build: {
    target: 'node22',
    outDir: 'dist/server',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/main/infrastructure/server/standalone.ts'),
      formats: ['es'],
      fileName: () => 'standalone.mjs',
    },
    rollupOptions: {
      external: (id) =>
        external.has(id) || dependencies.some((dependency) => id.startsWith(`${dependency}/`)),
    },
  },
});
