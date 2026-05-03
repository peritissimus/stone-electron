import type { DocumentMarkdown, EditorDocument, RichTextEditor } from './types';
import { parseMarkdown } from '@renderer/lib/markdownParser';
import { serializeMarkdown } from '@renderer/lib/markdownSerializer';

export function parseEditorMarkdown(markdown: DocumentMarkdown): EditorDocument {
  return parseMarkdown(markdown);
}

export function serializeEditorDocument(document: EditorDocument): DocumentMarkdown {
  return serializeMarkdown(document);
}

export function setEditorMarkdown(editor: RichTextEditor, markdown: DocumentMarkdown): void {
  editor.commands.setContent(parseEditorMarkdown(markdown));
}

export function getEditorMarkdown(editor: RichTextEditor): DocumentMarkdown {
  return serializeEditorDocument(editor.getJSON() as EditorDocument);
}

export function setEditorDocument(editor: RichTextEditor, document: EditorDocument): void {
  editor.commands.setContent(document);
}

export function getEditorDocument(editor: RichTextEditor): EditorDocument {
  return editor.getJSON() as EditorDocument;
}

export function subscribeToEditorUpdates(
  editor: RichTextEditor,
  onUpdate: () => void,
): () => void {
  editor.on('update', onUpdate);
  return () => editor.off('update', onUpdate);
}
