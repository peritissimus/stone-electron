/** @vitest-environment jsdom */
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildEditorExtensions } from '@renderer/features/notes/editor/config/buildExtensions';
import { getEditorMarkdown, setEditorMarkdown } from '@renderer/features/notes/editor/document';
import { DEFAULT_EDITOR_SETTINGS } from '@shared/types/settings';
import { resolveShortcuts } from '@shared/utils/shortcuts';

// Language loading is an independent asynchronous feature. Keep the production
// schema, plugins, node views, and Markdown conversion for these migration tests.
vi.mock('@renderer/features/notes/editor/config/codeLanguages', () => ({
  loadLanguage: async () => {},
}));

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

const samples = [
  '# Heading\n\nText with **bold**, *italic*, ~~strike~~, `code` and a [link](https://example.com).',
  '- parent\n  - child\n- TODO follow up\n- DONE completed',
  '[09:30] Review [[Project Plan]] with the team.',
  '| Name | Value |\n| --- | --- |\n| **First** | `one` |',
  '![A picture](.assets/picture.png "Caption")',
  '```mermaid\ngraph TD\n  A --> B\n```',
  '```json\n{"nested":{"value":1}}\n```',
  '> A quotation\n\n---\n\nAfter the break.',
];

describe('production editor schema round trips', () => {
  it.each(samples)('retains note content through editor hydration and saving: %s', (markdown) => {
    editor = new Editor({
      extensions: buildEditorExtensions({
        editorConfig: DEFAULT_EDITOR_SETTINGS,
        shortcuts: resolveShortcuts({ app: {}, editor: {} }),
        fetchNotesForAutocomplete: async () => [],
      }),
    });
    const onEdit = vi.fn();
    editor.on('update', onEdit);

    setEditorMarkdown(editor, markdown);
    expect(getEditorMarkdown(editor)).toBe(markdown);
    expect(onEdit).not.toHaveBeenCalled();
    const savedDocument = editor.getJSON();
    setEditorMarkdown(editor, getEditorMarkdown(editor));
    expect(editor.getJSON()).toEqual(savedDocument);
  });
});
