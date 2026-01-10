/**
 * ID Generation Utilities
 */
import { customAlphabet } from 'nanoid';

// Use a custom alphabet for better readability
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 21);

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return nanoid();
}

/**
 * Generate multiple IDs
 */
export function generateIds(count: number): string[] {
  return Array.from({ length: count }, () => generateId());
}

/**
 * Check if string is a valid ID format
 */
export function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length === 21;
}
