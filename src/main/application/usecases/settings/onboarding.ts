import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type {
  OnboardingConfig,
  OnboardingStepState,
} from '../../../domain/value-objects/AppConfig';
import { DEFAULT_APP_CONFIG } from '../../../domain/value-objects/AppConfig';

export interface OnboardingPatch {
  completed?: boolean;
  steps?: Partial<OnboardingStepState>;
}

function publishOnboardingChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'onboarding' },
  });
}

function mergeOnboardingPatch(
  current: OnboardingConfig,
  patch: OnboardingPatch,
  now: Date,
): OnboardingConfig {
  const completed = patch.completed ?? current.completed;
  // Stamp completedAt on the transition into "completed"; clear it if reverted.
  const completedAt = completed
    ? (current.completedAt ?? now.toISOString())
    : null;

  return {
    completed,
    completedAt,
    steps: { ...current.steps, ...(patch.steps ?? {}) },
  };
}

export class GetOnboardingUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<OnboardingConfig> {
    const config = await this.appConfigRepository.get();
    return config.onboarding;
  }
}

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
