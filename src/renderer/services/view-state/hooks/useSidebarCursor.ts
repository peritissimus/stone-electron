import { useSidebarFocusStore } from '@renderer/services/view-state/model/sidebarFocusStore';

export function useSidebarCursor() {
  const cursorPath = useSidebarFocusStore((s) => s.cursorPath);
  const setCursor = useSidebarFocusStore((s) => s.setCursor);
  const requestFocus = useSidebarFocusStore((s) => s.requestFocus);

  return {
    cursorPath,
    setCursor,
    requestFocus,
    getCursorPath: () => useSidebarFocusStore.getState().cursorPath,
  };
}
