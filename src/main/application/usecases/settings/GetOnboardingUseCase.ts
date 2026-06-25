import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { OnboardingConfig } from '../../../domain/value-objects/AppConfig';

export class GetOnboardingUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<OnboardingConfig> {
    const config = await this.appConfigRepository.get();
    return config.onboarding;
  }
}
