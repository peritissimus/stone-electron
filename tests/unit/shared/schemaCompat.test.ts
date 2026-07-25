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
