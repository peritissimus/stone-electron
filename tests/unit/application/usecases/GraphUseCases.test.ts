/**
 * GraphUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGraphUseCases } from '../../../../src/main/application/usecases/GraphUseCases';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { INoteLinkRepository } from '../../../../src/main/domain/ports/out/INoteLinkRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IGraphUseCases } from '../../../../src/main/domain/ports/in/IGraphUseCases';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import type { NoteLinkProps } from '../../../../src/main/domain/entities/NoteLink';

// Mock factories
function createMockNoteRepository(): INoteRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as unknown as INoteRepository;
}

function createMockNoteLinkRepository(): INoteLinkRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    getBacklinks: vi.fn(),
    getForwardLinks: vi.fn(),
    deleteFromNote: vi.fn(),
  } as unknown as INoteLinkRepository;
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

function createNoteLinkProps(overrides: Partial<NoteLinkProps> = {}): NoteLinkProps {
  return {
    sourceNoteId: 'note-1',
    targetNoteId: 'note-2',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('GraphUseCases', () => {
  let noteRepo: INoteRepository;
  let noteLinkRepo: INoteLinkRepository;
  let workspaceRepo: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let useCases: IGraphUseCases;

  beforeEach(() => {
    noteRepo = createMockNoteRepository();
    noteLinkRepo = createMockNoteLinkRepository();
    workspaceRepo = createMockWorkspaceRepository();
    fileStorage = createMockFileStorage();
    useCases = createGraphUseCases({
      noteRepository: noteRepo,
      noteLinkRepository: noteLinkRepo,
      workspaceRepository: workspaceRepo,
      fileStorage,
    });
  });

  describe('getBacklinks', () => {
    it('returns notes that link to the given note', async () => {
      const targetNote = createNoteProps({ id: 'target' });
      const sourceNotes = [
        createNoteProps({ id: 'source-1', title: 'Source 1' }),
        createNoteProps({ id: 'source-2', title: 'Source 2' }),
      ];
      vi.mocked(noteRepo.findById).mockResolvedValue(targetNote);
      vi.mocked(noteLinkRepo.getBacklinks).mockResolvedValue(sourceNotes);

      const result = await useCases.getBacklinks.execute('target');

      expect(result).toHaveLength(2);
      expect(result[0].sourceId).toBe('source-1');
      expect(result[0].targetId).toBe('target');
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCases.getBacklinks.execute('nonexistent')).rejects.toThrow(
        'Note not found: nonexistent',
      );
    });
  });

  describe('getForwardLinks', () => {
    it('returns notes that the given note links to', async () => {
      const sourceNote = createNoteProps({ id: 'source' });
      const targetNotes = [
        createNoteProps({ id: 'target-1', title: 'Target 1' }),
        createNoteProps({ id: 'target-2', title: 'Target 2' }),
      ];
      vi.mocked(noteRepo.findById).mockResolvedValue(sourceNote);
      vi.mocked(noteLinkRepo.getForwardLinks).mockResolvedValue(targetNotes);

      const result = await useCases.getForwardLinks.execute('source');

      expect(result).toHaveLength(2);
      expect(result[0].sourceId).toBe('source');
      expect(result[0].targetId).toBe('target-1');
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCases.getForwardLinks.execute('nonexistent')).rejects.toThrow(
        'Note not found: nonexistent',
      );
    });
  });

  describe('getGraphData', () => {
    it('returns graph data for all notes', async () => {
      const workspace = createWorkspaceProps();
      const notes = [
        createNoteProps({ id: 'note-1', title: 'Note 1' }),
        createNoteProps({ id: 'note-2', title: 'Note 2' }),
      ];
      const links = [createNoteLinkProps({ sourceNoteId: 'note-1', targetNoteId: 'note-2' })];
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findAll).mockResolvedValue(notes);
      vi.mocked(noteLinkRepo.findAll).mockResolvedValue(links);

      const result = await useCases.getGraphData.execute();

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    it('returns empty data when no active workspace', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);

      const result = await useCases.getGraphData.execute();

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('excludes orphan notes when includeOrphans is false', async () => {
      const workspace = createWorkspaceProps();
      const notes = [
        createNoteProps({ id: 'note-1', title: 'Linked Note' }),
        createNoteProps({ id: 'note-2', title: 'Orphan Note' }),
      ];
      const links = [createNoteLinkProps({ sourceNoteId: 'note-1', targetNoteId: 'note-1' })];
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findAll).mockResolvedValue(notes);
      vi.mocked(noteLinkRepo.findAll).mockResolvedValue(links);

      const result = await useCases.getGraphData.execute({ includeOrphans: false });

      expect(result.nodes.find((n) => n.id === 'note-2')).toBeUndefined();
    });

    it('includes orphan notes when includeOrphans is true', async () => {
      const workspace = createWorkspaceProps();
      const notes = [
        createNoteProps({ id: 'note-1', title: 'Linked Note' }),
        createNoteProps({ id: 'note-2', title: 'Orphan Note' }),
      ];
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findAll).mockResolvedValue(notes);
      vi.mocked(noteLinkRepo.findAll).mockResolvedValue([]);

      const result = await useCases.getGraphData.execute({ includeOrphans: true });

      expect(result.nodes).toHaveLength(2);
    });

    it('limits to depth when centerNoteId is provided', async () => {
      const workspace = createWorkspaceProps();
      const notes = [
        createNoteProps({ id: 'center', title: 'Center' }),
        createNoteProps({ id: 'near', title: 'Near' }),
        createNoteProps({ id: 'far', title: 'Far' }),
      ];
      const links = [
        createNoteLinkProps({ sourceNoteId: 'center', targetNoteId: 'near' }),
        createNoteLinkProps({ sourceNoteId: 'near', targetNoteId: 'far' }),
      ];
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findAll).mockResolvedValue(notes);
      vi.mocked(noteLinkRepo.findAll).mockResolvedValue(links);

      const result = await useCases.getGraphData.execute({ centerNoteId: 'center', depth: 1 });

      expect(result.nodes.some((n) => n.id === 'center')).toBe(true);
      expect(result.nodes.some((n) => n.id === 'near')).toBe(true);
      expect(result.nodes.some((n) => n.id === 'far')).toBe(false);
    });
  });

  describe('updateNoteLinks', () => {
    it('extracts and saves links from content', async () => {
      const note = createNoteProps();
      const targetNote = createNoteProps({ id: 'target', title: 'Target Note' });
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(noteLinkRepo.deleteFromNote).mockResolvedValue(undefined);
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findAll).mockResolvedValue([note, targetNote]);
      vi.mocked(noteLinkRepo.save).mockResolvedValue(undefined);

      await useCases.updateNoteLinks.execute('note-1', '[[Target Note]] is linked');

      expect(noteLinkRepo.deleteFromNote).toHaveBeenCalledWith('note-1');
      expect(noteLinkRepo.save).toHaveBeenCalled();
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(
        useCases.updateNoteLinks.execute('nonexistent', 'content'),
      ).rejects.toThrow('Note not found: nonexistent');
    });

    it('does nothing when no active workspace', async () => {
      const note = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(noteLinkRepo.deleteFromNote).mockResolvedValue(undefined);
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);

      await useCases.updateNoteLinks.execute('note-1', '[[Some Link]]');

      expect(noteLinkRepo.save).not.toHaveBeenCalled();
    });
  });
});
