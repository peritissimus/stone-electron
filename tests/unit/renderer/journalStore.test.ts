import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('journalStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useJournalStore.getState().reset();
  });

  it('ignores note events without a journalDate or known id', async () => {
    listRange.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [{ date: '2026-05-25', noteId: null, exists: false, content: null }],
      },
    });
    await useJournalStore.getState().load();
    listRange.mockClear();

    await useJournalStore.getState().refreshForNoteEvent({ id: 'quick-1' });

    expect(getById).not.toHaveBeenCalled();
    expect(listRange).not.toHaveBeenCalled();
  });

  it('reloads when a journal-tagged event matches a visible date', async () => {
    listRange.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [{ date: '2026-05-25', noteId: null, exists: false, content: null }],
      },
    });
    await useJournalStore.getState().load();
    listRange.mockClear();
    listRange.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [{ date: '2026-05-25', noteId: 'journal-1', exists: true, content: '# Today' }],
      },
    });

    await useJournalStore
      .getState()
      .refreshForNoteEvent({ id: 'journal-1', journalDate: '2026-05-25' });

    expect(listRange).toHaveBeenCalledTimes(1);
    expect(useJournalStore.getState().entries[0]).toMatchObject({
      noteId: 'journal-1',
      exists: true,
    });
  });

  it('reloads on updates to a note already pinned to a visible entry', async () => {
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

  it('reloads on delete events that target a visible journal entry', async () => {
    listRange.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [{ date: '2026-05-25', noteId: 'journal-1', exists: true, content: 'Bye' }],
      },
    });
    await useJournalStore.getState().load();
    listRange.mockClear();
    listRange.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [{ date: '2026-05-25', noteId: null, exists: false, content: null }],
      },
    });

    await useJournalStore.getState().refreshForNoteEvent({ id: 'journal-1' });

    expect(listRange).toHaveBeenCalledTimes(1);
    expect(useJournalStore.getState().entries[0]).toMatchObject({
      noteId: null,
      exists: false,
    });
  });

  it('ignores journal-tagged events for dates outside the visible window', async () => {
    listRange.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [{ date: '2026-05-25', noteId: null, exists: false, content: null }],
      },
    });
    await useJournalStore.getState().load();
    listRange.mockClear();

    await useJournalStore
      .getState()
      .refreshForNoteEvent({ id: 'old-journal', journalDate: '2025-01-01' });

    expect(listRange).not.toHaveBeenCalled();
  });
});
