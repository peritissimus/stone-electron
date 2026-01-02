/**
 * EventBus Tests
 *
 * Unit tests for the centralized event emission service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
const mockWebContents = {
  send: vi.fn(),
};

const mockWindow = {
  id: 1,
  isDestroyed: vi.fn(() => false),
  webContents: mockWebContents,
};

const mockWindow2 = {
  id: 2,
  isDestroyed: vi.fn(() => false),
  webContents: {
    send: vi.fn(),
  },
};

const mockDestroyedWindow = {
  id: 3,
  isDestroyed: vi.fn(() => true),
  webContents: {
    send: vi.fn(),
  },
};

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [mockWindow]),
    fromId: vi.fn((id: number) => {
      if (id === 1) return mockWindow;
      if (id === 2) return mockWindow2;
      if (id === 3) return mockDestroyedWindow;
      return null;
    }),
    getFocusedWindow: vi.fn(() => mockWindow),
  },
}));

// Import after mocks
import { getEventBus, EventBus } from '../../src/main/services/EventBus';
import { BrowserWindow } from 'electron';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton for each test by getting fresh instance
    eventBus = getEventBus();
    eventBus.setDebugMode(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('emit', () => {
    it('should emit event to all windows', () => {
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow, mockWindow2]);

      eventBus.emit('test:event', { foo: 'bar' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('test:event', { foo: 'bar' });
      expect(mockWindow2.webContents.send).toHaveBeenCalledWith('test:event', { foo: 'bar' });
    });

    it('should not send to destroyed windows', () => {
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow, mockDestroyedWindow]);

      eventBus.emit('test:event', { data: 123 });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('test:event', { data: 123 });
      expect(mockDestroyedWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should handle no windows gracefully', () => {
      (BrowserWindow.getAllWindows as any).mockReturnValue([]);

      expect(() => eventBus.emit('test:event')).not.toThrow();
    });

    it('should work with undefined data', () => {
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      eventBus.emit('test:event');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('test:event', undefined);
    });
  });

  describe('emitTo', () => {
    it('should emit event to specific window by id', () => {
      eventBus.emitTo(1, 'specific:event', { value: 'test' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('specific:event', { value: 'test' });
    });

    it('should not emit to non-existent window', () => {
      eventBus.emitTo(999, 'specific:event', { value: 'test' });

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should not emit to destroyed window', () => {
      eventBus.emitTo(3, 'specific:event', { value: 'test' });

      expect(mockDestroyedWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('emitToFocused', () => {
    it('should emit event to focused window', () => {
      eventBus.emitToFocused('focused:event', { data: 'focused' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('focused:event', { data: 'focused' });
    });

    it('should handle no focused window gracefully', () => {
      (BrowserWindow.getFocusedWindow as any).mockReturnValue(null);

      expect(() => eventBus.emitToFocused('focused:event')).not.toThrow();
    });

    it('should not emit if focused window is destroyed', () => {
      (BrowserWindow.getFocusedWindow as any).mockReturnValue(mockDestroyedWindow);

      eventBus.emitToFocused('focused:event');

      expect(mockDestroyedWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('emitCreated', () => {
    it('should emit created event with entity wrapped in entityType key', () => {
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const entity = { id: '123', name: 'Test' };
      eventBus.emitCreated('note', 'notes:created', entity);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('notes:created', { note: entity });
    });
  });

  describe('emitUpdated', () => {
    it('should emit updated event with entity wrapped in entityType key', () => {
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const entity = { id: '456', title: 'Updated' };
      eventBus.emitUpdated('notebook', 'notebooks:updated', entity);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('notebooks:updated', { notebook: entity });
    });
  });

  describe('emitDeleted', () => {
    it('should emit deleted event with id', () => {
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      eventBus.emitDeleted('tags:deleted', 'tag-789');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('tags:deleted', { id: 'tag-789' });
    });
  });

  describe('debug mode', () => {
    it('should toggle debug mode', () => {
      eventBus.setDebugMode(true);
      // Debug mode doesn't change behavior, just logging - verify no errors
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      expect(() => eventBus.emit('debug:event')).not.toThrow();
    });
  });

  describe('getEventBus', () => {
    it('should return singleton instance', () => {
      const instance1 = getEventBus();
      const instance2 = getEventBus();

      expect(instance1).toBe(instance2);
    });
  });
});
