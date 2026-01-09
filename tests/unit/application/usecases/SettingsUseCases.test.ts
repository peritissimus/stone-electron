/**
 * SettingsUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSettingsUseCases } from '../../../../src/main/application/usecases/SettingsUseCases';
import type { ISettingsRepository } from '../../../../src/main/domain/ports/out/ISettingsRepository';
import type { ISettingsUseCases } from '../../../../src/main/domain/ports/in/ISettingsUseCases';

// Mock factories
function createMockSettingsRepository(): ISettingsRepository {
  return {
    get: vi.fn(),
    set: vi.fn(),
    getAll: vi.fn(),
    delete: vi.fn(),
  } as unknown as ISettingsRepository;
}

describe('SettingsUseCases', () => {
  let settingsRepository: ISettingsRepository;
  let useCases: ISettingsUseCases;

  beforeEach(() => {
    settingsRepository = createMockSettingsRepository();
    useCases = createSettingsUseCases({ settingsRepository });
  });

  describe('get', () => {
    it('returns setting value when found', async () => {
      vi.mocked(settingsRepository.get).mockResolvedValue({
        key: 'theme',
        value: 'dark',
        updatedAt: new Date(),
      });

      const result = await useCases.get('theme');

      expect(result.value).toBe('dark');
      expect(settingsRepository.get).toHaveBeenCalledWith('theme');
    });

    it('returns null when setting not found', async () => {
      vi.mocked(settingsRepository.get).mockResolvedValue(null);

      const result = await useCases.get('nonexistent');

      expect(result.value).toBeNull();
    });

    it('returns null when setting value is undefined', async () => {
      vi.mocked(settingsRepository.get).mockResolvedValue({
        key: 'empty',
        value: undefined as unknown as string,
        updatedAt: new Date(),
      });

      const result = await useCases.get('empty');

      expect(result.value).toBeNull();
    });
  });

  describe('set', () => {
    it('saves setting value', async () => {
      vi.mocked(settingsRepository.set).mockResolvedValue({
        key: 'theme',
        value: 'light',
        updatedAt: new Date(),
      });

      await useCases.set('theme', 'light');

      expect(settingsRepository.set).toHaveBeenCalledWith('theme', 'light');
    });

    it('overwrites existing setting', async () => {
      vi.mocked(settingsRepository.set).mockResolvedValue({
        key: 'fontSize',
        value: '16',
        updatedAt: new Date(),
      });

      await useCases.set('fontSize', '16');

      expect(settingsRepository.set).toHaveBeenCalledWith('fontSize', '16');
    });
  });

  describe('getAll', () => {
    it('returns all settings', async () => {
      const allSettings = [
        { key: 'theme', value: 'dark', updatedAt: new Date('2024-01-01') },
        { key: 'fontSize', value: '14', updatedAt: new Date('2024-01-02') },
      ];
      vi.mocked(settingsRepository.getAll).mockResolvedValue(allSettings);

      const result = await useCases.getAll();

      expect(result.settings).toHaveLength(2);
      expect(result.settings[0].key).toBe('theme');
      expect(result.settings[0].value).toBe('dark');
      expect(result.settings[0].updatedAt).toBe(new Date('2024-01-01').getTime());
    });

    it('returns empty array when no settings', async () => {
      vi.mocked(settingsRepository.getAll).mockResolvedValue([]);

      const result = await useCases.getAll();

      expect(result.settings).toHaveLength(0);
    });
  });
});
