import { useUIStore } from '@renderer/services/view-state/model/uiStore';

export function useWorkbenchLayoutState() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const editorFullscreen = useUIStore((state) => state.editorFullscreen);
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return { sidebarOpen, sidebarWidth, editorFullscreen, setSidebarWidth, toggleSidebar };
}
