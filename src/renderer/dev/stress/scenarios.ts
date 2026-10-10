import type { StressScenario } from './fixtures';

export const STRESS_SCENARIOS: ReadonlyArray<{ value: StressScenario; label: string }> = [
  { value: 'demo', label: 'Demo data' },
  { value: 'worst', label: 'Worst case' },
  { value: 'empty', label: 'Empty' },
  { value: 'one', label: 'One' },
  { value: 'huge', label: '1,284 rows' },
  { value: 'loading', label: 'Loading' },
  { value: 'error', label: 'Error' },
  { value: 'denied', label: 'No access' },
];

export function readStressScenario(): StressScenario {
  const data = new URL(window.location.href).searchParams.get('data');
  return STRESS_SCENARIOS.find((scenario) => scenario.value === data)?.value ?? 'demo';
}
