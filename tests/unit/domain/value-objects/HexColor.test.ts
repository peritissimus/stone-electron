/**
 * HexColor Value Object Tests
 *
 * Immutable value object - no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { HexColor } from '../../../../src/main/domain/value-objects/HexColor';

describe('HexColor', () => {
  describe('fromString', () => {
    it('creates HexColor from valid hex string', () => {
      const color = HexColor.fromString('#ff5500');

      expect(color.value).toBe('#ff5500');
    });

    it('normalizes uppercase to lowercase', () => {
      const color = HexColor.fromString('#FF5500');

      expect(color.value).toBe('#ff5500');
    });

    it('normalizes mixed case to lowercase', () => {
      const color = HexColor.fromString('#FfAaBb');

      expect(color.value).toBe('#ffaabb');
    });

    it('throws on invalid format - no hash', () => {
      expect(() => HexColor.fromString('ff5500')).toThrow();
    });

    it('throws on invalid format - wrong length', () => {
      expect(() => HexColor.fromString('#fff')).toThrow();
      expect(() => HexColor.fromString('#fffffff')).toThrow();
    });

    it('throws on invalid characters', () => {
      expect(() => HexColor.fromString('#gggggg')).toThrow();
      expect(() => HexColor.fromString('#ff550g')).toThrow();
    });

    it('throws on empty string', () => {
      expect(() => HexColor.fromString('')).toThrow();
    });
  });

  describe('fromRGB', () => {
    it('creates HexColor from RGB values', () => {
      const color = HexColor.fromRGB(255, 85, 0);

      expect(color.value).toBe('#ff5500');
    });

    it('handles zero values', () => {
      const color = HexColor.fromRGB(0, 0, 0);

      expect(color.value).toBe('#000000');
    });

    it('handles max values', () => {
      const color = HexColor.fromRGB(255, 255, 255);

      expect(color.value).toBe('#ffffff');
    });

    it('clamps values above 255', () => {
      const color = HexColor.fromRGB(300, 300, 300);

      expect(color.value).toBe('#ffffff');
    });

    it('clamps values below 0', () => {
      const color = HexColor.fromRGB(-10, -20, -30);

      expect(color.value).toBe('#000000');
    });

    it('pads single digit hex values', () => {
      const color = HexColor.fromRGB(0, 15, 0);

      expect(color.value).toBe('#000f00');
    });
  });

  describe('rgb getter', () => {
    it('returns correct RGB values', () => {
      const color = HexColor.fromString('#ff5500');

      expect(color.rgb).toEqual({ r: 255, g: 85, b: 0 });
    });

    it('handles black', () => {
      const color = HexColor.fromString('#000000');

      expect(color.rgb).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('handles white', () => {
      const color = HexColor.fromString('#ffffff');

      expect(color.rgb).toEqual({ r: 255, g: 255, b: 255 });
    });
  });

  describe('equals', () => {
    it('returns true for equal colors', () => {
      const a = HexColor.fromString('#ff5500');
      const b = HexColor.fromString('#ff5500');

      expect(a.equals(b)).toBe(true);
    });

    it('returns true for same color different case', () => {
      const a = HexColor.fromString('#FF5500');
      const b = HexColor.fromString('#ff5500');

      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different colors', () => {
      const a = HexColor.fromString('#ff5500');
      const b = HexColor.fromString('#00ff55');

      expect(a.equals(b)).toBe(false);
    });

    it('returns false when comparing with null/undefined', () => {
      const a = HexColor.fromString('#ff5500');

      expect(a.equals(null as unknown as HexColor)).toBe(false);
      expect(a.equals(undefined as unknown as HexColor)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns hex string', () => {
      const color = HexColor.fromString('#ff5500');

      expect(color.toString()).toBe('#ff5500');
    });
  });

  describe('round-trip', () => {
    it('RGB to hex and back', () => {
      const original = { r: 128, g: 64, b: 32 };
      const color = HexColor.fromRGB(original.r, original.g, original.b);
      const result = color.rgb;

      expect(result).toEqual(original);
    });
  });
});
