/**
 * Path utilities for consistent path handling across the app
 */

/**
 * Normalize a file path for consistent comparison
 * - Converts backslashes to forward slashes
 * - Removes leading and trailing slashes
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

/**
 * Get the parent folder path from a file path
 */
export function getParentPath(path: string): string {
  const normalized = normalizePath(path);
  if (!normalized.includes('/')) return '';
  return normalized.slice(0, normalized.lastIndexOf('/'));
}

/**
 * Get the file/folder name from a path
 */
export function getBaseName(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
}

/**
 * Get display name (removes .md extension)
 */
export function getDisplayName(name: string): string {
  return name.endsWith('.md') ? name.replace(/\.md$/i, '') : name;
}
