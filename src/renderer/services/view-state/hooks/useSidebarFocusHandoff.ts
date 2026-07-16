import { useSidebarFocusStore } from '@renderer/services/view-state/model/sidebarFocusStore';

export function useSidebarFocusHandoff() {
  const pendingFocus = useSidebarFocusStore((s) => s.pendingFocus);
  const acknowledgeFocus = useSidebarFocusStore((s) => s.acknowledgeFocus);

  return { pendingFocus, acknowledgeFocus };
}
