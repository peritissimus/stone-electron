/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import {
  useShortcut,
  useShortcuts,
  useShortcutsDisplay,
} from '@renderer/features/settings/hooks/useShortcuts';
import { useShortcutsStore } from '@renderer/features/settings/model/shortcutsStore';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

it('refreshes individual, grouped and formatted shortcuts when bindings change or reset', () => {
  const previousBindings = useShortcutsStore.getState().customBindings;
  const container = document.createElement('div');
  const root = createRoot(container);
  let current: {
    single: ReturnType<typeof useShortcut>;
    all: ReturnType<typeof useShortcuts>;
    display: ReturnType<typeof useShortcutsDisplay>;
  };
  function Probe() {
    current = {
      single: useShortcut('settings'),
      all: useShortcuts(),
      display: useShortcutsDisplay(),
    };
    return null;
  }
  try {
    act(() => root.render(<Probe />));
    const originalKey = current!.single.key;
    const originalDisplay = current!.display.getDisplayString('settings');
    act(() =>
      useShortcutsStore.setState({
        customBindings: {
          ...previousBindings,
          settings: { key: 'p', metaKey: true, shiftKey: true, altKey: false },
        },
      }),
    );
    expect(current!.single.key).toBe('p');
    expect(current!.all.allShortcuts.find((item) => item.id === 'settings')?.key).toBe('p');
    expect(
      Object.values(current!.all.shortcutsByCategory)
        .flat()
        .find((item) => item.id === 'settings')?.key,
    ).toBe('p');
    expect(current!.display.getDisplayString('settings')).not.toBe(originalDisplay);
    act(() => useShortcutsStore.setState({ customBindings: previousBindings }));
    expect(current!.single.key).toBe(originalKey);
    expect(current!.display.getDisplayString('settings')).toBe(originalDisplay);
  } finally {
    act(() => root.unmount());
    useShortcutsStore.setState({ customBindings: previousBindings });
  }
});
