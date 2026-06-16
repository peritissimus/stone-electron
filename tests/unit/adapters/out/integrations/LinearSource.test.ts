import { describe, expect, it, vi } from 'vitest';
import { LinearSource } from '../../../../../src/main/adapters/out/integrations/LinearSource';
import type { IAppConfigRepository } from '../../../../../src/main/domain';
import { DEFAULT_APP_CONFIG, type AppConfig } from '../../../../../src/main/domain/value-objects/AppConfig';

function configWith(linearApiKey: string): IAppConfigRepository {
  const config: AppConfig = {
    ...DEFAULT_APP_CONFIG,
    integrations: { ...DEFAULT_APP_CONFIG.integrations, linearApiKey },
  };
  return { get: vi.fn(async () => config) } as unknown as IAppConfigRepository;
}

describe('LinearSource', () => {
  it('returns [] without calling the API when no key is configured', async () => {
    const fetchFn = vi.fn();
    const source = new LinearSource({ appConfigRepository: configWith(''), fetchFn });

    await expect(source.getAssignedIssues()).resolves.toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('maps assigned issue nodes from the GraphQL response', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          viewer: {
            assignedIssues: {
              nodes: [
                {
                  identifier: 'ENG-1',
                  title: 'Fix it',
                  priority: 2,
                  url: 'https://linear.app/x/ENG-1',
                  dueDate: '2026-07-01',
                  state: { name: 'In Progress' },
                },
              ],
            },
          },
        },
      }),
    })) as unknown as typeof fetch;
    const source = new LinearSource({ appConfigRepository: configWith('lin_api_x'), fetchFn });

    const issues = await source.getAssignedIssues();

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.linear.app/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'lin_api_x' }),
      }),
    );
    expect(issues).toEqual([
      {
        identifier: 'ENG-1',
        title: 'Fix it',
        state: 'In Progress',
        priority: 2,
        url: 'https://linear.app/x/ENG-1',
        dueDate: '2026-07-01',
      },
    ]);
  });

  it('returns [] when the request is not ok', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as unknown as typeof fetch;
    const source = new LinearSource({ appConfigRepository: configWith('lin_api_x'), fetchFn });

    await expect(source.getAssignedIssues()).resolves.toEqual([]);
  });

  it('returns [] when fetch throws', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const source = new LinearSource({ appConfigRepository: configWith('lin_api_x'), fetchFn });

    await expect(source.getAssignedIssues()).resolves.toEqual([]);
  });
});
