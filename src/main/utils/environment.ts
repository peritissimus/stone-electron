/**
 * Environment Utilities for Main Process
 */

export const isDev = process.env.NODE_ENV === 'development'
export const isProd = process.env.NODE_ENV === 'production'

export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue
}
