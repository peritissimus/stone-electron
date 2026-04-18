import { useCallback } from 'react';
import { logger } from '@renderer/lib/logger';
import { noteAPI } from '@renderer/api';

export function useNoteExportActions() {
  const exportHtml = useCallback(async (id: string, renderedHtml?: string, title?: string) => {
    try {
      const response = await noteAPI.exportHtml(id, renderedHtml, title);
      if (response.success && response.data) {
        logger.info('[useNoteAPI.exportHtml] Exported HTML', { filePath: response.data.path });
        return { success: true, filePath: response.data.path };
      }
      return { success: false };
    } catch (error) {
      logger.error('[useNoteAPI.exportHtml] Error:', error);
      return { success: false };
    }
  }, []);

  const exportPdf = useCallback(async (id: string, renderedHtml: string, title: string) => {
    try {
      const response = await noteAPI.exportPdf(id, renderedHtml, title);
      if (response.success && response.data) {
        logger.info('[useNoteAPI.exportPdf] Exported PDF', { filePath: response.data.path });
        return { success: true, filePath: response.data.path };
      }
      return { success: false };
    } catch (error) {
      logger.error('[useNoteAPI.exportPdf] Error:', error);
      return { success: false };
    }
  }, []);

  const exportMarkdown = useCallback(async (id: string, _title: string) => {
    try {
      const response = await noteAPI.exportMarkdown(id);
      if (response.success && response.data) {
        logger.info('[useNoteAPI.exportMarkdown] Exported Markdown', {
          filePath: response.data.path,
        });
        return { success: true, filePath: response.data.path };
      }
      return { success: false };
    } catch (error) {
      logger.error('[useNoteAPI.exportMarkdown] Error:', error);
      return { success: false };
    }
  }, []);

  return {
    exportHtml,
    exportPdf,
    exportMarkdown,
  };
}
