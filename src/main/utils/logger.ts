/**
 * Logger Utility using electron-log
 */

import log from 'electron-log';
import path from 'path';

// Configure log file location - only if electron is available
let app: any = null;
try {
  app = require('electron').app;
  log.transports.file.resolvePathFn = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'logs', 'stone.log');
  };

  // Set log level based on environment
  if (!app.isPackaged) {
    log.transports.console.level = 'debug';
    log.transports.file.level = 'debug';
  } else {
    log.transports.console.level = 'info';
    log.transports.file.level = 'info';
  }
} catch {
  // Electron not available (e.g., in scripts), use console-only logging
  log.transports.file.level = false;
  log.transports.console.level = 'debug';
}

// Set log format
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';

// Export logger instance
export const logger = log;

// Export convenience functions
export const logInfo = (...args: unknown[]) => logger.info(...args);
export const logError = (...args: unknown[]) => logger.error(...args);
export const logWarn = (...args: unknown[]) => logger.warn(...args);
export const logDebug = (...args: unknown[]) => logger.debug(...args);
