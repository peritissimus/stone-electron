/**
 * Fast deep equality check with early bail-out
 * Optimized for comparing TipTap editor JSON structures
 */

/**
 * Fast deep equality comparison
 * Returns false as soon as a difference is found (early bail-out)
 */
export function fastDeepEqual(a: unknown, b: unknown): boolean {
  // Same reference or both null/undefined
  if (a === b) return true;

  // Type mismatch
  if (typeof a !== typeof b) return false;

  // Null checks (typeof null === 'object')
  if (a === null || b === null) return false;

  // Primitive types already handled by === above
  if (typeof a !== 'object') return false;

  // Array comparison
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!fastDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Object comparison
  if (Array.isArray(b)) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  // Different number of keys
  if (aKeys.length !== bKeys.length) return false;

  // Check all keys and values
  for (const key of aKeys) {
    if (!(key in bObj)) return false;
    if (!fastDeepEqual(aObj[key], bObj[key])) return false;
  }

  return true;
}
