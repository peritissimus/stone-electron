/**
 * Environment Utilities for Main Process
 */

import electronIsDev from 'electron-is-dev'

export const isDev = electronIsDev
export const isProd = !electronIsDev

export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue
}
