import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useViewStateStore } from '@renderer/services/view-state/model/viewStateStore';
import { useWorkspaceStore } from '@renderer/services/workspace/model/workspaceStore';

export function useViewScrollRestoration(viewId: string) {
  const elementRef = useRef<HTMLDivElement>(null);
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId) ?? 'no-workspace';
  const key = useMemo(() => `${workspaceId}:${viewId}`, [viewId, workspaceId]);
  const position = useViewStateStore((state) => state.scrollPositions[key] ?? 0);
  const setScrollPosition = useViewStateStore((state) => state.setScrollPosition);

  useLayoutEffect(() => {
    if (elementRef.current) elementRef.current.scrollTop = position;
  }, [key, position]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    let frame: number | null = null;
    const save = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        setScrollPosition(key, element.scrollTop);
      });
    };
    element.addEventListener('scroll', save, { passive: true });
    return () => {
      element.removeEventListener('scroll', save);
      if (frame !== null) cancelAnimationFrame(frame);
      setScrollPosition(key, element.scrollTop);
    };
  }, [key, setScrollPosition]);

  return elementRef;
}
