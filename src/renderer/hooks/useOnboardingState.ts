/**
 * useOnboardingState — read/persist the onboarding completion state that gates
 * the first-launch wizard. Thin wrapper over the onboarding store so components
 * (e.g. MainLayout) never import the store directly.
 */

import { useOnboardingStore } from '@renderer/stores/onboardingStore';

export function useOnboardingState() {
  const config = useOnboardingStore((s) => s.config);
  const loaded = useOnboardingStore((s) => s.loaded);
  const hydrate = useOnboardingStore((s) => s.hydrate);
  const markSteps = useOnboardingStore((s) => s.markSteps);
  const complete = useOnboardingStore((s) => s.complete);
  const reset = useOnboardingStore((s) => s.reset);

  return { config, loaded, hydrate, markSteps, complete, reset };
}
