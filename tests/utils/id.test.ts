/**
 * ID Generation Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { generateId, generateIds, isValidId } from '../../src/shared/utils/id';

describe('ID Utilities', () => {
  describe('generateId', () => {
    it('should generate a 21-character ID', () => {
      const id = generateId();
      expect(id).toHaveLength(21);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('should only contain alphanumeric characters', () => {
      const id = generateId();
      expect(id).toMatch(/^[0-9A-Za-z]+$/);
    });
  });

  describe('generateIds', () => {
    it('should generate the requested number of IDs', () => {
      const ids = generateIds(5);
      expect(ids).toHaveLength(5);
    });

    it('should generate unique IDs', () => {
      const ids = generateIds(10);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it('should return empty array for count of 0', () => {
      const ids = generateIds(0);
      expect(ids).toEqual([]);
    });

    it('should generate valid IDs', () => {
      const ids = generateIds(3);
      ids.forEach(id => {
        expect(id).toHaveLength(21);
        expect(id).toMatch(/^[0-9A-Za-z]+$/);
      });
    });
  });

  describe('isValidId', () => {
    it('should return true for valid 21-character ID', () => {
      const id = generateId();
      expect(isValidId(id)).toBe(true);
    });

    it('should return false for short ID', () => {
      expect(isValidId('abc123')).toBe(false);
    });

    it('should return false for long ID', () => {
      expect(isValidId('a'.repeat(22))).toBe(false);
    });

    it('should return false for non-string', () => {
      expect(isValidId(123 as any)).toBe(false);
      expect(isValidId(null as any)).toBe(false);
      expect(isValidId(undefined as any)).toBe(false);
    });

    it('should return true for exactly 21 characters', () => {
      expect(isValidId('a'.repeat(21))).toBe(true);
    });
  });
});
