/** @vitest-environment jsdom */
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVirtualFileTree } from '@renderer/services/workspace/hooks/useVirtualFileTree';
import { useFileTreeStore } from '@renderer/services/workspace/model/fileTreeStore';
import { useSidebarFocusStore } from '@renderer/services/view-state/model/sidebarFocusStore';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('virtual file tree lifecycle', () => {
  let host: HTMLDivElement;
  let root: Root;
  let rowHeight: number;
  let resize: () => void;

  function Rows({ scroll }: { scroll: HTMLDivElement | null }) {
    const window = useVirtualFileTree(scroll);
    return (
      <div ref={window.listRef} data-kind="list">
        <div ref={window.measureRef} data-kind="measure" />
        {window.renderedIndices.map((index) => (
          <div key={index} data-index={index} />
        ))}
      </div>
    );
  }

  function Harness() {
    const [scroll, setScroll] = useState<HTMLDivElement | null>(null);
    return (
      <div ref={setScroll} data-kind="scroll">
        <Rows scroll={scroll} />
      </div>
    );
  }

  beforeEach(() => {
    rowHeight = 32;
    resize = () => undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.kind === 'scroll' ? 600 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const scroll = host.querySelector<HTMLElement>('[data-kind="scroll"]');
      const top = this.dataset.kind === 'list' ? 68 - (scroll?.scrollTop ?? 0) : 20;
      return new DOMRect(0, top, 200, this.dataset.kind === 'measure' ? rowHeight : 600);
    });
    useSidebarFocusStore.setState({ cursorPath: null });
    useFileTreeStore.getState().setTree(
      Array.from({ length: 1284 }, (_, index) => ({
        name: `Research interview ${index}.md`,
        path: `${index}.md`,
        type: 'file' as const,
      })),
    );
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('subscribes when the parent scroll element attaches after the first child render', () => {
    const scroll = host.querySelector<HTMLElement>('[data-kind="scroll"]')!;
    expect(host.querySelector('[data-index="0"]')).not.toBeNull();
    act(() => {
      scroll.scrollTop = 34048;
      scroll.dispatchEvent(new Event('scroll'));
    });
    expect(host.querySelector('[data-index="0"]')).toBeNull();
    expect(host.querySelector('[data-index="1000"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-index]').length).toBeLessThan(34);
  });

  it('remeasures text size and reveals a cursor outside the mounted window', () => {
    const scroll = host.querySelector<HTMLElement>('[data-kind="scroll"]')!;
    act(() => {
      rowHeight = 64;
      resize();
    });
    act(() => useSidebarFocusStore.getState().setCursor('1000.md'));
    expect(scroll.scrollTop).toBe(48 + 1000 * 66 + 64 - 600);
    expect(host.querySelector('[data-index="1000"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-index]').length).toBeLessThan(25);
  });
});
