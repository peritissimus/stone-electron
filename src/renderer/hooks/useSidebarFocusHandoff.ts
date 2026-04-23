import { useSidebarFocusStore } from '@renderer/stores/sidebarFocusStore';

export function useSidebarFocusHandoff() {
  const pendingFocus = useSidebarFocusStore((s) => s.pendingFocus);
  const acknowledgeFocus = useSidebarFocusStore((s) => s.acknowledgeFocus);

  return { pendingFocus, acknowledgeFocus };
}
