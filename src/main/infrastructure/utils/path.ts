import path from 'node:path';

/**
 * Normalize a user-provided relative path to POSIX-style, removing leading/trailing slashes.
 */
export function normalizeRelativePath(input?: string | null): string {
  if (!input) return '';
  return input
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\/{1,100}/, '')
    .replace(/\/{1,100}$/, '');
}

/**
 * Resolve a child path inside a root directory and ensure it does not escape the root.
 * Throws an Error if the resolved path is outside the root.
 */
export function resolveInsideRoot(rootDir: string, relativePath: string): string {
  const rootAbs = path.resolve(rootDir);
  const candidateAbs = path.resolve(rootAbs, relativePath);

  // Allow exact root match (e.g., relativePath === '' or '.')
  if (candidateAbs === rootAbs) return candidateAbs;

  // Ensure candidate is within root (with trailing separator to avoid prefix trickery)
  const withSep = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep;
  if (!candidateAbs.startsWith(withSep)) {
    throw new Error('Path escapes workspace root');
  }
  return candidateAbs;
}
