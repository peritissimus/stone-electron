import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSidebarFocusStore } from '@renderer/services/view-state/model/sidebarFocusStore';
import { getVisibleTreeCursorIndex, useVisibleTreeItems } from './useVisibleTreeItems';

const OVERSCAN = 6;
const ROW_GAP = 2;

/** Keep a small window plus rows whose interaction must survive scrolling. */
export function getTreeWindow(
  count: number,
  rowSize: number,
  scrollTop: number,
  viewportHeight: number,
  pinnedIndices: readonly number[] = [],
): number[] {
  if (count === 0) return [];
  const first = Math.min(count - 1, Math.max(0, Math.floor(scrollTop / rowSize)));
  const start = Math.max(0, first - OVERSCAN);
  const end = Math.min(
    count,
    Math.ceil((Math.max(0, scrollTop) + viewportHeight) / rowSize) + OVERSCAN,
  );
  const indices = new Set<number>();
  for (let index = start; index < end; index += 1) indices.add(index);
  for (const index of pinnedIndices) {
    if (index >= 0 && index < count) indices.add(index);
  }
  return [...indices].sort((a, b) => a - b);
}

/** Window the same flattened rows that drive sidebar keyboard navigation. */
export function useVirtualFileTree(scrollContainer: HTMLDivElement | null) {
  const items = useVisibleTreeItems();
  const cursorPath = useSidebarFocusStore((state) => state.cursorPath);
  const listRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [rowSize, setRowSize] = useState(34);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 600 });
  const [dragPath, setDragPath] = useState<string | null>(null);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const [focusPath, setFocusPath] = useState<string | null>(null);

  const readViewport = useCallback(() => {
    const scroll = scrollContainer;
    const list = listRef.current;
    if (!scroll || !list) return;
    const scrollTop =
      scroll.getBoundingClientRect().top + scroll.clientTop - list.getBoundingClientRect().top;
    setViewport((previous) =>
      previous.scrollTop === scrollTop && previous.height === scroll.clientHeight
        ? previous
        : { scrollTop, height: scroll.clientHeight },
    );
  }, [scrollContainer]);

  useLayoutEffect(() => {
    const scroll = scrollContainer;
    const measure = measureRef.current;
    if (!scroll || !measure) return;
    const readSize = () => {
      // h-8 follows root font size. ResizeObserver also catches text-size changes.
      const height = measure.getBoundingClientRect().height;
      if (height > 0) setRowSize(height + ROW_GAP);
      readViewport();
    };
    readSize();
    const observer = new ResizeObserver(readSize);
    observer.observe(scroll);
    observer.observe(measure);
    scroll.addEventListener('scroll', readViewport, { passive: true });
    return () => {
      observer.disconnect();
      scroll.removeEventListener('scroll', readViewport);
    };
  }, [scrollContainer, readViewport]);

  const cursorIndex = useMemo(
    () => getVisibleTreeCursorIndex(items, cursorPath),
    [items, cursorPath],
  );

  useLayoutEffect(() => {
    const scroll = scrollContainer;
    const list = listRef.current;
    if (!scroll || !list) return;
    if (cursorIndex >= 0) {
      const listTop =
        list.getBoundingClientRect().top -
        scroll.getBoundingClientRect().top -
        scroll.clientTop +
        scroll.scrollTop;
      const rowTop = listTop + cursorIndex * rowSize;
      const rowBottom = rowTop + rowSize - ROW_GAP;
      if (rowTop < scroll.scrollTop) scroll.scrollTop = rowTop;
      else if (rowBottom > scroll.scrollTop + scroll.clientHeight) {
        scroll.scrollTop = rowBottom - scroll.clientHeight;
      }
    }
    readViewport();
  }, [cursorIndex, items, rowSize, scrollContainer, readViewport]);

  const renderedIndices = useMemo(() => {
    const pinned = [cursorIndex];
    for (const path of [dragPath, menuPath, focusPath]) {
      if (path !== null) pinned.push(items.findIndex((item) => item.path === path));
    }
    return getTreeWindow(items.length, rowSize, viewport.scrollTop, viewport.height, pinned);
  }, [items, rowSize, viewport, cursorIndex, dragPath, menuPath, focusPath]);

  const onMenuOpenChange = useCallback((path: string, open: boolean) => {
    setMenuPath((current) => (open ? path : current === path ? null : current));
  }, []);

  return {
    items,
    listRef,
    measureRef,
    rowSize,
    renderedIndices,
    setDragPath,
    setFocusPath,
    onMenuOpenChange,
  };
}
