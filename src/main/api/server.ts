/**
 * HTTP API Server
 *
 * Hono server that exposes the backend services via REST API.
 * Can run standalone or alongside Electron.
 */

import { serve } from '@hono/node-server';
import { logger } from '../utils/logger';
import { createApp } from './app';

export interface ServerConfig {
  port: number;
  host?: string;
}

const DEFAULT_CONFIG: ServerConfig = {
  port: 3721,
  host: '127.0.0.1',
};

/**
 * Start the HTTP server
 */
export async function startServer(config: Partial<ServerConfig> = {}): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const app = createApp();

  return new Promise((resolve) => {
    serve(
      {
        fetch: app.fetch,
        port: finalConfig.port,
        hostname: finalConfig.host,
      },
      () => {
        logger.info(`[API] Server running at http://${finalConfig.host}:${finalConfig.port}`);
        resolve();
      },
    );
  });
}

// Re-export createApp for direct usage
export { createApp };
