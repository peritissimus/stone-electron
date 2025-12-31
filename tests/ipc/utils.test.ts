/**
 * IPC Utils Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IpcError, handleIpcError, success, error, createHandler } from '../../src/main/ipc/utils';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

describe('IPC Utils', () => {
  describe('IpcError', () => {
    it('should create an error with code and message', () => {
      const err = new IpcError('TEST_ERROR', 'Test message');
      expect(err.code).toBe('TEST_ERROR');
      expect(err.message).toBe('Test message');
      expect(err.name).toBe('IpcError');
    });

    it('should create an error with details', () => {
      const details = { field: 'value' };
      const err = new IpcError('TEST_ERROR', 'Test message', details);
      expect(err.details).toEqual(details);
    });
  });

  describe('handleIpcError', () => {
    it('should re-throw IpcError as-is', () => {
      const originalError = new IpcError('ORIGINAL', 'Original message');
      expect(() => handleIpcError(originalError)).toThrow(originalError);
    });

    it('should wrap regular Error in IpcError', () => {
      const regularError = new Error('Regular error');
      expect(() => handleIpcError(regularError)).toThrow(IpcError);
      try {
        handleIpcError(regularError);
      } catch (e) {
        expect((e as IpcError).code).toBe('INTERNAL_ERROR');
        expect((e as IpcError).message).toBe('Regular error');
      }
    });

    it('should wrap unknown errors', () => {
      expect(() => handleIpcError('string error')).toThrow(IpcError);
      try {
        handleIpcError('string error');
      } catch (e) {
        expect((e as IpcError).code).toBe('UNKNOWN_ERROR');
        expect((e as IpcError).message).toBe('string error');
      }
    });
  });

  describe('success', () => {
    it('should create a success response with data', () => {
      const data = { id: '123', name: 'test' };
      const response = success(data);
      expect(response).toEqual({
        success: true,
        data,
      });
    });

    it('should handle null data', () => {
      const response = success(null);
      expect(response).toEqual({
        success: true,
        data: null,
      });
    });

    it('should handle array data', () => {
      const data = [1, 2, 3];
      const response = success(data);
      expect(response).toEqual({
        success: true,
        data: [1, 2, 3],
      });
    });
  });

  describe('error', () => {
    it('should create an error response', () => {
      const response = error('NOT_FOUND', 'Resource not found');
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('NOT_FOUND');
      expect(response.error.message).toBe('Resource not found');
      expect(response.error.timestamp).toBeDefined();
    });

    it('should include details when provided', () => {
      const details = { resourceId: '123' };
      const response = error('NOT_FOUND', 'Resource not found', details);
      expect(response.error.details).toEqual(details);
    });
  });

  describe('createHandler', () => {
    const mockEvent = {} as any;

    it('should wrap successful handler result in success response', async () => {
      const handler = vi.fn().mockResolvedValue({ id: '123' });
      const wrapped = createHandler(handler);

      const result = await wrapped(mockEvent, { input: 'test' });

      expect(result).toEqual({
        success: true,
        data: { id: '123' },
      });
      expect(handler).toHaveBeenCalledWith(mockEvent, { input: 'test' });
    });

    it('should handle sync handlers', async () => {
      const handler = vi.fn().mockReturnValue('sync result');
      const wrapped = createHandler(handler);

      const result = await wrapped(mockEvent, null);

      expect(result).toEqual({
        success: true,
        data: 'sync result',
      });
    });

    it('should wrap IpcError in error response', async () => {
      const handler = vi.fn().mockRejectedValue(new IpcError('CUSTOM_ERROR', 'Custom message'));
      const wrapped = createHandler(handler);

      const result = await wrapped(mockEvent, null);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('CUSTOM_ERROR');
      expect(result.error.message).toBe('Custom message');
    });

    it('should wrap regular Error in error response', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Something went wrong'));
      const wrapped = createHandler(handler);

      const result = await wrapped(mockEvent, null);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INTERNAL_ERROR');
      expect(result.error.message).toBe('Something went wrong');
    });

    it('should wrap unknown errors', async () => {
      const handler = vi.fn().mockRejectedValue('string error');
      const wrapped = createHandler(handler);

      const result = await wrapped(mockEvent, null);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('UNKNOWN_ERROR');
    });
  });
});
