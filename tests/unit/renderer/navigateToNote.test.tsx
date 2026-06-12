/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import { useNavigateToNote, useNavigateHome, toToday, toNote } from '@renderer/navigation';

function renderHook<T>(callback: () => T): { current: T; unmount: () => void; rerender: () => void } {
  const container = document.createElement('div');
  const root = createRoot(container);
  const ref: { current: T | undefined } = { current: undefined };

  function Harness({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, null, children);
  }
  function Probe() {
    ref.current = callback();
    return null;
  }

  flushSync(() => {
    root.render(createElement(Harness, null, createElement(Probe)));
  });

  return {
    get current(): T {
      return ref.current as T;
    },
    unmount: () => root.unmount(),
    rerender: () => {
      flushSync(() => {
        root.render(createElement(Harness, null, createElement(Probe)));
      });
    },
  };
}

describe('useNavigateToNote / useNavigateHome', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('useNavigateToNote(id) calls navigate with toNote(id)', () => {
    const hook = renderHook(() => useNavigateToNote());
    hook.current('abc123');
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith(toNote('abc123'));
    expect(navigateMock).toHaveBeenCalledWith('/note/abc123');
    hook.unmount();
  });

  it('useNavigateHome() routes to Today (home was removed)', () => {
    const hook = renderHook(() => useNavigateHome());
    hook.current();
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith(toToday());
    expect(navigateMock).toHaveBeenCalledWith('/today');
    hook.unmount();
  });

  it('useNavigateToNote returns a stable reference across renders', () => {
    const hook = renderHook(() => useNavigateToNote());
    const first = hook.current;
    hook.rerender();
    expect(hook.current).toBe(first);
    hook.unmount();
  });
});
