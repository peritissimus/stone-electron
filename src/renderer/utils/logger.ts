/**
 * Logger Utility for Renderer Process
 */

// Simple console wrapper for renderer process
// electron-log/renderer requires initialization in main process
const createLogger = () => {
  const format = (level: string, ...args: unknown[]) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })
    console[level as 'log' | 'error' | 'warn' | 'info' | 'debug'](`[${timestamp}] [RENDERER] [${level}]`, ...args)
  }

  return {
    info: (...args: unknown[]) => format('info', ...args),
    error: (...args: unknown[]) => format('error', ...args),
    warn: (...args: unknown[]) => format('warn', ...args),
    debug: (...args: unknown[]) => format('debug', ...args),
    log: (...args: unknown[]) => format('log', ...args),
  }
}

// Export logger instance
export const logger = createLogger()

// Export convenience functions
export const logInfo = (...args: unknown[]) => logger.info(...args)
export const logError = (...args: unknown[]) => logger.error(...args)
export const logWarn = (...args: unknown[]) => logger.warn(...args)
export const logDebug = (...args: unknown[]) => logger.debug(...args)
