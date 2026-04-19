/**
 * ExportUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExportUseCases } from '../../../../src/main/application/usecases/export';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../../../src/main/domain/ports/out/IMarkdownProcessor';
import type { IExporter } from '../../../../src/main/domain/ports/out/IExporter';
import type { IExportUseCases } from '../../../../src/main/domain/ports/in/IExportUseCases';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';

// Mock factories
function createMockNoteRepository(): INoteRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as unknown as INoteRepository;
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

function createMockMarkdownProcessor(): IMarkdownProcessor {
  return {
    htmlToMarkdown: vi.fn(),
    markdownToHtml: vi.fn(),
    extractPlainText: vi.fn(),
  } as unknown as IMarkdownProcessor;
}

function createMockExporter(): IExporter {
  return {
    isPdfAvailable: vi.fn(),
    generateHtmlDocument: vi.fn(),
    renderToPdf: vi.fn(),
  } as unknown as IExporter;
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

describe('ExportUseCases', () => {
  let noteRepo: INoteRepository;
  let workspaceRepo: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let markdownProcessor: IMarkdownProcessor;
  let exporter: IExporter;
  let useCases: IExportUseCases;

  beforeEach(() => {
    noteRepo = createMockNoteRepository();
    workspaceRepo = createMockWorkspaceRepository();
    fileStorage = createMockFileStorage();
    markdownProcessor = createMockMarkdownProcessor();
    exporter = createMockExporter();
    useCases = createExportUseCases({
      noteRepository: noteRepo,
      workspaceRepository: workspaceRepo,
      fileStorage,
      markdownProcessor,
      exporter,
    });
  });

  describe('exportHtml', () => {
    it('exports note as HTML', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('# Test Content');
      vi.mocked(markdownProcessor.markdownToHtml).mockResolvedValue('<h1>Test Content</h1>');
      vi.mocked(exporter.generateHtmlDocument).mockReturnValue(
        '<html><body><h1>Test Content</h1></body></html>',
      );

      const result = await useCases.exportHtml.execute('note-1');

      expect(result.mimeType).toBe('text/html');
      expect(result.filename).toBe('Test Note.html');
      expect(result.content).toContain('<html>');
    });

    it('exports note as HTML using pre-rendered content when provided', async () => {
      const note = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);

      const renderedHtml = '<html><body><h1>Rendered</h1></body></html>';
      const result = await useCases.exportHtml.execute('note-1', {
        renderedHtml,
        title: 'Custom Title',
      });

      expect(result.mimeType).toBe('text/html');
      expect(result.filename).toBe('Custom Title.html');
      expect(result.content).toBe(renderedHtml);
      expect(exporter.generateHtmlDocument).not.toHaveBeenCalled();
      expect(fileStorage.read).not.toHaveBeenCalled();
      expect(markdownProcessor.markdownToHtml).not.toHaveBeenCalled();
    });

    it('uses theme option when provided', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('# Content');
      vi.mocked(markdownProcessor.markdownToHtml).mockResolvedValue('<h1>Content</h1>');
      vi.mocked(exporter.generateHtmlDocument).mockReturnValue('<html></html>');

      await useCases.exportHtml.execute('note-1', { theme: 'dark' });

      expect(exporter.generateHtmlDocument).toHaveBeenCalledWith(
        '<h1>Content</h1>',
        expect.objectContaining({ theme: 'dark' }),
      );
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCases.exportHtml.execute('nonexistent')).rejects.toThrow(
        'Note not found: nonexistent',
      );
    });

    it('throws error when workspace not found', async () => {
      const note = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(null);

      await expect(useCases.exportHtml.execute('note-1')).rejects.toThrow(
        'Workspace not found: ws-1',
      );
    });

    it('throws error when file has no content', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue(null);

      await expect(useCases.exportHtml.execute('note-1')).rejects.toThrow(
        'Could not read note content',
      );
    });
  });

  describe('exportPdf', () => {
    it('exports note as PDF using pre-rendered HTML when provided', async () => {
      const pdfBuffer = Buffer.from('fake pdf content');
      vi.mocked(exporter.isPdfAvailable).mockReturnValue(true);
      vi.mocked(exporter.renderToPdf).mockResolvedValue(pdfBuffer);

      const result = await useCases.exportPdf.execute('note-1', {
        renderedHtml: '<html><body>Pre-rendered content with diagrams</body></html>',
        title: 'My Note',
      });

      expect(result.mimeType).toBe('application/pdf');
      expect(result.filename).toBe('My Note.pdf');
      expect(result.content).toBe(pdfBuffer);
      // Should use the pre-rendered HTML directly
      expect(exporter.renderToPdf).toHaveBeenCalledWith(
        '<html><body>Pre-rendered content with diagrams</body></html>',
        expect.any(Object),
      );
      // Should NOT read from file when pre-rendered HTML is provided
      expect(fileStorage.read).not.toHaveBeenCalled();
      expect(markdownProcessor.markdownToHtml).not.toHaveBeenCalled();
    });

    it('exports note as PDF by parsing markdown when no pre-rendered HTML provided', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      const pdfBuffer = Buffer.from('fake pdf content');
      vi.mocked(exporter.isPdfAvailable).mockReturnValue(true);
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('# Test Content');
      vi.mocked(markdownProcessor.markdownToHtml).mockResolvedValue('<h1>Test Content</h1>');
      vi.mocked(exporter.generateHtmlDocument).mockReturnValue('<html></html>');
      vi.mocked(exporter.renderToPdf).mockResolvedValue(pdfBuffer);

      const result = await useCases.exportPdf.execute('note-1');

      expect(result.mimeType).toBe('application/pdf');
      expect(result.filename).toBe('Test Note.pdf');
      expect(result.content).toBe(pdfBuffer);
    });

    it('throws error when PDF export is not available', async () => {
      vi.mocked(exporter.isPdfAvailable).mockReturnValue(false);

      await expect(useCases.exportPdf.execute('note-1')).rejects.toThrow(
        'PDF export is not available',
      );
    });

    it('throws error when note not found (fallback path)', async () => {
      vi.mocked(exporter.isPdfAvailable).mockReturnValue(true);
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCases.exportPdf.execute('nonexistent')).rejects.toThrow(
        'Note not found: nonexistent',
      );
    });
  });

  describe('exportMarkdown', () => {
    it('exports note as Markdown', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('# Test Content\n\nBody text');

      const result = await useCases.exportMarkdown.execute('note-1');

      expect(result.mimeType).toBe('text/markdown');
      expect(result.filename).toBe('Test Note.md');
      expect(result.content).toBe('# Test Content\n\nBody text');
    });

    it('includes frontmatter when option is set', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('# Test Content');

      const result = await useCases.exportMarkdown.execute('note-1', { includeFrontmatter: true });

      expect(result.content).toContain('---');
      expect(result.content).toContain('title: "Test Note"');
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCases.exportMarkdown.execute('nonexistent')).rejects.toThrow(
        'Note not found: nonexistent',
      );
    });

    it('throws error when workspace not found', async () => {
      const note = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(null);

      await expect(useCases.exportMarkdown.execute('note-1')).rejects.toThrow(
        'Workspace not found: ws-1',
      );
    });
  });
});
