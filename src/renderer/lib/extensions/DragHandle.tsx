/**
 * Drag Handle Extension - Notion-like drag and drop for blocks
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface DragHandleOptions {
  dragHandleWidth: number;
}

export const DragHandle = Extension.create<DragHandleOptions>({
  name: 'dragHandle',

  addOptions() {
    return {
      dragHandleWidth: 52,
    };
  },

  addProseMirrorPlugins() {
    const { dragHandleWidth } = this.options;

    return [
      new Plugin({
        key: new PluginKey('dragHandle'),
        props: {
          handleDOMEvents: {
            drop(view, event) {
              const pos = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });

              if (!pos) return false;

              const draggedNodePos = (event.dataTransfer as any)._draggedNodePos;
              if (draggedNodePos == null) return false;

              // Get the node being dragged
              const node = view.state.doc.nodeAt(draggedNodePos);
              if (!node) return false;

              // Don't allow dropping inside itself
              if (pos.pos >= draggedNodePos && pos.pos <= draggedNodePos + node.nodeSize) {
                return true;
              }

              // Create transaction to move the node
              const tr = view.state.tr;

              // Delete from old position
              tr.delete(draggedNodePos, draggedNodePos + node.nodeSize);

              // Adjust target position if needed
              let targetPos = pos.pos;
              if (targetPos > draggedNodePos) {
                targetPos -= node.nodeSize;
              }

              // Insert at new position
              tr.insert(targetPos, node);

              // Apply transaction
              view.dispatch(tr);

              event.preventDefault();
              return true;
            },

            dragstart(view, event) {
              const target = event.target as HTMLElement;
              if (!target.matches('[data-drag-handle]')) {
                return false;
              }

              const pos = view.posAtDOM(target.closest('.ProseMirror > *') as Node, 0);
              if (pos == null) return false;

              // Store position in dataTransfer
              (event.dataTransfer as any)._draggedNodePos = pos;
              event.dataTransfer!.effectAllowed = 'move';
              event.dataTransfer!.setData('text/html', target.innerHTML);

              return true; // Event was handled
            },
          },
        },

        view(editorView) {
          const container = document.createElement('div');
          container.className = 'drag-handle-root';
          container.style.position = 'absolute';
          container.style.left = `-${dragHandleWidth}px`;
          container.style.top = '0';
          container.style.width = `${dragHandleWidth}px`;
          container.style.pointerEvents = 'none';
          container.style.opacity = '0';
          container.style.transition = 'opacity 150ms ease';
          container.style.zIndex = '10';

          editorView.dom.parentElement?.style.setProperty('position', 'relative');
          editorView.dom.parentElement?.appendChild(container);

          return {
            update(view, _prevState) {
              // Update drag handle position based on cursor
              const { selection } = view.state;
              const { $from } = selection;

              // Find the parent block node
              let blockPos = $from.pos;
              for (let d = $from.depth; d > 0; d--) {
                const node = $from.node(d);
                if (node.type.isBlock && node.type.name !== 'doc') {
                  blockPos = $from.before(d);
                  break;
                }
              }

              // Get DOM node for the block
              const blockDom = view.nodeDOM(blockPos);
              if (!blockDom || !(blockDom instanceof HTMLElement)) {
                container.style.opacity = '0';
                return;
              }

              // Position the drag handle
              const editorRect = view.dom.getBoundingClientRect();
              const blockRect = blockDom.getBoundingClientRect();

              container.style.top = `${blockRect.top - editorRect.top + view.dom.scrollTop}px`;

              // Show handle when hovering block
              const isHovering = blockDom.matches(':hover');
              if (isHovering) {
                container.style.opacity = '1';
                container.style.pointerEvents = 'auto';
              }
            },

            destroy() {
              container.remove();
            },
          };
        },
      }),
    ];
  },
});
