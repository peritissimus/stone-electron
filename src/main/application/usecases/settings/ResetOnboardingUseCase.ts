import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { OnboardingConfig } from '../../../domain/value-objects/AppConfig';
import { DEFAULT_APP_CONFIG } from '../../../domain/value-objects/AppConfig';
import { publishOnboardingChanged } from './onboardingHelpers';

export class ResetOnboardingUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(): Promise<OnboardingConfig> {
    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      onboarding: DEFAULT_APP_CONFIG.onboarding,
    }));
    publishOnboardingChanged(this.eventPublisher);
    return next.onboarding;
  }
}
