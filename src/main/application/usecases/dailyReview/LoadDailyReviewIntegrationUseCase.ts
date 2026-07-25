import type {
  DailyReviewIntegrationResult,
  IExternalSourceRegistry,
  ILoadDailyReviewIntegrationUseCase,
  LoadDailyReviewIntegrationRequest,
} from '../../../domain';

export interface LoadDailyReviewIntegrationUseCaseDeps {
  externalSourceRegistry: IExternalSourceRegistry;
}

export class LoadDailyReviewIntegrationUseCase implements ILoadDailyReviewIntegrationUseCase {
  constructor(private readonly deps: LoadDailyReviewIntegrationUseCaseDeps) {}

  async execute(request: LoadDailyReviewIntegrationRequest): Promise<DailyReviewIntegrationResult> {
    return this.deps.externalSourceRegistry.load(request.source, { date: request.date });
  }
}
