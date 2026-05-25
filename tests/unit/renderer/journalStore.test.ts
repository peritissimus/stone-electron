import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '../../../src/shared/types';

const listRange = vi.fn();
const openOrCreateForDate = vi.fn();
const getById = vi.fn();

vi.mock('@renderer/api', () => ({
  journalAPI: {
    listRange,
    openOrCreateForDate,
  },
  noteAPI: {
    getById,
  },
}));

const { useJournalStore } = await import('../../../src/renderer/stores/journalStore');

function note(overrides: Partial<Note>): Note {
  return {
    id: 'note-1',
    title: 'Note',
    filePath: 'Notes/note.md',
    notebookId: null,
    workspaceId: 'workspace-1',
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2026-05-25T00:00:00.000Z'),
    updatedAt: new Date('2026-05-25T00:00:00.000Z'),
    ...overrides,
  };
}

describe('journalStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useJournalStore.getState().reset();
  });

  it('ignores non-journal quick-note creations after resolving the note', async () => {
    listRange.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [{ date: '2026-05-25', noteId: null, exists: false, content: null }],
      },
    });
    await useJournalStore.getState().load();
    listRange.mockClear();

    getById.mockResolvedValueOnce({
      success: true,
      data: note({ id: 'quick-1', filePath: 'Personal/20260525-120000-001.md' }),
    });

    await useJournalStore.getState().refreshForNoteEvent({ id: 'quick-1' });

    expect(getById).toHaveBeenCalledWith('quick-1');
    expect(listRange).not.toHaveBeenCalled();
  });

  it('reloads when a created note matches a visible journal date', async () => {
    listRange.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [{ date: '2026-05-25', noteId: null, exists: false, content: null }],
      },
    });
    await useJournalStore.getState().load();
    listRange.mockClear();

    getById.mockResolvedValueOnce({
      success: true,
      data: note({ id: 'journal-1', filePath: 'Daily/2026-05-25.md' }),
    });
    listRange.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [{ date: '2026-05-25', noteId: 'journal-1', exists: true, content: '# Today' }],
      },
    });

    await useJournalStore.getState().refreshForNoteEvent({ id: 'journal-1' });

    expect(listRange).toHaveBeenCalledTimes(1);
    expect(useJournalStore.getState().entries[0]).toMatchObject({
      noteId: 'journal-1',
      exists: true,
    });
  });

  it('reloads existing visible journal entries without a note lookup', async () => {
    listRange.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [{ date: '2026-05-25', noteId: 'journal-1', exists: true, content: '' }],
      },
    });
    await useJournalStore.getState().load();
    listRange.mockClear();
    listRange.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [{ date: '2026-05-25', noteId: 'journal-1', exists: true, content: 'Updated' }],
      },
    });

    await useJournalStore.getState().refreshForNoteEvent({ id: 'journal-1' });

    expect(getById).not.toHaveBeenCalled();
    expect(listRange).toHaveBeenCalledTimes(1);
  });
});
