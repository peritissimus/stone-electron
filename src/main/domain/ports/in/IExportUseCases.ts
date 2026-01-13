/**
 * Export Use Case Ports - Inbound interfaces for note export operations
 */

/**
 * Export options
 */
export interface ExportOptions {
  includeMetadata?: boolean;
  includeFrontmatter?: boolean;
  theme?: 'light' | 'dark';
  /** Pre-rendered HTML from the renderer (with diagrams, styles, fonts already applied) */
  renderedHtml?: string;
  /** Note title for the export filename */
  title?: string;
}

/**
 * Export result
 */
export interface ExportResult {
  content: string | Buffer;
  filename: string;
  mimeType: string;
}

/**
 * Export note as HTML
 */
export interface IExportHtmlUseCase {
  execute(noteId: string, options?: ExportOptions): Promise<ExportResult>;
}

/**
 * Export note as PDF
 */
export interface IExportPdfUseCase {
  execute(noteId: string, options?: ExportOptions): Promise<ExportResult>;
}

/**
 * Export note as Markdown
 */
export interface IExportMarkdownUseCase {
  execute(noteId: string, options?: ExportOptions): Promise<ExportResult>;
}

/**
 * Aggregated export use cases
 */
export interface IExportUseCases {
  exportHtml: IExportHtmlUseCase;
  exportPdf: IExportPdfUseCase;
  exportMarkdown: IExportMarkdownUseCase;
}
