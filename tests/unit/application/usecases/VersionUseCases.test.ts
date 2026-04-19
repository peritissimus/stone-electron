/**
 * VersionUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVersionUseCases } from '../../../../src/main/application/usecases/version';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IVersionRepository } from '../../../../src/main/domain/ports/out/IVersionRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IVersionUseCases } from '../../../../src/main/domain/ports/in/IVersionUseCases';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import type { VersionProps } from '../../../../src/main/domain/entities/Version';

// Mock factories
function createMockNoteRepository(): INoteRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as unknown as INoteRepository;
}

function createMockVersionRepository(): IVersionRepository {
  return {
    findById: vi.fn(),
    findByNoteId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    getNextVersionNumber: vi.fn(),
  } as unknown as IVersionRepository;
}

function createMockWorkspaceRepository(): IWorkspaceRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as unknown as IWorkspaceRepository;
}

function createMockFileStorage(): IFileStorage {
  return {
    read: vi.fn(),
    write: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
  } as unknown as IFileStorage;
}

function createNoteProps(overrides: Partial<NoteProps> = {}): NoteProps {
  return {
    id: 'note-1',
    title: 'Test Note',
    filePath: 'test.md',
    notebookId: null,
    workspaceId: 'ws-1',
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

function createWorkspaceProps(overrides: Partial<WorkspaceProps> = {}): WorkspaceProps {
  return {
    id: 'ws-1',
    name: 'Test Workspace',
    folderPath: '/test/workspace',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    lastAccessedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

function createVersionProps(overrides: Partial<VersionProps> = {}): VersionProps {
  return {
    id: 'version-1',
    noteId: 'note-1',
    versionNumber: 1,
    content: '# Test Content',
    title: 'Test Note',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('VersionUseCases', () => {
  let noteRepo: INoteRepository;
  let versionRepo: IVersionRepository;
  let workspaceRepo: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let useCases: IVersionUseCases;

  beforeEach(() => {
    noteRepo = createMockNoteRepository();
    versionRepo = createMockVersionRepository();
    workspaceRepo = createMockWorkspaceRepository();
    fileStorage = createMockFileStorage();
    useCases = createVersionUseCases({
      noteRepository: noteRepo,
      versionRepository: versionRepo,
      workspaceRepository: workspaceRepo,
      fileStorage,
    });
  });

  describe('getVersions', () => {
    it('returns version history for note', async () => {
      const note = createNoteProps();
      const versions = [
        createVersionProps({ id: 'v1', versionNumber: 1 }),
        createVersionProps({ id: 'v2', versionNumber: 2 }),
      ];
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(versionRepo.findByNoteId).mockResolvedValue(versions);

      const result = await useCases.getVersions.execute('note-1');

      expect(result).toHaveLength(2);
      expect(result[0].versionNumber).toBe(1);
      expect(result[1].versionNumber).toBe(2);
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCases.getVersions.execute('nonexistent')).rejects.toThrow(
        'Note not found: nonexistent',
      );
    });

    it('returns empty array when no versions', async () => {
      const note = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(versionRepo.findByNoteId).mockResolvedValue([]);

      const result = await useCases.getVersions.execute('note-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('createVersion', () => {
    it('creates new version snapshot', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('# Current content');
      vi.mocked(versionRepo.getNextVersionNumber).mockResolvedValue(1);
      vi.mocked(versionRepo.save).mockResolvedValue(undefined);

      const result = await useCases.createVersion.execute('note-1');

      expect(result.noteId).toBe('note-1');
      expect(result.versionNumber).toBe(1);
      expect(result.content).toBe('# Current content');
      expect(versionRepo.save).toHaveBeenCalled();
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCases.createVersion.execute('nonexistent')).rejects.toThrow(
        'Note not found: nonexistent',
      );
    });

    it('throws error when note has no file path', async () => {
      const note = createNoteProps({ filePath: null });
      vi.mocked(noteRepo.findById).mockResolvedValue(note);

      await expect(useCases.createVersion.execute('note-1')).rejects.toThrow(
        'Note has no file path',
      );
    });

    it('throws error when workspace not found', async () => {
      const note = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(null);

      await expect(useCases.createVersion.execute('note-1')).rejects.toThrow(
        'Workspace not found: ws-1',
      );
    });

    it('uses Untitled when note has no title', async () => {
      const note = createNoteProps({ title: null as unknown as string });
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('content');
      vi.mocked(versionRepo.getNextVersionNumber).mockResolvedValue(1);
      vi.mocked(versionRepo.save).mockResolvedValue(undefined);

      const result = await useCases.createVersion.execute('note-1');

      expect(result.title).toBe('Untitled');
    });
  });

  describe('restoreVersion', () => {
    it('restores note to specific version', async () => {
      const note = createNoteProps();
      const version = createVersionProps({ content: '# Restored content', title: 'Old Title' });
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(versionRepo.findById).mockResolvedValue(version);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      await useCases.restoreVersion.execute('note-1', 'version-1');

      expect(fileStorage.write).toHaveBeenCalledWith(
        '/test/workspace/test.md',
        '# Restored content',
      );
      expect(noteRepo.save).toHaveBeenCalled();
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCases.restoreVersion.execute('nonexistent', 'v1')).rejects.toThrow(
        'Note not found: nonexistent',
      );
    });

    it('throws error when version not found', async () => {
      const note = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(versionRepo.findById).mockResolvedValue(null);

      await expect(useCases.restoreVersion.execute('note-1', 'nonexistent')).rejects.toThrow(
        'Version not found: nonexistent',
      );
    });

    it('throws error when version belongs to different note', async () => {
      const note = createNoteProps();
      const version = createVersionProps({ noteId: 'other-note' });
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(versionRepo.findById).mockResolvedValue(version);

      await expect(useCases.restoreVersion.execute('note-1', 'version-1')).rejects.toThrow(
        'Version not found: version-1',
      );
    });
  });

  describe('getVersion', () => {
    it('returns version when found', async () => {
      const version = createVersionProps();
      vi.mocked(versionRepo.findById).mockResolvedValue(version);

      const result = await useCases.getVersion.execute('version-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('version-1');
      expect(result?.versionNumber).toBe(1);
    });

    it('returns null when version not found', async () => {
      vi.mocked(versionRepo.findById).mockResolvedValue(null);

      const result = await useCases.getVersion.execute('nonexistent');

      expect(result).toBeNull();
    });
  });
});
