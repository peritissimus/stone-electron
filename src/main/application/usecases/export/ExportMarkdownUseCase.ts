import path from 'node:path';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type {
  IExportMarkdownUseCase,
  ExportOptions,
  ExportResult,
} from '../../../domain/ports/in/IExportUseCases';
import { logger } from '../../../shared/utils';

export class ExportMarkdownUseCase implements IExportMarkdownUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(noteId: string, options?: ExportOptions): Promise<ExportResult> {
    const note = await this.noteRepository.findById(noteId);
    if (!note || !note.filePath || !note.workspaceId) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const workspace = await this.workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    const absolutePath = path.join(workspace.folderPath, note.filePath);
    let markdown = await this.fileStorage.read(absolutePath);
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
