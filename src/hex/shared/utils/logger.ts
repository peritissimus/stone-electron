/**
 * Shared Logger
 *
 * Logger utility for use across all hex layers.
 * Uses electron-log when available, falls back to console.
 */

import log from 'electron-log';
import path from 'node:path';

// Configure log file location - only if electron is available
let app: any = null;
try {
  app = require('electron').app;
  log.transports.file.resolvePathFn = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'logs', 'stone.log');
  };

  log.transports.console.level = 'debug';
  log.transports.file.level = 'debug';
} catch {
  // Electron not available (e.g., in tests or scripts)
  log.transports.file.level = false;
  log.transports.console.level = 'debug';
}

// Set log format
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';

export const logger = log;

export const logInfo = (...args: unknown[]) => logger.info(...args);
export const logError = (...args: unknown[]) => logger.error(...args);
export const logWarn = (...args: unknown[]) => logger.warn(...args);
export const logDebug = (...args: unknown[]) => logger.debug(...args);
