/**
 * Stone - React Renderer Entry Point
 */

// Skip heavy imports for quick capture window
const isQuickCapture = window.location.hash.includes('quick-capture');

// Only load why-did-you-render for main window (dev tool)
if (!isQuickCapture) {
  import('./wdyr');
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@renderer/App';
import './index.css';

// Hydrate config-backed stores before React first renders so shortcut and
// editor-settings overrides are visible on initial mount. Fire-and-forget;
// stores fall back to defaults on failure, and re-sync on settings:changed.
if (!isQuickCapture) {
  void import('@renderer/stores/shortcutsStore').then((m) =>
    m.useShortcutsStore.getState().hydrate(),
  );
  void import('@renderer/stores/editorConfigStore').then((m) =>
    m.useEditorConfigStore.getState().hydrate(),
  );
}

// Skip tippy.js for quick capture (not needed)
if (!isQuickCapture) {
  import('tippy.js/dist/tippy.css');
}

if (!isQuickCapture) {
  // Defer font loading - not critical for initial render
  // Fonts will load in background after app mounts
  requestIdleCallback(() => {
    import('@fontsource/inter/400.css');
    import('@fontsource/inter/500.css');
    import('@fontsource/inter/600.css');
    import('@fontsource/inter/700.css');
    import('@fontsource/barlow/400.css');
    import('@fontsource/barlow/500.css');
    import('@fontsource/barlow/600.css');
    import('@fontsource/barlow-condensed/400.css');
    import('@fontsource/barlow-condensed/500.css');
    import('@fontsource/barlow-condensed/600.css');
    import('@fontsource/barlow-condensed/700.css');
    import('@fontsource/barlow-semi-condensed/400.css');
    import('@fontsource/barlow-semi-condensed/500.css');
    import('@fontsource/barlow-semi-condensed/600.css');
    import('@fontsource/barlow-semi-condensed/700.css');
    import('@fontsource/patrick-hand/latin.css');
    import('@fontsource/fira-code/400.css');
    import('@fontsource/fira-code/500.css');
    import('@fontsource/fira-code/600.css');
  });
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
