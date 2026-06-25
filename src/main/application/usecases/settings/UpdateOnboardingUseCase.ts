import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { OnboardingConfig } from '../../../domain/value-objects/AppConfig';
import type { OnboardingPatch } from './onboardingHelpers';
import { mergeOnboardingPatch, publishOnboardingChanged } from './onboardingHelpers';

export class UpdateOnboardingUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { onboarding: OnboardingPatch }): Promise<OnboardingConfig> {
    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      onboarding: mergeOnboardingPatch(config.onboarding, request.onboarding, new Date()),
    }));
    publishOnboardingChanged(this.eventPublisher);
    return next.onboarding;
  }
}
