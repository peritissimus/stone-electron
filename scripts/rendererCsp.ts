import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** Production-only: preserve the theme bootstrap without allowing arbitrary inline JS. */
export function rendererCsp(): Plugin {
  return {
    name: 'stone-renderer-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
          .filter(([, attributes, body]) => !/\bsrc\s*=/i.test(attributes) && body.trim())
          .map(([, , body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
        const content = [
          "default-src 'none'",
          `script-src 'self' ${hashes.join(' ')}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "media-src 'self' blob: data:",
          "worker-src 'self' blob:",
          "object-src 'none'",
          "frame-src 'none'",
          "base-uri 'none'",
          "form-action 'none'",
        ].join('; ');
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}
