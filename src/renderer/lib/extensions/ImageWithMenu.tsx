/**
 * Custom Image Extension with Context Menu
 * Adds right-click menu to copy image path
 */

import { Node, mergeAttributes, CommandProps } from '@tiptap/core';
import { NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import { useState, useCallback } from 'react';
import { Copy, Check } from '@phosphor-icons/react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/base/ui/context-menu';
import { logger } from '@renderer/lib/logger';

// Extend TipTap's Commands interface to include setImage
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageWithMenu: {
      setImage: (options: { src: string; alt?: string; title?: string }) => ReturnType;
    };
  }
}

/**
 * Image component with context menu
 */
function ImageComponent({ node, selected }: NodeViewProps) {
  const { src, alt, title } = node.attrs;
  const [copied, setCopied] = useState(false);

  const handleCopyPath = useCallback(async () => {
    try {
      // Get the displayable path (convert file:// to readable path)
      let pathToCopy = src;
      if (src.startsWith('file://')) {
        pathToCopy = src.replace('file://', '');
      }

      await navigator.clipboard.writeText(pathToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      logger.info('[ImageComponent] Path copied:', pathToCopy);
    } catch (error) {
      logger.error('[ImageComponent] Failed to copy path:', error);
    }
  }, [src]);

  const handleCopyRelativePath = useCallback(async () => {
    try {
      // Extract relative path (.assets/filename)
      let relativePath = src;
      if (src.includes('.assets/')) {
        const assetsIndex = src.indexOf('.assets/');
        relativePath = src.substring(assetsIndex);
      }

      await navigator.clipboard.writeText(relativePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      logger.info('[ImageComponent] Relative path copied:', relativePath);
    } catch (error) {
      logger.error('[ImageComponent] Failed to copy relative path:', error);
    }
  }, [src]);

  return (
    <NodeViewWrapper className="image-wrapper">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <figure
            className={`relative inline-block max-w-full ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
          >
            <img
              src={src}
              alt={alt || ''}
              title={title || ''}
              className="max-w-full h-auto rounded-lg shadow-sm cursor-pointer"
              draggable={false}
            />
          </figure>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleCopyPath}>
            {copied ? (
              <Check size={14} className="mr-2 text-success" />
            ) : (
              <Copy size={14} className="mr-2" />
            )}
            Copy Full Path
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCopyRelativePath}>
            <Copy size={14} className="mr-2" />
            Copy Relative Path
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </NodeViewWrapper>
  );
}

/**
 * Custom Image extension with context menu support
 */
export const ImageWithMenu = Node.create({
  name: 'image',

  group: 'block',

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageComponent);
  },

  addCommands() {
    return {
      setImage:
        (options: { src: string; alt?: string; title?: string }) =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
