import { describe, expect, it } from 'vitest';
import { WorkspaceDiffer } from '../../../../src/main/domain/services/WorkspaceDiffer';

describe('WorkspaceDiffer', () => {
  it('classifies added, modified, unchanged, and removed markdown files', () => {
    const older = new Date('2026-04-20T10:00:00');
    const newer = new Date('2026-04-21T10:00:00');

    expect(
      WorkspaceDiffer.diff(
        [
          { relativePath: 'added.md', modifiedAt: newer },
          { relativePath: 'modified.md', modifiedAt: newer },
          { relativePath: 'same.md', modifiedAt: older },
        ],
        [
          { id: 'modified-id', filePath: 'modified.md', updatedAt: older, isDeleted: false },
          { id: 'same-id', filePath: 'same.md', updatedAt: newer, isDeleted: false },
          { id: 'removed-id', filePath: 'removed.md', updatedAt: older, isDeleted: false },
          { id: 'deleted-id', filePath: 'deleted.md', updatedAt: older, isDeleted: true },
          { id: 'no-file-id', filePath: null, updatedAt: older, isDeleted: false },
        ],
      ),
    ).toEqual({
      added: [{ relativePath: 'added.md', modifiedAt: newer }],
      modified: [{ relativePath: 'modified.md', modifiedAt: newer, dbId: 'modified-id' }],
      unchanged: [{ relativePath: 'same.md', dbId: 'same-id' }],
      removed: [{ dbId: 'removed-id', filePath: 'removed.md' }],
    });
  });
});
