/**
 * Export Use Cases - Note export to various formats
 */

import type { INoteRepository } from '../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../domain/ports/out/IMarkdownProcessor';
import type { IExportService } from '../../domain/ports/out/IExportService';
import type {
  IExportUseCases,
  IExportHtmlUseCase,
  IExportPdfUseCase,
  IExportMarkdownUseCase,
  ExportOptions,
  ExportResult,
} from '../../domain/ports/in/IExportUseCases';
import { logger } from '../../shared/utils';
import path from 'node:path';

export interface ExportUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  markdownProcessor: IMarkdownProcessor;
  exportService: IExportService;
}

class ExportHtmlUseCase implements IExportHtmlUseCase {
  constructor(private deps: ExportUseCasesDeps) {}

  async execute(noteId: string, options?: ExportOptions): Promise<ExportResult> {
    const { noteRepository, workspaceRepository, fileStorage, markdownProcessor, exportService } =
      this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note || !note.filePath || !note.workspaceId) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const workspace = await workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    const absolutePath = path.join(workspace.folderPath, note.filePath);
    const markdown = await fileStorage.read(absolutePath);
    if (!markdown) {
      throw new Error('Could not read note content');
    }

    const html = await markdownProcessor.markdownToHtml(markdown);
    const fullHtml = exportService.generateHtmlDocument(html, {
      title: note.title || 'Untitled',
      theme: options?.theme || 'light',
      includeStyles: true,
    });

    const filename = `${note.title || 'note'}.html`;

    logger.info(`[ExportUseCases] Exported note ${noteId} to HTML`);

    return {
      content: fullHtml,
      filename,
      mimeType: 'text/html',
    };
  }
}

class ExportPdfUseCase implements IExportPdfUseCase {
  constructor(private deps: ExportUseCasesDeps) {}

  async execute(noteId: string, options?: ExportOptions): Promise<ExportResult> {
    const { noteRepository, workspaceRepository, fileStorage, markdownProcessor, exportService } =
      this.deps;

    if (!exportService.isPdfAvailable()) {
      throw new Error('PDF export is not available');
    }

    const note = await noteRepository.findById(noteId);
    if (!note || !note.filePath || !note.workspaceId) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const workspace = await workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    const absolutePath = path.join(workspace.folderPath, note.filePath);
    const markdown = await fileStorage.read(absolutePath);
    if (!markdown) {
      throw new Error('Could not read note content');
    }

    const html = await markdownProcessor.markdownToHtml(markdown);
    const fullHtml = exportService.generateHtmlDocument(html, {
      title: note.title || 'Untitled',
      theme: options?.theme || 'light',
      includeStyles: true,
    });

    const pdfBuffer = await exportService.renderToPdf(fullHtml, {
      format: 'A4',
      printBackground: true,
    });

    const filename = `${note.title || 'note'}.pdf`;

    logger.info(`[ExportUseCases] Exported note ${noteId} to PDF`);

    return {
      content: pdfBuffer,
      filename,
      mimeType: 'application/pdf',
    };
  }
}

class ExportMarkdownUseCase implements IExportMarkdownUseCase {
  constructor(private deps: ExportUseCasesDeps) {}

  async execute(noteId: string, options?: ExportOptions): Promise<ExportResult> {
    const { noteRepository, workspaceRepository, fileStorage, markdownProcessor } = this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note || !note.filePath || !note.workspaceId) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const workspace = await workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    const absolutePath = path.join(workspace.folderPath, note.filePath);
    let markdown = await fileStorage.read(absolutePath);
    if (!markdown) {
      throw new Error('Could not read note content');
    }

    // Optionally add frontmatter
    if (options?.includeFrontmatter) {
      const frontmatter = [
        '---',
        `title: "${note.title || 'Untitled'}"`,
        `created: ${note.createdAt.toISOString()}`,
        `updated: ${note.updatedAt.toISOString()}`,
        '---',
        '',
      ].join('\n');

      markdown = frontmatter + markdown;
    }

    const filename = `${note.title || 'note'}.md`;

    logger.info(`[ExportUseCases] Exported note ${noteId} to Markdown`);

    return {
      content: markdown,
      filename,
      mimeType: 'text/markdown',
    };
  }
}

export function createExportUseCases(deps: ExportUseCasesDeps): IExportUseCases {
  return {
    exportHtml: new ExportHtmlUseCase(deps),
    exportPdf: new ExportPdfUseCase(deps),
    exportMarkdown: new ExportMarkdownUseCase(deps),
  };
}
