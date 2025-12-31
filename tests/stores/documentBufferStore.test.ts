/**
 * Document Buffer Store Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDocumentBufferStore } from '@renderer/stores/documentBufferStore';

// Mock the logger
vi.mock('@renderer/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('documentBufferStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useDocumentBufferStore.setState({
      buffers: new Map(),
      maxBuffers: 20,
    });
  });

  describe('setBuffer', () => {
    it('should add a new buffer', () => {
      const store = useDocumentBufferStore.getState();
      const content = { type: 'doc', content: [{ type: 'paragraph' }] };

      store.setBuffer('note-1', content, 'Test Note');

      const buffer = store.getBuffer('note-1');
      expect(buffer).toBeDefined();
      expect(buffer?.noteId).toBe('note-1');
      expect(buffer?.content).toEqual(content);
      expect(buffer?.isDirty).toBe(false);
      expect(buffer?.title).toBe('Test Note');
    });

    it('should update existing buffer', () => {
      const store = useDocumentBufferStore.getState();
      const content1 = { type: 'doc', content: [] };
      const content2 = { type: 'doc', content: [{ type: 'paragraph' }] };

      store.setBuffer('note-1', content1);
      store.setBuffer('note-1', content2);

      const buffer = store.getBuffer('note-1');
      expect(buffer?.content).toEqual(content2);
    });

    it('should evict oldest non-dirty buffer when at capacity', () => {
      const store = useDocumentBufferStore.getState();

      // Set max buffers to 3 for easier testing
      useDocumentBufferStore.setState({ maxBuffers: 3 });

      // Add 3 buffers
      store.setBuffer('note-1', { type: 'doc', content: [] });
      store.setBuffer('note-2', { type: 'doc', content: [] });
      store.setBuffer('note-3', { type: 'doc', content: [] });

      // All 3 should exist
      expect(store.hasBuffer('note-1')).toBe(true);
      expect(store.hasBuffer('note-2')).toBe(true);
      expect(store.hasBuffer('note-3')).toBe(true);

      // Add a 4th buffer - oldest (note-1) should be evicted
      store.setBuffer('note-4', { type: 'doc', content: [] });

      expect(store.hasBuffer('note-1')).toBe(false);
      expect(store.hasBuffer('note-2')).toBe(true);
      expect(store.hasBuffer('note-3')).toBe(true);
      expect(store.hasBuffer('note-4')).toBe(true);
    });

    it('should not evict dirty buffers', () => {
      const store = useDocumentBufferStore.getState();

      // Set max buffers to 3
      useDocumentBufferStore.setState({ maxBuffers: 3 });

      // Add 3 buffers, mark first as dirty
      store.setBuffer('note-1', { type: 'doc', content: [] });
      store.markDirty('note-1');
      store.setBuffer('note-2', { type: 'doc', content: [] });
      store.setBuffer('note-3', { type: 'doc', content: [] });

      // Add a 4th buffer - note-2 should be evicted (oldest non-dirty)
      store.setBuffer('note-4', { type: 'doc', content: [] });

      expect(store.hasBuffer('note-1')).toBe(true); // Dirty, not evicted
      expect(store.hasBuffer('note-2')).toBe(false); // Evicted
      expect(store.hasBuffer('note-3')).toBe(true);
      expect(store.hasBuffer('note-4')).toBe(true);
    });
  });

  describe('updateBuffer', () => {
    it('should update content and mark as dirty', () => {
      const store = useDocumentBufferStore.getState();
      const initialContent = { type: 'doc', content: [] };
      const updatedContent = { type: 'doc', content: [{ type: 'paragraph' }] };

      store.setBuffer('note-1', initialContent);
      expect(store.isDirty('note-1')).toBe(false);

      store.updateBuffer('note-1', updatedContent);

      const buffer = store.getBuffer('note-1');
      expect(buffer?.content).toEqual(updatedContent);
      expect(buffer?.isDirty).toBe(true);
    });

    it('should create buffer if it does not exist', () => {
      const store = useDocumentBufferStore.getState();
      const content = { type: 'doc', content: [] };

      store.updateBuffer('new-note', content);

      expect(store.hasBuffer('new-note')).toBe(true);
      expect(store.isDirty('new-note')).toBe(true);
    });
  });

  describe('markDirty / markClean', () => {
    it('should mark buffer as dirty', () => {
      const store = useDocumentBufferStore.getState();
      store.setBuffer('note-1', { type: 'doc', content: [] });

      expect(store.isDirty('note-1')).toBe(false);

      store.markDirty('note-1');
      expect(store.isDirty('note-1')).toBe(true);
    });

    it('should mark buffer as clean', () => {
      const store = useDocumentBufferStore.getState();
      store.setBuffer('note-1', { type: 'doc', content: [] });
      store.markDirty('note-1');

      expect(store.isDirty('note-1')).toBe(true);

      store.markClean('note-1');
      expect(store.isDirty('note-1')).toBe(false);
    });

    it('should handle non-existent buffer gracefully', () => {
      const store = useDocumentBufferStore.getState();

      // Should not throw
      store.markDirty('non-existent');
      store.markClean('non-existent');

      expect(store.isDirty('non-existent')).toBe(false);
    });
  });

  describe('removeBuffer', () => {
    it('should remove a buffer', () => {
      const store = useDocumentBufferStore.getState();
      store.setBuffer('note-1', { type: 'doc', content: [] });

      expect(store.hasBuffer('note-1')).toBe(true);

      store.removeBuffer('note-1');

      expect(store.hasBuffer('note-1')).toBe(false);
    });
  });

  describe('clearAllBuffers', () => {
    it('should remove all buffers', () => {
      const store = useDocumentBufferStore.getState();
      store.setBuffer('note-1', { type: 'doc', content: [] });
      store.setBuffer('note-2', { type: 'doc', content: [] });
      store.setBuffer('note-3', { type: 'doc', content: [] });

      // Get fresh state to check buffer count
      expect(useDocumentBufferStore.getState().buffers.size).toBe(3);

      store.clearAllBuffers();

      expect(useDocumentBufferStore.getState().buffers.size).toBe(0);
    });
  });

  describe('getDirtyBuffers', () => {
    it('should return only dirty buffers', () => {
      const store = useDocumentBufferStore.getState();
      store.setBuffer('note-1', { type: 'doc', content: [] });
      store.setBuffer('note-2', { type: 'doc', content: [] });
      store.setBuffer('note-3', { type: 'doc', content: [] });

      store.markDirty('note-1');
      store.markDirty('note-3');

      const dirtyBuffers = store.getDirtyBuffers();

      expect(dirtyBuffers).toHaveLength(2);
      expect(dirtyBuffers.map(b => b.noteId).sort()).toEqual(['note-1', 'note-3']);
    });

    it('should return empty array when no dirty buffers', () => {
      const store = useDocumentBufferStore.getState();
      store.setBuffer('note-1', { type: 'doc', content: [] });
      store.setBuffer('note-2', { type: 'doc', content: [] });

      const dirtyBuffers = store.getDirtyBuffers();

      expect(dirtyBuffers).toHaveLength(0);
    });
  });

  describe('hasBuffer', () => {
    it('should return true for existing buffer', () => {
      const store = useDocumentBufferStore.getState();
      store.setBuffer('note-1', { type: 'doc', content: [] });

      expect(store.hasBuffer('note-1')).toBe(true);
    });

    it('should return false for non-existent buffer', () => {
      const store = useDocumentBufferStore.getState();

      expect(store.hasBuffer('non-existent')).toBe(false);
    });
  });

  describe('isDirty', () => {
    it('should return correct dirty state', () => {
      const store = useDocumentBufferStore.getState();
      store.setBuffer('note-1', { type: 'doc', content: [] });

      expect(store.isDirty('note-1')).toBe(false);

      store.markDirty('note-1');
      expect(store.isDirty('note-1')).toBe(true);

      store.markClean('note-1');
      expect(store.isDirty('note-1')).toBe(false);
    });

    it('should return false for non-existent buffer', () => {
      const store = useDocumentBufferStore.getState();

      expect(store.isDirty('non-existent')).toBe(false);
    });
  });

  describe('getBuffer', () => {
    it('should return buffer when it exists', () => {
      const store = useDocumentBufferStore.getState();
      const content = { type: 'doc', content: [{ type: 'paragraph' }] };
      store.setBuffer('note-1', content, 'My Note');

      const buffer = store.getBuffer('note-1');

      expect(buffer).toBeDefined();
      expect(buffer?.noteId).toBe('note-1');
      expect(buffer?.content).toEqual(content);
      expect(buffer?.title).toBe('My Note');
    });

    it('should return undefined for non-existent buffer', () => {
      const store = useDocumentBufferStore.getState();

      const buffer = store.getBuffer('non-existent');

      expect(buffer).toBeUndefined();
    });
  });

  describe('LRU eviction', () => {
    it('should evict based on lastModified timestamp', async () => {
      const store = useDocumentBufferStore.getState();

      // Set max buffers to 3
      useDocumentBufferStore.setState({ maxBuffers: 3 });

      // Add buffers with time gaps
      store.setBuffer('note-1', { type: 'doc', content: [] });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      store.setBuffer('note-2', { type: 'doc', content: [] });

      await new Promise(resolve => setTimeout(resolve, 10));
      store.setBuffer('note-3', { type: 'doc', content: [] });

      // Access note-1 to update its timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      store.setBuffer('note-1', { type: 'doc', content: [{ type: 'paragraph' }] });

      // Add note-4 - note-2 should be evicted (oldest lastModified)
      store.setBuffer('note-4', { type: 'doc', content: [] });

      expect(store.hasBuffer('note-1')).toBe(true); // Recently accessed
      expect(store.hasBuffer('note-2')).toBe(false); // Oldest, evicted
      expect(store.hasBuffer('note-3')).toBe(true);
      expect(store.hasBuffer('note-4')).toBe(true);
    });
  });
});
