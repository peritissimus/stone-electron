import { describe, it, expect } from 'vitest';
import { deriveTreeSelection } from '@renderer/hooks/useTreeSelection';
import type { Note } from '@shared/types';

// The derivation only reads id and filePath; avoid coupling the test to
// unrelated Drizzle-generated columns by using a small partial cast.
function noteWithPath(id: string, filePath: string | null): Note {
  return { id, filePath } as unknown as Note;
}

describe('deriveTreeSelection', () => {
  it('returns null selection when no note is active', () => {
    expect(deriveTreeSelection(null, [])).toEqual({
      selectedFile: null,
      activeFolder: null,
    });
  });

  it('returns null selection when the active id is not in the notes list', () => {
    const notes = [noteWithPath('other', 'Inbox/whatever.md')];
    expect(deriveTreeSelection('missing', notes)).toEqual({
      selectedFile: null,
      activeFolder: null,
    });
  });

  it('returns null selection when the note has no file path', () => {
    const notes = [noteWithPath('a', null)];
    expect(deriveTreeSelection('a', notes)).toEqual({
      selectedFile: null,
      activeFolder: null,
    });
  });

  it('derives selectedFile and activeFolder from a nested file path', () => {
    const notes = [noteWithPath('a', 'Journal/2026-04-21.md')];
    expect(deriveTreeSelection('a', notes)).toEqual({
      selectedFile: 'Journal/2026-04-21.md',
      activeFolder: 'Journal',
    });
  });

  it('handles deeply nested paths', () => {
    const notes = [noteWithPath('a', 'Projects/2026/Q2/plan.md')];
    expect(deriveTreeSelection('a', notes)).toEqual({
      selectedFile: 'Projects/2026/Q2/plan.md',
      activeFolder: 'Projects/2026/Q2',
    });
  });

  it('returns a null folder for a file at the workspace root', () => {
    const notes = [noteWithPath('a', 'readme.md')];
    expect(deriveTreeSelection('a', notes)).toEqual({
      selectedFile: 'readme.md',
      activeFolder: null,
    });
  });

  it('normalizes windows-style paths', () => {
    const notes = [noteWithPath('a', 'Journal\\2026-04-21.md')];
    expect(deriveTreeSelection('a', notes)).toEqual({
      selectedFile: 'Journal/2026-04-21.md',
      activeFolder: 'Journal',
    });
  });
});
