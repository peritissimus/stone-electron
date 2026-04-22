/**
 * Export IPC Adapter - Handles note export IPC channels
 */

import { ipcMain, dialog, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import {
  ExportHtmlRequestSchema,
  ExportMarkdownRequestSchema,
  ExportPdfRequestSchema,
  type ExportHtmlResponse,
  type ExportMarkdownResponse,
  type ExportPdfResponse,
} from '@shared/schemas';
import type { IExportUseCases, ExportOptions } from '../../../domain';
import { COMMON_IPC_ERROR_MAP, handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface ExportIPCDeps {
  exportUseCases: IExportUseCases;
}

export function registerExportHandlers(deps: ExportIPCDeps): void {
  const { exportUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest<T>(fn, {
      loggerPrefix: 'ExportIPC',
      defaultCode: 'INTERNAL_ERROR',
      errorMap: { ...COMMON_IPC_ERROR_MAP },
      context,
    });

  ipcMain.handle(NOTE_CHANNELS.EXPORT_HTML, async (_event, rawRequest) => {
    const { id, renderedHtml, title, options } = ExportHtmlRequestSchema.parse(rawRequest);
    return handleRequest<ExportHtmlResponse>(
      async () => {
        const result = await exportUseCases.exportHtml.execute(id, {
          ...(options as ExportOptions | undefined),
          renderedHtml,
          title,
        });
        const htmlContent = result.content.toString();

        const { filePath, canceled } = await dialog.showSaveDialog({
          title: 'Export as HTML',
          defaultPath: path.join(app.getPath('documents'), result.filename),
          filters: [{ name: 'HTML Files', extensions: ['html'] }],
        });

        if (canceled || !filePath) {
          return { html: htmlContent, path: '' };
        }

        fs.writeFileSync(filePath, htmlContent, 'utf-8');
        logger.info('[ExportIPC] Saved HTML to:', filePath);

        return { html: htmlContent, path: filePath };
      },
      { channel: NOTE_CHANNELS.EXPORT_HTML, noteId: id },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.EXPORT_PDF, async (_event, rawRequest) => {
    const { id, renderedHtml, title, options } = ExportPdfRequestSchema.parse(rawRequest);
    return handleRequest<ExportPdfResponse>(
      async () => {
        const result = await exportUseCases.exportPdf.execute(id, {
          ...(options as ExportOptions | undefined),
          renderedHtml,
          title,
        });
        const pdfBuffer = Buffer.isBuffer(result.content)
          ? result.content
          : Buffer.from(result.content);

        const { filePath, canceled } = await dialog.showSaveDialog({
          title: 'Export as PDF',
          defaultPath: path.join(app.getPath('documents'), result.filename),
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        });

        if (canceled || !filePath) {
          return { path: '' };
        }

        fs.writeFileSync(filePath, pdfBuffer);
        logger.info('[ExportIPC] Saved PDF to:', filePath);

        return { path: filePath };
      },
      { channel: NOTE_CHANNELS.EXPORT_PDF, noteId: id },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.EXPORT_MARKDOWN, async (_event, rawRequest) => {
    const { id, options } = ExportMarkdownRequestSchema.parse(rawRequest);
    return handleRequest<ExportMarkdownResponse>(
      async () => {
        const result = await exportUseCases.exportMarkdown.execute(
          id,
          options as ExportOptions | undefined,
        );
        const markdownContent = result.content.toString();

        const { filePath, canceled } = await dialog.showSaveDialog({
          title: 'Export as Markdown',
          defaultPath: path.join(app.getPath('documents'), result.filename),
          filters: [{ name: 'Markdown Files', extensions: ['md'] }],
        });

        if (canceled || !filePath) {
          return { markdown: markdownContent, path: '' };
        }

        fs.writeFileSync(filePath, markdownContent, 'utf-8');
        logger.info('[ExportIPC] Saved Markdown to:', filePath);

        return { markdown: markdownContent, path: filePath };
      },
      { channel: NOTE_CHANNELS.EXPORT_MARKDOWN, noteId: id },
    );
  });

  logger.info('[IPC] Export handlers registered');
}

export function unregisterExportHandlers(): void {
  [NOTE_CHANNELS.EXPORT_HTML, NOTE_CHANNELS.EXPORT_PDF, NOTE_CHANNELS.EXPORT_MARKDOWN].forEach(
    (channel) => {
      ipcMain.removeHandler(channel);
    },
  );
}
