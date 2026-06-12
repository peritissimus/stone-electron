import { describe, expect, it } from 'vitest';
import { VersionDiffer } from '../../../../src/main/domain/services/VersionDiffer';

describe('VersionDiffer', () => {
  it('builds canonical ids, checks ownership, and projects snapshots', () => {
    const createdAt = new Date('2026-04-21T10:00:00');
    const version = {
      id: 'note-1-v2',
      noteId: 'note-1',
      versionNumber: 2,
      content: '# Body',
      title: 'Body',
      createdAt,
    };

    expect(VersionDiffer.buildVersionId('note-1', 2)).toBe('note-1-v2');
    expect(VersionDiffer.belongsToNote(version, 'note-1')).toBe(true);
    expect(VersionDiffer.belongsToNote(version, 'other')).toBe(false);
    expect(VersionDiffer.toSnapshot(version)).toEqual(version);
  });
});
