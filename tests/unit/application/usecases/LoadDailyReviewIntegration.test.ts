import { describe, expect, it, vi } from 'vitest';
import { LoadDailyReviewIntegrationUseCase } from '../../../../src/main/application/usecases/dailyReview/LoadDailyReviewIntegrationUseCase';
import type { IExternalSourceRegistry } from '../../../../src/main/domain';

describe('LoadDailyReviewIntegrationUseCase', () => {
  it('delegates loading and date policy to the external-source registry', async () => {
    const result = {
      source: 'calendar' as const,
      status: 'connected' as const,
      data: { events: [] },
    };
    const registry: IExternalSourceRegistry = {
      load: vi.fn(async () => result),
      loadAll: vi.fn(),
      mergeInto: vi.fn((snapshot) => snapshot),
    };
    const useCase = new LoadDailyReviewIntegrationUseCase({
      externalSourceRegistry: registry,
    });

    await expect(useCase.execute({ source: 'calendar', date: '2026-07-16' })).resolves.toEqual(
      result,
    );
    expect(registry.load).toHaveBeenCalledWith('calendar', { date: '2026-07-16' });
  });
});
