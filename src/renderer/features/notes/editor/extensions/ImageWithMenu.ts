/**
 * Custom Image Extension with Context Menu
 * Adds right-click menu to copy image path
 */

import { Node, mergeAttributes, CommandProps } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

import { ImageComponent } from './ImageComponent';

// Extend TipTap's Commands interface to include setImage
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageWithMenu: {
      setImage: (options: { src: string; alt?: string; title?: string }) => ReturnType;
    };
  }
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
