import path from 'node:path';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import type { IExporter } from '../../../domain/ports/out/IExporter';
import type {
  IExportHtmlUseCase,
  ExportOptions,
  ExportResult,
} from '../../../domain/ports/in/IExportUseCases';
import { logger } from '../../../shared/utils';

export class ExportHtmlUseCase implements IExportHtmlUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor,
    private readonly exporter: IExporter,
  ) {}

  async execute(noteId: string, options?: ExportOptions): Promise<ExportResult> {
    const note = await this.noteRepository.findById(noteId);
    if (!note || !note.filePath || !note.workspaceId) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const filename = `${options?.title || note.title || 'note'}.html`;

    if (options?.renderedHtml) {
      logger.info(`[ExportUseCases] Exported note ${noteId} to HTML (pre-rendered)`);
      return {
        content: options.renderedHtml,
        filename,
        mimeType: 'text/html',
      };
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

    logger.info(`[ExportUseCases] Exported note ${noteId} to HTML`);

    return {
      content: fullHtml,
      filename,
      mimeType: 'text/html',
    };
  }
}
