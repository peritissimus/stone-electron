/**
 * ExportService - Note export functionality
 *
 * Handles content preparation for export. Dialog interaction
 * remains in IPC handlers since it requires window context.
 */

import { getNoteService } from './NoteService';
import { logger } from '../utils/logger';

export interface ExportResult {
  content: string;
  title: string;
}

/**
 * ExportService prepares content for export
 */
class ExportService {
  // ==========================================================================
  // Content Preparation
  // ==========================================================================

  /**
   * Prepare HTML export content
   */
  async prepareHtmlExport(noteId: string, content: string, title: string): Promise<string> {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title || 'Untitled')}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
    h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    p { margin: 1em 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'SF Mono', Monaco, monospace; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding-left: 1em; color: #666; }
    ul, ol { margin: 1em 0; padding-left: 2em; }
    li { margin: 0.25em 0; }
    a { color: #0066cc; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
    hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
    .task-list-item { list-style: none; margin-left: -1.5em; }
    .task-list-item input { margin-right: 0.5em; }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(title || 'Untitled')}</h1>
  ${content}
</body>
</html>`;

    logger.debug(`[ExportService] Prepared HTML export for note ${noteId}`);
    return htmlContent;
  }

  /**
   * Get raw markdown content for export
   */
  async getMarkdownForExport(noteId: string): Promise<string | null> {
    const noteService = getNoteService();
    const content = await noteService.getRawContent(noteId);

    if (!content) {
      logger.warn(`[ExportService] No content found for note ${noteId}`);
      return null;
    }

    logger.debug(`[ExportService] Retrieved markdown for export: ${noteId}`);
    return content;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return text.replaceAll(/[&<>"']/g, (char) => htmlEntities[char] || char);
  }
}

// Singleton instance
let instance: ExportService | null = null;

export function getExportService(): ExportService {
  instance ??= new ExportService();
  return instance;
}
