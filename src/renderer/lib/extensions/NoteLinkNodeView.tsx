/**
 * NodeView component for rendering note links
 */

import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { Link } from '@phosphor-icons/react';

export function NoteLinkNodeView({ node, selected }: { node: any; selected: boolean }) {
  const title = node.attrs.title || 'Unknown';
  const noteId = node.attrs.noteId;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Dispatch a custom event that can be caught by the editor container
    const event = new CustomEvent('note-link-click', {
      bubbles: true,
      detail: { noteId, title },
    });
    (e.target as HTMLElement).dispatchEvent(event);
  };

  return (
    <NodeViewWrapper as="span" className="inline">
      <button
        type="button"
        onClick={handleClick}
        className={`
          inline-flex items-center gap-1
          px-1.5 py-0.5
          rounded
          bg-primary/10 text-primary
          cursor-pointer
          hover:bg-primary/20
          transition-colors
          text-sm font-medium
          ${selected ? 'ring-2 ring-primary/50' : ''}
        `}
        data-note-id={noteId}
        contentEditable={false}
      >
        <Link size={12} weight="bold" />
        <span>{title}</span>
      </button>
    </NodeViewWrapper>
  );
}
