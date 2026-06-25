import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type {
  OnboardingConfig,
  OnboardingStepState,
} from '../../../domain/value-objects/AppConfig';

export interface OnboardingPatch {
  completed?: boolean;
  steps?: Partial<OnboardingStepState>;
}

export function publishOnboardingChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'onboarding' },
  });
}

export function mergeOnboardingPatch(
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
