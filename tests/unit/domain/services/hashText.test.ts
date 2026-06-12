import { describe, expect, it } from 'vitest';
import { hashText } from '../../../../src/main/domain/services/hashText';

describe('hashText', () => {
  it('returns the stable empty hash and fixed-width hex values', () => {
    expect(hashText('')).toBe('0000000000000000');
    expect(hashText('Stone')).toMatch(/^[0-9a-f]{16}$/);
    expect(hashText('Stone')).toBe(hashText('Stone'));
  });

  it('distinguishes ascii, multibyte, and surrogate-pair inputs', () => {
    const values = new Set([hashText('note'), hashText('noté'), hashText('note 🪨')]);
    expect(values.size).toBe(3);
  });
});
