/**
 * Environment Utilities for Main Process
 */

import { app } from 'electron'

// Check if running in development mode
// app.isPackaged is false in development and true in production
export const isDev = !app.isPackaged
export const isProd = app.isPackaged

export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue
}
