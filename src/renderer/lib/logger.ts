/**
 * Logger Utility for Renderer Process
 * Uses console with formatted output
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const formatTimestamp = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
};

const createLogFn =
  (level: LogLevel) =>
  (...args: unknown[]) => {
    const timestamp = formatTimestamp();
    const prefix = `${timestamp} ›`;

    switch (level) {
      case 'debug':
        console.debug(prefix, ...args);
        break;
      case 'info':
        console.info(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      case 'error':
        console.error(prefix, ...args);
        break;
    }
  };

export const logger = {
  debug: createLogFn('debug'),
  info: createLogFn('info'),
  warn: createLogFn('warn'),
  error: createLogFn('error'),
  log: createLogFn('info'),
};

export const logInfo = logger.info;
export const logError = logger.error;
export const logWarn = logger.warn;
export const logDebug = logger.debug;
