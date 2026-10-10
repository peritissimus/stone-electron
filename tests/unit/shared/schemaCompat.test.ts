import { describe, expect, it } from 'vitest';
import { z } from '../../../src/shared/schemas/schema';
import { UpdateNoteRequestSchema } from '../../../src/shared/schemas/notes';

describe('schema compat optional semantics', () => {
  it('accepts an explicitly undefined optional field, like zod', () => {
    const schema = z.object({ id: z.string(), title: z.string().optional() });

    expect(schema.parse({ id: 'n1', title: undefined })).toEqual({ id: 'n1' });
    expect(schema.parse({ id: 'n1' })).toEqual({ id: 'n1' });
    expect(schema.parse({ id: 'n1', title: 'hello' })).toEqual({ id: 'n1', title: 'hello' });
    expect(() => schema.parse({ id: 'n1', title: 7 })).toThrow();
  });

  it('applies defaults for missing and explicitly undefined values', () => {
    const schema = z.object({ flag: z.boolean().default(true) });

    expect(schema.parse({})).toEqual({ flag: true });
    expect(schema.parse({ flag: undefined })).toEqual({ flag: true });
    expect(schema.parse({ flag: false })).toEqual({ flag: false });
  });

  it('parses a partial notes:update payload with undefined fields', () => {
    const parsed = UpdateNoteRequestSchema.parse({
      id: 'note-1',
      title: undefined,
      content: 'body',
      notebookId: undefined,
      silent: undefined,
    });
    expect(parsed.id).toBe('note-1');
    expect(parsed.content).toBe('body');
    expect(parsed.title).toBeUndefined();
  });
});

describe('schema object property policies', () => {
  const base = z.object({ id: z.string() });

  it('strips unknown properties by default and rejects them in strict requests', () => {
    expect(base.parse({ id: 'n1', extra: true })).toEqual({ id: 'n1' });
    expect(UpdateNoteRequestSchema.safeParse({ id: 'n1', titlle: 'typo' }).success).toBe(false);
    expect(base.strict().safeParse({ id: 'n1', extra: true }).success).toBe(false);
  });

  it('preserves unknown properties only when requested, without mutating the original schema', () => {
    const payload = { id: 'n1', extra: { nested: true } };
    const passthrough = base.passthrough();
    expect(passthrough.parse(payload)).toEqual(payload);
    expect(base.parse(payload)).toEqual({ id: 'n1' });
    expect(passthrough.strip().parse(payload)).toEqual({ id: 'n1' });
    expect(passthrough.strict().safeParse(payload).success).toBe(false);
  });

  it('keeps nested object policies independent through optional fields and arrays', () => {
    const schema = z
      .object({
        strict: base.strict().optional(),
        preserving: z.array(base.passthrough()),
        stripping: base,
      })
      .strict();
    const payload = {
      strict: { id: 'n1' },
      preserving: [{ id: 'n2', extra: true }],
      stripping: { id: 'n3', extra: true },
    };
    expect(schema.parse(payload)).toEqual({
      ...payload,
      stripping: { id: 'n3' },
    });
    expect(schema.safeParse({ ...payload, strict: { id: 'n1', extra: true } }).success).toBe(false);
    expect(schema.safeParse({ ...payload, unexpected: true }).success).toBe(false);
  });

  it('retains the policy through extension, refinement, and transformation', () => {
    const strict = base
      .strict()
      .extend({ count: z.number() })
      .refine((value) => value.count > 0);
    expect(strict.safeParse({ id: 'n1', count: 1, extra: true }).success).toBe(false);
    const preserving = base
      .passthrough()
      .extend({ count: z.number() })
      .transform((value) => value);
    expect(preserving.parse({ id: 'n1', count: 1, extra: true })).toEqual({
      id: 'n1',
      count: 1,
      extra: true,
    });
  });
});
