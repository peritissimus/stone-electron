/**
 * System IPC Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock font-list
vi.mock('font-list', () => ({
  getFonts: vi.fn(),
}));

// Mock logger
vi.mock('../../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import { registerSystemHandlers } from '../../../src/main/ipc/handlers/systemHandlers';
import { ipcMain } from 'electron';
import { getFonts } from 'font-list';

// Create mock container (handler doesn't use container deps, but signature requires it)
const mockContainer = {
  cradle: {},
} as any;

describe('System IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

    // Capture registered handlers
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    registerSystemHandlers(mockContainer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('system:getFonts', () => {
    it('should return sorted system fonts', async () => {
      const mockFonts = ['Zapfino', 'Arial', 'Helvetica', 'Monaco'];
      (getFonts as any).mockResolvedValue(mockFonts);

      const handler = registeredHandlers.get('system:getFonts');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['Arial', 'Helvetica', 'Monaco', 'Zapfino']);
    });

    it('should return fallback fonts on error', async () => {
      (getFonts as any).mockRejectedValue(new Error('Failed to get fonts'));

      const handler = registeredHandlers.get('system:getFonts');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data).toContain('Arial');
      expect(result.data).toContain('Helvetica');
      expect(result.data).toContain('Monaco');
    });

    it('should handle empty font list', async () => {
      (getFonts as any).mockResolvedValue([]);

      const handler = registeredHandlers.get('system:getFonts');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});
