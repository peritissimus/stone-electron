/**
 * useNoteExport Hook - Handles note export operations
 *
 * Encapsulates HTML, PDF, and Markdown export handlers
 */

import { useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { getRenderedEditorContent, buildExportHTML } from '@renderer/lib/exportUtils';

interface UseNoteExportOptions {
  activeNoteId: string | null;
  editor: Editor | null;
  title: string;
}

export function useNoteExport({ activeNoteId, editor, title }: UseNoteExportOptions) {
  const { exportHtml, exportPdf, exportMarkdown } = useNoteAPI();

  const handleExportHtml = useCallback(async () => {
    if (!activeNoteId || !editor) return;
    const renderedContent = getRenderedEditorContent(editor);
    const fullHtml = await buildExportHTML(title, renderedContent);
    await exportHtml(activeNoteId, fullHtml, title);
  }, [activeNoteId, editor, exportHtml, title]);

  const handleExportPdf = useCallback(async () => {
    if (!activeNoteId || !editor) return;
    const renderedContent = getRenderedEditorContent(editor);
    const fullHtml = await buildExportHTML(title, renderedContent);
    await exportPdf(activeNoteId, fullHtml, title);
  }, [activeNoteId, editor, exportPdf, title]);

  const handleExportMarkdown = useCallback(async () => {
    if (!activeNoteId) return;
    await exportMarkdown(activeNoteId, title);
  }, [activeNoteId, exportMarkdown, title]);

  return {
    exportHtml: handleExportHtml,
    exportPdf: handleExportPdf,
    exportMarkdown: handleExportMarkdown,
  };
}
