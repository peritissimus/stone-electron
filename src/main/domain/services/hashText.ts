/**
 * hashText — small, stable, fast non-cryptographic hash for change detection.
 *
 * Used by the chunk indexer to skip re-embedding text whose bytes haven't
 * changed. Collision strength doesn't need to be cryptographic — we just need
 * the same input to produce the same string and different inputs to almost
 * always produce different strings.
 *
 * Implementation: 64-bit FNV-1a, returned as a 16-char hex string. Pure JS,
 * no Node built-ins, no npm deps — safe to use from the domain layer.
 */

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

export function hashText(text: string): string {
  if (!text) return '0000000000000000';

  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    // Encode each char as UTF-8 bytes manually. Most code points are <=0x7f
    // for English notes; multi-byte chars (emoji, CJK) still hash correctly.
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      hash = ((hash ^ BigInt(code)) * FNV_PRIME) & MASK_64;
    } else if (code < 0x800) {
      hash = ((hash ^ BigInt(0xc0 | (code >> 6))) * FNV_PRIME) & MASK_64;
      hash = ((hash ^ BigInt(0x80 | (code & 0x3f))) * FNV_PRIME) & MASK_64;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      // Surrogate pair → single code point ≥ 0x10000
      const low = text.charCodeAt(i + 1);
      i += 1;
      const cp = 0x10000 + (((code - 0xd800) << 10) | (low - 0xdc00));
      hash = ((hash ^ BigInt(0xf0 | (cp >> 18))) * FNV_PRIME) & MASK_64;
      hash = ((hash ^ BigInt(0x80 | ((cp >> 12) & 0x3f))) * FNV_PRIME) & MASK_64;
      hash = ((hash ^ BigInt(0x80 | ((cp >> 6) & 0x3f))) * FNV_PRIME) & MASK_64;
      hash = ((hash ^ BigInt(0x80 | (cp & 0x3f))) * FNV_PRIME) & MASK_64;
    } else {
      hash = ((hash ^ BigInt(0xe0 | (code >> 12))) * FNV_PRIME) & MASK_64;
      hash = ((hash ^ BigInt(0x80 | ((code >> 6) & 0x3f))) * FNV_PRIME) & MASK_64;
      hash = ((hash ^ BigInt(0x80 | (code & 0x3f))) * FNV_PRIME) & MASK_64;
    }
  }

  return hash.toString(16).padStart(16, '0');
}
