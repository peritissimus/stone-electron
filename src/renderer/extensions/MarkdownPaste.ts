/**
 * Markdown Paste Extension
 *
 * Handles pasting markdown content and parsing it into proper ProseMirror nodes.
 * Intercepts paste events and converts markdown syntax to formatted blocks.
 * Images are ignored and left to useImageUpload.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Slice } from '@tiptap/pm/model';
import { parseMarkdown } from '@renderer/lib/markdownParser';
import { logger } from '@renderer/utils/logger';

export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste: (view, event, _slice) => {
            const text = event.clipboardData?.getData('text/plain');

            if (!text) {
              return false;
            }

            // Check if this is likely markdown content
            const hasMarkdownSyntax =
              /^#{1,6}\s|^\*\*|^[-*+]\s|^```|^\d+\.\s|^\[\[|\[\d{2}:\d{2}\]/m.test(text);

            if (!hasMarkdownSyntax && text.length < 100) {
              return false;
            }

            try {
              logger.info('[MarkdownPaste] Parsing markdown paste (', text.length, 'chars)');

              const doc = parseMarkdown(text);

              const schema = view.state.schema;
              const content = schema.nodeFromJSON(doc);

              const parsedSlice = new Slice(content.content, 0, 0);

              const tr = view.state.tr.replaceSelection(parsedSlice);

              view.dispatch(tr);

              logger.info('[MarkdownPaste] ✓ Paste successful');

              return true;
            } catch (error) {
              logger.error('[MarkdownPaste] Failed to parse:', error);
              return false;
            }
          },
        },
      }),
    ];
  },
});
