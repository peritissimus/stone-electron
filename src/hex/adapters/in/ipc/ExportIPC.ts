/**
 * Export IPC Adapter - Handles note export IPC channels
 */

import { ipcMain } from 'electron';
import type { IExportUseCases, ExportOptions } from '../../../domain/ports/in/IExportUseCases';
import { logger } from '../../../shared/utils';

const CHANNELS = {
  EXPORT_HTML: 'notes:exportHtml',
  EXPORT_PDF: 'notes:exportPdf',
  EXPORT_MARKDOWN: 'notes:exportMarkdown',
} as const;

export interface ExportIPCDeps {
  exportUseCases: IExportUseCases;
}

export function registerExportHandlers(deps: ExportIPCDeps): void {
  const { exportUseCases } = deps;

  ipcMain.handle(
    CHANNELS.EXPORT_HTML,
    async (_, noteId: string, options?: ExportOptions) => {
      try {
        logger.info('[IPC] notes:exportHtml', { noteId, options });
        const result = await exportUseCases.exportHtml.execute(noteId, options);
        return {
          success: true,
          data: {
            content: result.content.toString(),
            filename: result.filename,
            mimeType: result.mimeType,
          },
        };
      } catch (error) {
        logger.error('[IPC] notes:exportHtml error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANNELS.EXPORT_PDF,
    async (_, noteId: string, options?: ExportOptions) => {
      try {
        logger.info('[IPC] notes:exportPdf', { noteId, options });
        const result = await exportUseCases.exportPdf.execute(noteId, options);
        return {
          success: true,
          data: {
            // PDF is binary, encode as base64 for IPC
            content: Buffer.isBuffer(result.content)
              ? result.content.toString('base64')
              : result.content,
            filename: result.filename,
            mimeType: result.mimeType,
            isBase64: Buffer.isBuffer(result.content),
          },
        };
      } catch (error) {
        logger.error('[IPC] notes:exportPdf error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANNELS.EXPORT_MARKDOWN,
    async (_, noteId: string, options?: ExportOptions) => {
      try {
        logger.info('[IPC] notes:exportMarkdown', { noteId, options });
        const result = await exportUseCases.exportMarkdown.execute(noteId, options);
        return {
          success: true,
          data: {
            content: result.content.toString(),
            filename: result.filename,
            mimeType: result.mimeType,
          },
        };
      } catch (error) {
        logger.error('[IPC] notes:exportMarkdown error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  logger.info('[IPC] Export handlers registered');
}

export function unregisterExportHandlers(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
