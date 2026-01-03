#!/usr/bin/env node
/**
 * Standalone Server Entry Point
 *
 * Run the Stone backend as a standalone HTTP server without Electron.
 *
 * Usage:
 *   npx ts-node src/main/api/standalone.ts
 *   # or after building:
 *   node dist/main/api/standalone.js
 *
 * Environment variables:
 *   PORT - Server port (default: 3721)
 *   HOST - Server host (default: 127.0.0.1)
 *   DATA_PATH - Path to data directory (default: ~/.stone)
 */

import { startServer } from './server';
import { getDatabaseManager } from '../database';
import { logger } from '../utils/logger';

async function main() {
  const port = parseInt(process.env.PORT || '3721', 10);
  const host = process.env.HOST || '127.0.0.1';

  logger.info('[Standalone] Starting Stone backend server...');

  // Initialize database
  try {
    const db = getDatabaseManager();
    await db.initialize();
    logger.info('[Standalone] Database initialized');
  } catch (error) {
    logger.error('[Standalone] Failed to initialize database:', error);
    process.exit(1);
  }

  // Start HTTP server
  try {
    await startServer({ port, host });
    logger.info(`[Standalone] Stone API ready at http://${host}:${port}`);
    logger.info('[Standalone] Endpoints:');
    logger.info('  GET  /health              - Health check');
    logger.info('  GET  /api/notes           - List notes');
    logger.info('  GET  /api/notebooks       - List notebooks');
    logger.info('  GET  /api/tags            - List tags');
    logger.info('  GET  /api/workspaces      - List workspaces');
    logger.info('  GET  /api/search?q=...    - Search notes');
  } catch (error) {
    logger.error('[Standalone] Failed to start server:', error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  logger.info('[Standalone] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('[Standalone] Shutting down...');
  process.exit(0);
});

// Run
main().catch((error) => {
  logger.error('[Standalone] Unhandled error:', error);
  process.exit(1);
});
