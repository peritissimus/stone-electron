/**
 * Document Buffer Store - In-memory buffer for note content
 *
 * Pattern: specs/stores.ts#DocumentBufferStoreState
 *
 * Keeps recently edited documents in memory for instant switching.
 * Saves to disk only on explicit save, blur, timer, or app close.
 */

import { create } from 'zustand';
import { JSONContent } from '@tiptap/react';
import { logger } from '@renderer/utils/logger';

export interface DocumentBuffer {
  noteId: string;
  content: JSONContent;
  isDirty: boolean;
  lastModified: number;
  title?: string;
}

interface DocumentBufferState {
  buffers: Map<string, DocumentBuffer>;
  maxBuffers: number; // LRU limit

  // Actions
  getBuffer: (noteId: string) => DocumentBuffer | undefined;
  setBuffer: (noteId: string, content: JSONContent, title?: string) => void;
  updateBuffer: (noteId: string, content: JSONContent) => void;
  markDirty: (noteId: string, dirty?: boolean) => void;
  markClean: (noteId: string) => void;
  removeBuffer: (noteId: string) => void;
  clearAllBuffers: () => void;
  getDirtyBuffers: () => DocumentBuffer[];
  hasBuffer: (noteId: string) => boolean;
  isDirty: (noteId: string) => boolean;
}

export const useDocumentBufferStore = create<DocumentBufferState>()((set, get) => ({
  buffers: new Map(),
  maxBuffers: 20, // Keep up to 20 documents in memory

  getBuffer: (noteId: string) => {
    return get().buffers.get(noteId);
  },

  setBuffer: (noteId: string, content: JSONContent, title?: string) => {
    set((state) => {
      const newBuffers = new Map(state.buffers);

      // LRU eviction if at capacity
      if (newBuffers.size >= state.maxBuffers && !newBuffers.has(noteId)) {
        // Find oldest non-dirty buffer to evict
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, buffer] of newBuffers) {
          if (!buffer.isDirty && buffer.lastModified < oldestTime) {
            oldestTime = buffer.lastModified;
            oldestKey = key;
          }
        }

        if (oldestKey) {
          logger.debug('[DocumentBuffer] Evicting buffer:', oldestKey);
          newBuffers.delete(oldestKey);
        }
      }

      newBuffers.set(noteId, {
        noteId,
        content,
        isDirty: false,
        lastModified: Date.now(),
        title,
      });

      logger.debug('[DocumentBuffer] Buffer set for:', noteId);
      return { buffers: newBuffers };
    });
  },

  updateBuffer: (noteId: string, content: JSONContent) => {
    set((state) => {
      const existing = state.buffers.get(noteId);
      if (!existing) {
        // Create new buffer if doesn't exist
        const newBuffers = new Map(state.buffers);
        newBuffers.set(noteId, {
          noteId,
          content,
          isDirty: true,
          lastModified: Date.now(),
        });
        return { buffers: newBuffers };
      }

      const newBuffers = new Map(state.buffers);
      newBuffers.set(noteId, {
        ...existing,
        content,
        isDirty: true,
        lastModified: Date.now(),
      });

      return { buffers: newBuffers };
    });
  },

  markDirty: (noteId: string, dirty = true) => {
    set((state) => {
      const existing = state.buffers.get(noteId);
      if (!existing) return state;

      const newBuffers = new Map(state.buffers);
      newBuffers.set(noteId, {
        ...existing,
        isDirty: dirty,
        lastModified: Date.now(),
      });

      return { buffers: newBuffers };
    });
  },

  markClean: (noteId: string) => {
    set((state) => {
      const existing = state.buffers.get(noteId);
      if (!existing) return state;

      const newBuffers = new Map(state.buffers);
      newBuffers.set(noteId, {
        ...existing,
        isDirty: false,
      });

      logger.debug('[DocumentBuffer] Buffer marked clean:', noteId);
      return { buffers: newBuffers };
    });
  },

  removeBuffer: (noteId: string) => {
    set((state) => {
      const newBuffers = new Map(state.buffers);
      newBuffers.delete(noteId);
      logger.debug('[DocumentBuffer] Buffer removed:', noteId);
      return { buffers: newBuffers };
    });
  },

  clearAllBuffers: () => {
    set({ buffers: new Map() });
    logger.debug('[DocumentBuffer] All buffers cleared');
  },

  getDirtyBuffers: () => {
    const buffers = get().buffers;
    const dirty: DocumentBuffer[] = [];
    for (const buffer of buffers.values()) {
      if (buffer.isDirty) {
        dirty.push(buffer);
      }
    }
    return dirty;
  },

  hasBuffer: (noteId: string) => {
    return get().buffers.has(noteId);
  },

  isDirty: (noteId: string) => {
    const buffer = get().buffers.get(noteId);
    return buffer?.isDirty ?? false;
  },
}));
