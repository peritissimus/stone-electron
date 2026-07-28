import path from 'node:path';
import { defineConfig } from 'vite';

/**
 * Prefixes that resolve back into this repo. Everything else that is not a
 * relative or absolute path is a package.
 *
 * '@' maps to ./src, so it has to match exactly or as '@/…' — a bare
 * startsWith('@') would swallow every scoped package on npm.
 */
const INTERNAL_ALIASES = [
  '@',
  '@main',
  '@domain',
  '@application',
  '@adapters',
  '@infrastructure',
  '@shared',
];

const isInternal = (id: string): boolean =>
  INTERNAL_ALIASES.some((alias) => id === alias || id.startsWith(`${alias}/`));

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
      // Externalise every package, not just the direct dependencies. Listing
      // only those left transitive ones to be inlined, and a CJS transitive
      // calling require() inside an ESM bundle throws at startup — which is
      // what broke `pnpm web:start`. The server runs beside its own
      // node_modules, so bundling dependencies buys nothing either way.
      external: (id) => !id.startsWith('.') && !path.isAbsolute(id) && !isInternal(id),
    },
  },
});
