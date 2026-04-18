/**
 * Block Drag & Drop Extension
 *
 * Enables Notion-like drag and drop reordering of blocks.
 * Works with FloatingBlockMenu drag handles.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Slice, Fragment } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { logger } from '@renderer/lib/logger';

// Store drag state globally
let draggedNodePos: number | null = null;
let draggedNode: any = null;

export const BlockDragDrop = Extension.create({
  name: 'blockDragDrop',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockDragDrop'),
        props: {
          handleDOMEvents: {
            dragstart(view, event) {
              const target = event.target as HTMLElement;

              const dragHandle = target.closest('[data-drag-handle]');
              if (!dragHandle) {
                return false;
              }

              logger.info('[BlockDragDrop] Drag started');

              const { selection } = view.state;
              const { $from } = selection;

              let blockPos = $from.pos;
              let blockNode = null;

              for (let d = $from.depth; d >= 0; d--) {
                const node = $from.node(d);
                if (node.type.name === 'doc') continue;

                const parent = d > 0 ? $from.node(d - 1) : null;
                if (parent && parent.type.name === 'doc') {
                  blockPos = $from.before(d);
                  blockNode = node;
                  break;
                }
              }

              if (!blockNode) {
                logger.warn('[BlockDragDrop] No block node found');
                return false;
              }

              draggedNodePos = blockPos;
              draggedNode = blockNode;

              event.dataTransfer!.effectAllowed = 'move';
              event.dataTransfer!.setData('text/plain', '');

              if (typeof event.dataTransfer!.setDragImage === 'function') {
                const blockDom = view.nodeDOM(blockPos);
                if (blockDom instanceof HTMLElement) {
                  event.dataTransfer!.setDragImage(blockDom, 0, 0);
                }
              }

              return true;
            },

            dragover(_view, event) {
              if (draggedNodePos !== null) {
                event.preventDefault();
                event.dataTransfer!.dropEffect = 'move';
                return true;
              }
              return false;
            },

            drop(view, event) {
              if (draggedNodePos === null || !draggedNode) {
                return false;
              }

              logger.info('[BlockDragDrop] Drop triggered');

              event.preventDefault();
              event.stopPropagation();

              const dropPos = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });

              if (!dropPos) {
                draggedNodePos = null;
                draggedNode = null;
                return true;
              }

              const $dropPos = view.state.doc.resolve(dropPos.pos);
              let targetPos = dropPos.pos;

              for (let d = $dropPos.depth; d >= 0; d--) {
                const node = $dropPos.node(d);
                if (node.type.name === 'doc') continue;

                const parent = d > 0 ? $dropPos.node(d - 1) : null;
                if (parent && parent.type.name === 'doc') {
                  const blockStart = $dropPos.before(d);
                  const blockEnd = $dropPos.after(d);
                  const midpoint = (blockStart + blockEnd) / 2;

                  if (dropPos.pos < midpoint) {
                    targetPos = blockStart;
                  } else {
                    targetPos = blockEnd;
                  }
                  break;
                }
              }

              const nodeSize = draggedNode.nodeSize;
              if (targetPos >= draggedNodePos && targetPos <= draggedNodePos + nodeSize) {
                draggedNodePos = null;
                draggedNode = null;
                return true;
              }

              const tr = view.state.tr;

              tr.delete(draggedNodePos, draggedNodePos + nodeSize);

              let adjustedTargetPos = targetPos;
              if (targetPos > draggedNodePos) {
                adjustedTargetPos -= nodeSize;
              }

              const slice = new Slice(Fragment.from(draggedNode), 0, 0);
              tr.insert(adjustedTargetPos, slice.content);

              const newPos = adjustedTargetPos + 1;
              tr.setSelection(TextSelection.near(tr.doc.resolve(newPos)));

              view.dispatch(tr);

              draggedNodePos = null;
              draggedNode = null;

              return true;
            },

            dragend() {
              draggedNodePos = null;
              draggedNode = null;
              return false;
            },
          },
        },
      }),
    ];
  },
});
