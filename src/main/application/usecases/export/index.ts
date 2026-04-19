import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import type { IExporter } from '../../../domain/ports/out/IExporter';
import type { IExportUseCases } from '../../../domain/ports/in/IExportUseCases';
import { ExportHtmlUseCase } from './ExportHtmlUseCase';
import { ExportPdfUseCase } from './ExportPdfUseCase';
import { ExportMarkdownUseCase } from './ExportMarkdownUseCase';

export { ExportHtmlUseCase } from './ExportHtmlUseCase';
export { ExportPdfUseCase } from './ExportPdfUseCase';
export { ExportMarkdownUseCase } from './ExportMarkdownUseCase';

export interface ExportUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  markdownProcessor: IMarkdownProcessor;
  exporter: IExporter;
}

export function createExportUseCases(deps: ExportUseCasesDeps): IExportUseCases {
  const { noteRepository, workspaceRepository, fileStorage, markdownProcessor, exporter } = deps;

  return {
    exportHtml: new ExportHtmlUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      markdownProcessor,
      exporter,
    ),
    exportPdf: new ExportPdfUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      markdownProcessor,
      exporter,
    ),
    exportMarkdown: new ExportMarkdownUseCase(noteRepository, workspaceRepository, fileStorage),
  };
}
