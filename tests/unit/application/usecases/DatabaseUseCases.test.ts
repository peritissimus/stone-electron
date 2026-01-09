/**
 * DatabaseUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDatabaseUseCases } from '../../../../src/main/application/usecases/DatabaseUseCases';
import type { IDatabaseUseCases } from '../../../../src/main/domain/ports/in/IDatabaseUseCases';

// Mock database manager factory
function createMockDatabaseManager() {
  return {
    getStatus: vi.fn(),
    vacuum: vi.fn(),
    checkIntegrity: vi.fn(),
  };
}

describe('DatabaseUseCases', () => {
  let mockDbManager: ReturnType<typeof createMockDatabaseManager>;
  let useCases: IDatabaseUseCases;

  beforeEach(() => {
    mockDbManager = createMockDatabaseManager();
    useCases = createDatabaseUseCases({
      getDatabaseManager: () => mockDbManager,
    });
  });

  describe('getStatus', () => {
    it('returns database status', async () => {
      const status = { path: '/path/to/db.sqlite', size: 1024000, isOpen: true };
      mockDbManager.getStatus.mockResolvedValue(status);

      const result = await useCases.getStatus();

      expect(result).toEqual(status);
      expect(mockDbManager.getStatus).toHaveBeenCalled();
    });

    it('returns closed database status', async () => {
      const status = { path: '/path/to/db.sqlite', size: 0, isOpen: false };
      mockDbManager.getStatus.mockResolvedValue(status);

      const result = await useCases.getStatus();

      expect(result.isOpen).toBe(false);
    });
  });

  describe('vacuum', () => {
    it('vacuums the database', async () => {
      mockDbManager.vacuum.mockResolvedValue(undefined);

      await useCases.vacuum();

      expect(mockDbManager.vacuum).toHaveBeenCalled();
    });
  });

  describe('checkIntegrity', () => {
    it('returns ok when database is healthy', async () => {
      mockDbManager.checkIntegrity.mockResolvedValue({ ok: true, errors: [] });

      const result = await useCases.checkIntegrity();

      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors when database has issues', async () => {
      const errors = ['Table notes has orphaned rows', 'Index idx_notes corrupted'];
      mockDbManager.checkIntegrity.mockResolvedValue({ ok: false, errors });

      const result = await useCases.checkIntegrity();

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(errors);
    });
  });
});
