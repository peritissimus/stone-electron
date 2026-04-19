import path from 'node:path';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import type { IExporter } from '../../../domain/ports/out/IExporter';
import type {
  IExportPdfUseCase,
  ExportOptions,
  ExportResult,
} from '../../../domain/ports/in/IExportUseCases';
import { logger } from '../../../shared/utils';

export class ExportPdfUseCase implements IExportPdfUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor,
    private readonly exporter: IExporter,
  ) {}

  async execute(noteId: string, options?: ExportOptions): Promise<ExportResult> {
    if (!this.exporter.isPdfAvailable()) {
      throw new Error('PDF export is not available');
    }

    // If pre-rendered HTML is provided from the renderer, use it directly
    // This preserves Mermaid diagrams, syntax highlighting, and applied styles
    if (options?.renderedHtml) {
      const pdfBuffer = await this.exporter.renderToPdf(options.renderedHtml, {
        format: 'A4',
        printBackground: true,
      });

      const filename = `${options.title || 'note'}.pdf`;

      logger.info(`[ExportUseCases] Exported note ${noteId} to PDF (using pre-rendered HTML)`);

      return {
        content: pdfBuffer,
        filename,
        mimeType: 'application/pdf',
      };
    }

    // Fallback: re-parse markdown (for API/non-UI exports)
    const note = await this.noteRepository.findById(noteId);
    if (!note || !note.filePath || !note.workspaceId) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const workspace = await this.workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    const absolutePath = path.join(workspace.folderPath, note.filePath);
    const markdown = await this.fileStorage.read(absolutePath);
    if (!markdown) {
      throw new Error('Could not read note content');
    }

    const html = await this.markdownProcessor.markdownToHtml(markdown);
    const fullHtml = this.exporter.generateHtmlDocument(html, {
      title: note.title || 'Untitled',
      theme: options?.theme || 'light',
      includeStyles: true,
    });

    const pdfBuffer = await this.exporter.renderToPdf(fullHtml, {
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
