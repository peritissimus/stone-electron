import { describe, expect, it } from 'vitest';
import { NoteEntity } from '../../../src/main/domain/entities/Note';
import {
  CreateNoteRequestSchema,
  NoteSchema,
  UpdateNoteRequestSchema,
} from '../../../src/shared/schemas/notes';
import { CreateQuickNoteRequestSchema } from '../../../src/shared/schemas/quickNote';

describe('note title write contract', () => {
  const cases = [
    '',
    ' \t\n ',
    '東京 — Hội nghị',
    '  Project  ',
    'a'.repeat(255),
    'a'.repeat(256),
    ` ${'a'.repeat(255)} `,
  ];

  it.each(cases)(
    'keeps create, rename, quick note, and domain validation aligned for %j',
    (title) => {
      const create = CreateNoteRequestSchema.safeParse({ title });
      const update = UpdateNoteRequestSchema.safeParse({ id: 'n1', title });
      const quickNote = CreateQuickNoteRequestSchema.safeParse({ slot: 'personal', title });
      expect(update.success).toBe(create.success);
      expect(quickNote.success).toBe(create.success);
      const existing = NoteEntity.create({ id: 'n1' });
      if (create.success) {
        expect(create.data.title).toBe(title.trim());
        expect(NoteEntity.create({ id: 'n1', title }).title).toBe(create.data.title);
        existing.updateTitle(title);
        expect(existing.title).toBe(create.data.title);
      } else {
        expect(() => NoteEntity.create({ id: 'n1', title })).toThrow();
        expect(() => existing.updateTitle(title)).toThrow();
        expect(existing.title).toBe('Untitled');
      }
    },
  );

  it('still permits omitted titles and content-only updates', () => {
    const parsed = CreateNoteRequestSchema.parse({});
    expect(NoteEntity.create({ id: 'n1', ...parsed }).title).toBe('Untitled');
    expect(UpdateNoteRequestSchema.parse({ id: 'n1', content: 'body' })).toEqual({
      id: 'n1',
      content: 'body',
    });
  });

  it.each(['  ', 'a'.repeat(500)])('keeps legacy and imported titles readable: %j', (title) => {
    const props = { ...NoteEntity.create({ id: 'n1' }).toPersistence(), title };
    expect(NoteEntity.fromPersistence(props).title).toBe(title);
    expect(NoteSchema.parse({ ...props, embedding: null }).title).toBe(title);
  });
});
