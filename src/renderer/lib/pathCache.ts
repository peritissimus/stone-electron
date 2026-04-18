/**
 * Path Normalization Cache
 *
 * Caches path normalization results to avoid redundant regex operations.
 * For 1000 notes, this reduces 3000+ regex operations to ~1000 operations.
 */

const pathCache = new Map<string, string>();

/**
 * Normalize a file path with caching
 * - Converts backslashes to forward slashes
 * - Removes leading/trailing slashes
 * - Caches results for O(1) lookups
 */
export function normalizePath(path: string): string {
  if (pathCache.has(path)) {
    return pathCache.get(path)!;
  }

  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');

  pathCache.set(path, normalized);
  return normalized;
}

/**
 * Clear the path cache
 * Call this when workspace changes to free memory
 */
export function clearPathCache(): void {
  pathCache.clear();
}

/**
 * Get cache statistics (for debugging)
 */
export function getPathCacheStats(): { size: number; memoryEstimate: string } {
  const size = pathCache.size;
  // Rough estimate: each entry is ~100 bytes (2 strings + overhead)
  const memoryBytes = size * 100;
  const memoryKB = (memoryBytes / 1024).toFixed(2);

  return {
    size,
    memoryEstimate: `${memoryKB} KB`,
  };
}
