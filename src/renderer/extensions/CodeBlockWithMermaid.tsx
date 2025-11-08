/**
 * CodeBlock with Mermaid Extension - Enhanced code block with Mermaid diagram rendering
 * When language is set to "mermaid", renders a live diagram preview
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { CodeBlockComponent } from '@renderer/components/features/editor/CodeBlockComponent';
import { lowlight } from 'lowlight';

export const CodeBlockWithMermaid = CodeBlockLowlight.extend({
  name: 'codeBlock',

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
});
