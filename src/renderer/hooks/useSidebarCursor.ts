import { useSidebarFocusStore } from '@renderer/stores/sidebarFocusStore';

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
