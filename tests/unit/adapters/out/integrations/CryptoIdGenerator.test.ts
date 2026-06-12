import { describe, expect, it } from 'vitest';
import { CryptoIdGenerator } from '../../../../../src/main/adapters/out/integrations/CryptoIdGenerator';

describe('CryptoIdGenerator', () => {
  it('generates RFC4122 UUID-looking ids', () => {
    const id = new CryptoIdGenerator().generate();

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
