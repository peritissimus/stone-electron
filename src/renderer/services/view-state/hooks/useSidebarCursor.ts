import { useSidebarFocusStore } from '@renderer/services/view-state/model/sidebarFocusStore';

/** Only the old and new cursor rows need to update when the cursor moves. */
export function useSidebarItemCursor(path: string) {
  const isCursor = useSidebarFocusStore((state) => state.cursorPath === path);
  const requestFocus = useSidebarFocusStore((state) => state.requestFocus);
  return { isCursor, requestFocus };
}

const getCursorPath = () => useSidebarFocusStore.getState().cursorPath;

/** Workbench shortcuts need actions and a snapshot, not a render subscription. */
export function useSidebarCursor() {
  const setCursor = useSidebarFocusStore((s) => s.setCursor);
  const requestFocus = useSidebarFocusStore((s) => s.requestFocus);

  return {
    setCursor,
    requestFocus,
    getCursorPath,
  };
}
