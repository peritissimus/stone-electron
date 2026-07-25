import type {
  DailyReviewIntegrationResult,
  IExternalSourceRegistry,
  ILoadDailyReviewIntegrationsUseCase,
} from '../../../domain';

export class LoadDailyReviewIntegrationsUseCase
  implements ILoadDailyReviewIntegrationsUseCase
{
  constructor(private readonly registry: IExternalSourceRegistry) {}

  execute(request: { date?: string } = {}): Promise<DailyReviewIntegrationResult[]> {
    return this.registry.loadAll({ date: request.date });
  }
}
