/**
 * Environment Utilities for Main Process
 *
 * Works in both Electron and standalone modes.
 */

/**
 * Get Electron app if available
 */
function getElectronApp(): typeof import('electron').app | null {
  try {
    // Dynamic import to avoid errors in standalone mode
    const electron = require('electron');
    if (electron.app && typeof electron.app.isPackaged === 'boolean') {
      return electron.app;
    }
  } catch {
    // Not in Electron environment
  }
  return null;
}

const electronApp = getElectronApp();

// Check if running in development mode
// In Electron: app.isPackaged is false in development and true in production
// In standalone: always development mode unless NODE_ENV is set
// In E2E tests, we run the unpackaged app but want production behavior
export const isDev = process.env.E2E_TEST === 'true'
  ? false
  : (electronApp ? !electronApp.isPackaged : process.env.NODE_ENV !== 'production');
export const isProd = !isDev;

// Check if running in Electron mode
export const isElectron = electronApp !== null;

export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}
