/**
 * UTF-8 <-> Base64 helpers for exporting rendered content.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

/**
 * Encode a UTF-8 string to a Base64 representation.
 */
export function encodeToBase64(value: string): string {
  const bytes = textEncoder.encode(value);
  let binary = '';
  const chunkSize = 0x8000;
  for (let idx = 0; idx < bytes.length; idx += chunkSize) {
    const chunk = bytes.subarray(idx, idx + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

/**
 * Decode a Base64 string back to UTF-8.
 */
export function decodeBase64ToUtf8(value: string): string {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return textDecoder.decode(bytes);
}
