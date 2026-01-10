/**
 * Export IPC Adapter - Handles note export IPC channels
 */

import { ipcMain } from 'electron';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IExportUseCases, ExportOptions } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface ExportIPCDeps {
  exportUseCases: IExportUseCases;
}

export function registerExportHandlers(deps: ExportIPCDeps): void {
  const { exportUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>) =>
    handleIpcRequest(fn, { loggerPrefix: 'ExportIPC', defaultCode: 'INTERNAL_ERROR' });

  ipcMain.handle(
    NOTE_CHANNELS.EXPORT_HTML,
    async (_, { id, options }: { id: string; options?: ExportOptions }) => {
      return handleRequest(async () => {
        logger.info('[IPC] notes:exportHtml', { noteId: id, options });
        const result = await exportUseCases.exportHtml.execute(id, options);
        return {
          content: result.content.toString(),
          filename: result.filename,
          mimeType: result.mimeType,
        };
      });
    },
  );

  ipcMain.handle(
    NOTE_CHANNELS.EXPORT_PDF,
    async (_, { id, options }: { id: string; options?: ExportOptions }) => {
      return handleRequest(async () => {
        logger.info('[IPC] notes:exportPdf', { noteId: id, options });
        const result = await exportUseCases.exportPdf.execute(id, options);
        return {
          content: Buffer.isBuffer(result.content)
            ? result.content.toString('base64')
            : result.content,
          filename: result.filename,
          mimeType: result.mimeType,
          isBase64: Buffer.isBuffer(result.content),
        };
      });
    },
  );

  ipcMain.handle(
    NOTE_CHANNELS.EXPORT_MARKDOWN,
    async (_, { id, options }: { id: string; options?: ExportOptions }) => {
      return handleRequest(async () => {
        logger.info('[IPC] notes:exportMarkdown', { noteId: id, options });
        const result = await exportUseCases.exportMarkdown.execute(id, options);
        return {
          content: result.content.toString(),
          filename: result.filename,
          mimeType: result.mimeType,
        };
      });
    },
  );

  logger.info('[IPC] Export handlers registered');
}

export function unregisterExportHandlers(): void {
  [NOTE_CHANNELS.EXPORT_HTML, NOTE_CHANNELS.EXPORT_PDF, NOTE_CHANNELS.EXPORT_MARKDOWN].forEach(
    (channel) => {
      ipcMain.removeHandler(channel);
    },
  );
}
