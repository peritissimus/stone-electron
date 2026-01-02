/**
 * NoteService Tests
 *
 * Focus on guarded paths and file update flows with heavy mocking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

const mockNoteRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  update: vi.fn(),
}));

const mockWorkspaceRepo = vi.hoisted(() => ({
  getActive: vi.fn(),
  findById: vi.fn(),
}));

vi.mock('../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    note: mockNoteRepo,
    workspace: mockWorkspaceRepo,
  })),
}));

const mockFileSystemService = vi.hoisted(() => ({
  fileExists: vi.fn(),
  scanFolder: vi.fn(),
  readMarkdownFile: vi.fn(),
  getFileStats: vi.fn(),
  writeMarkdownFile: vi.fn(),
  deleteMarkdownFile: vi.fn(),
  renameMarkdownFile: vi.fn(),
}));

vi.mock('../../src/main/services/FileSystemService', () => ({
  getFileSystemService: vi.fn(() => mockFileSystemService),
}));

const mockMarkdownService = vi.hoisted(() => ({
  markdownToHtml: vi.fn(async (md: string) => `<p>${md}</p>`),
  htmlToMarkdown: vi.fn(async (html: string) => html),
}));

vi.mock('../../src/main/services/MarkdownService', () => ({
  getMarkdownService: vi.fn(() => mockMarkdownService),
}));

vi.mock('../../src/main/database/DatabaseManager', () => ({
  getDatabaseManager: vi.fn(() => ({
    getDrizzle: vi.fn(() => ({})),
  })),
}));

import { getNoteService } from '../../src/main/services/NoteService';

describe('NoteService', () => {
  const noteService = getNoteService() as any;

  beforeEach(() => {
    vi.clearAllMocks();
    noteService.saveContentToFile = vi.fn();
    noteService.getContentFromFile = vi.fn();
    noteService.handleFolderChange = vi.fn(async () => null);
    noteService.getNoteTags = vi.fn(async () => []);
    noteService.setNoteTags = vi.fn();
  });

  it('returns null when note missing in getContent', async () => {
    mockNoteRepo.findById.mockResolvedValue(null);
    const result = await noteService.getContent('missing');
    expect(result).toBeNull();
  });

  it('loads content via file helper when file exists', async () => {
    mockNoteRepo.findById.mockResolvedValue({
      id: 'n1',
      filePath: 'note.md',
      workspaceId: 'ws',
    });
    noteService.getContentFromFile.mockResolvedValue('<p>content</p>');

    const result = await noteService.getContent('n1');
    expect(result).toBe('<p>content</p>');
    expect(noteService.getContentFromFile).toHaveBeenCalled();
  });

  it('throws when updating content for missing note', async () => {
    mockNoteRepo.findById.mockResolvedValue(null);
    await expect(noteService.updateContent('missing', 'c')).rejects.toThrow('Note not found');
  });

  it('saves content to file for existing note', async () => {
    mockNoteRepo.findById.mockResolvedValue({
      id: 'n1',
      filePath: 'file.md',
      workspaceId: 'ws',
      isFavorite: false,
      isPinned: false,
    });
    await noteService.updateContent('n1', 'body');
    expect(noteService.saveContentToFile).toHaveBeenCalledWith(
      'file.md',
      'ws',
      'body',
      expect.any(Object),
    );
  });

  it('updates note title and file content during updateNote', async () => {
    const originalNote = {
      id: 'n1',
      title: 'Old',
      filePath: 'file.md',
      workspaceId: 'ws',
      isFavorite: false,
      isPinned: false,
      isArchived: false,
    };

    mockNoteRepo.findById
      .mockResolvedValueOnce(originalNote)
      .mockResolvedValueOnce({ ...originalNote, title: 'New' });
    mockWorkspaceRepo.findById.mockResolvedValue({ id: 'ws', folderPath: '/tmp' });
    vi.spyOn(noteService, 'getContent').mockResolvedValue('old content');

    const result = await noteService.updateNote('n1', { title: 'New' });

    expect(noteService.saveContentToFile).toHaveBeenCalled();
    expect(mockNoteRepo.update).toHaveBeenCalledWith(
      'n1',
      expect.objectContaining({ updatedAt: expect.any(Date), title: 'New' }),
    );
    expect(result.title).toBe('New');
  });

  it('syncs content title and resolves image paths', () => {
    const withHeading = noteService.syncContentWithTitle('# Old\nBody', 'New');
    const withoutHeading = noteService.syncContentWithTitle('Body only', 'New');

    expect(withHeading.startsWith('# New')).toBe(true);
    expect(withoutHeading.startsWith('# New')).toBe(true);

    const resolved = noteService.resolveImagePaths('<img src=".assets/img.png">', '/workspace');
    expect(resolved).toContain('file:///workspace/.assets/img.png');
  });

  it('normalizes folder paths', () => {
    expect(noteService.normalizeFolderPath('/folder/')).toBe('folder');
    expect(noteService.normalizeFolderPath(undefined)).toBe('');
  });

  it('handles missing workspace when deleting markdown file', async () => {
    mockWorkspaceRepo.findById.mockResolvedValue(null);
    await noteService.deleteMarkdownFile('file.md', 'ws1');
    expect(mockWorkspaceRepo.findById).toHaveBeenCalledWith('ws1');
  });

  it('renames and deletes markdown files when workspace exists', async () => {
    mockWorkspaceRepo.findById.mockResolvedValue({ id: 'ws1', folderPath: '/root' });

    await noteService.deleteMarkdownFile('file.md', 'ws1');
    expect(mockFileSystemService.deleteMarkdownFile).toHaveBeenCalled();

    await noteService.renameMarkdownFile('old.md', 'new.md', 'ws1');
    expect(mockFileSystemService.renameMarkdownFile).toHaveBeenCalled();
  });

  it('invalidates content cache entries', () => {
    noteService.contentCache.set('n1', { content: 'x', timestamp: Date.now() });
    noteService.invalidateContentCache('n1');
    expect(noteService.contentCache.has('n1')).toBe(false);

    noteService.contentCache.set('n2', { content: 'y', timestamp: Date.now() });
    noteService.invalidateContentCache();
    expect(noteService.contentCache.size).toBe(0);
  });

  it('creates a note with generated filename and tags', async () => {
    mockWorkspaceRepo.getActive.mockResolvedValue({ id: 'ws1', folderPath: '/root' });
    noteService.resolveTargetFolder = vi.fn(async () => '');
    noteService.generateNoteFilename = vi.fn(async () => 'new.md');
    mockNoteRepo.create = vi.fn();
    mockNoteRepo.findById = vi.fn().mockResolvedValue({
      id: 'n-created',
      title: 'New',
      filePath: 'new.md',
      workspaceId: 'ws1',
    });
    noteService.setNoteTags = vi.fn();
    noteService.getNoteTags = vi.fn(async () => [{ id: 't1', name: 'tag', color: null }]);
    noteService.emitNoteCreated = vi.fn();

    const result = await noteService.createNote({ title: 'New', tags: ['tag'] });

    expect(noteService.saveContentToFile).toHaveBeenCalledWith(
      'new.md',
      'ws1',
      expect.stringContaining('New'),
      expect.objectContaining({ favorite: undefined, pinned: undefined }),
    );
    expect(noteService.setNoteTags).toHaveBeenCalledWith(expect.any(String), ['tag']);
    expect(result.tags?.[0].name).toBe('tag');
  });

  it('returns empty string when raw content missing', async () => {
    mockNoteRepo.findById.mockResolvedValue({
      id: 'n1',
      filePath: null,
      workspaceId: null,
    });

    const result = await noteService.getRawContent('n1');
    expect(result).toBe('');
  });
});
