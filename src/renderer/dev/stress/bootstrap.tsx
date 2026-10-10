import { installStressBridge } from './bridge';
import { readStressScenario } from './scenarios';

/** No drafts, preferences, or fixture edits ever reach the real app's storage. */
function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(String(key), String(value));
    },
  };
}

export async function startStressPreview(): Promise<void> {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: memoryStorage(), configurable: true });
  const environment = new URLSearchParams(window.location.search);
  // Environment probes are opt-in; production component styles stay untouched.
  if (environment.get('text') === '200') document.documentElement.style.fontSize = '32px';
  if (environment.get('dir') === 'rtl') document.documentElement.dir = 'rtl';
  const scenario = readStressScenario();
  const bridge = installStressBridge(scenario);
  if (!window.location.hash)
    window.history.replaceState(null, '', `${window.location.href}#/today`);

  // Install the isolated transport and storage BEFORE importing renderer stores.
  const [{ mountStressPreview }, { hydrateRendererServices }, { loadAppFonts }] = await Promise.all(
    [
      import('./preview'),
      import('@renderer/services/bootstrap/hydrateRenderer'),
      import('@renderer/lib/fontLoader'),
    ],
  );
  await hydrateRendererServices();
  void loadAppFonts();
  mountStressPreview(scenario, bridge);
}
