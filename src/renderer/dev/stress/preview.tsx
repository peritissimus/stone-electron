import ReactDOM from 'react-dom/client';
import { App } from '@renderer/App';
import { STRESS_SCENARIOS } from './scenarios';
import { useStressPreview, type StressBridgeControl } from './useStressPreview';
import type { StressScenario } from './fixtures';
import '../../index.css';
import 'tippy.js/dist/tippy.css';
import './preview.css';

function StressPreview({
  initial,
  bridge,
}: {
  initial: StressScenario;
  bridge: StressBridgeControl;
}) {
  const { scenario, revision, switching, selectScenario } = useStressPreview(initial, bridge);
  return (
    <>
      <App key={revision} />
      <aside className="stress-toolbar" aria-label="Development test data">
        <span className="stress-caption">DEV · Isolated test data</span>
        <div className="stress-segments" role="group" aria-label="Dataset">
          {STRESS_SCENARIOS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={scenario === value}
              disabled={switching}
              onClick={() => void selectScenario(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}

export function mountStressPreview(initial: StressScenario, bridge: StressBridgeControl): void {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <StressPreview initial={initial} bridge={bridge} />,
  );
}
