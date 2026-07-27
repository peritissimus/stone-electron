import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'stone-web-entry',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const url = request.url ?? '/';
          const wantsHtml = (request.headers.accept ?? '').includes('text/html');
          // Vite's default entry is index.html — the Electron renderer, which has
          // no transport bridge and hangs on its own boot spinner in a browser.
          // Send every navigation to the web entry, not just '/', so a deep link
          // or a stale path cannot load the wrong app. Mirrors what the Fastify
          // notFoundHandler already does in production.
          // /capture is its own entry, not a route inside the SPA — redirecting
          // it to web.html would hand the phone the 7 MB app it exists to avoid.
          const isViteInternal = /^\/(?:@|src\/|node_modules\/|api\/|web\.html|capture)/.test(url);
          if (request.method === 'GET' && wantsHtml && !isViteInternal) {
            response.statusCode = 302;
            response.setHeader('Location', '/web.html');
            response.end();
            return;
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_URL ?? 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist/web',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        web: path.resolve(__dirname, 'web.html'),
        capture: path.resolve(__dirname, 'capture.html'),
      },
    },
  },
});
