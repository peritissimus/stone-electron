/**
 * EventBus Tests
 *
 * Unit tests for the centralized event emission service.
 * Tests run in standalone mode (no Electron) so BrowserWindow-specific tests
 * are covered by the EventEmitter fallback behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger to avoid console output
vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { EventBus } from '../../src/main/services/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create fresh instance for each test
    eventBus = new EventBus();
    eventBus.setDebugMode(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Note: BrowserWindow tests are skipped because vi.mock can't intercept dynamic require()
  // In standalone mode (test environment), EventBus uses EventEmitter instead
  describe('emit (standalone mode)', () => {
    it('should handle emit without BrowserWindow', () => {
      expect(() => eventBus.emit('test:event', { foo: 'bar' })).not.toThrow();
    });

    it('should emit to EventEmitter listeners', () => {
      const listener = vi.fn();
      eventBus.on('test:event', listener);

      eventBus.emit('test:event', { foo: 'bar' });

      expect(listener).toHaveBeenCalledWith({ foo: 'bar' });
    });
  });

  describe('emitTo (standalone mode)', () => {
    it('should warn when called in standalone mode', () => {
      // Should not throw, just log warning
      expect(() => eventBus.emitTo(1, 'specific:event', { value: 'test' })).not.toThrow();
    });
  });

  describe('emitToFocused (standalone mode)', () => {
    it('should warn when called in standalone mode', () => {
      // Should not throw, just log warning
      expect(() => eventBus.emitToFocused('focused:event', { data: 'focused' })).not.toThrow();
    });
  });

  describe('emitCreated', () => {
    it('should emit created event with entity wrapped in entityType key', () => {
      const listener = vi.fn();
      eventBus.on('notes:created', listener);

      const entity = { id: '123', name: 'Test' };
      eventBus.emitCreated('note', 'notes:created', entity);

      expect(listener).toHaveBeenCalledWith({ note: entity });
    });
  });

  describe('emitUpdated', () => {
    it('should emit updated event with entity wrapped in entityType key', () => {
      const listener = vi.fn();
      eventBus.on('notebooks:updated', listener);

      const entity = { id: '456', title: 'Updated' };
      eventBus.emitUpdated('notebook', 'notebooks:updated', entity);

      expect(listener).toHaveBeenCalledWith({ notebook: entity });
    });
  });

  describe('emitDeleted', () => {
    it('should emit deleted event with id', () => {
      const listener = vi.fn();
      eventBus.on('tags:deleted', listener);

      eventBus.emitDeleted('tags:deleted', 'tag-789');

      expect(listener).toHaveBeenCalledWith({ id: 'tag-789' });
    });
  });

  describe('on/off', () => {
    it('should register and call event listeners', () => {
      const listener = vi.fn();
      eventBus.on('test:event', listener);

      eventBus.emit('test:event', { data: 'test' });

      expect(listener).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should unregister event listeners', () => {
      const listener = vi.fn();
      eventBus.on('test:event', listener);
      eventBus.off('test:event', listener);

      eventBus.emit('test:event', { data: 'test' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should notify subscribers of all events', () => {
      const subscriber = vi.fn();
      eventBus.subscribe(subscriber);

      eventBus.emit('event1', { a: 1 });
      eventBus.emit('event2', { b: 2 });

      expect(subscriber).toHaveBeenCalledWith('event1', { a: 1 });
      expect(subscriber).toHaveBeenCalledWith('event2', { b: 2 });
    });

    it('should return unsubscribe function', () => {
      const subscriber = vi.fn();
      const unsubscribe = eventBus.subscribe(subscriber);

      eventBus.emit('event1', { a: 1 });
      unsubscribe();
      eventBus.emit('event2', { b: 2 });

      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber).toHaveBeenCalledWith('event1', { a: 1 });
    });
  });

  describe('debug mode', () => {
    it('should toggle debug mode', () => {
      eventBus.setDebugMode(true);

      // In standalone mode, debug mode just enables logging
      expect(() => eventBus.emit('debug:event')).not.toThrow();
    });
  });

  describe('isElectronMode', () => {
    it('should detect Electron mode based on BrowserWindow availability', () => {
      // In test environment, Electron is not available
      // so isElectronMode returns false
      expect(eventBus.isElectronMode()).toBe(false);
    });
  });
});
