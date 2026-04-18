import { useWorkspaceStore } from '@renderer/stores/workspaceStore';

export function useWorkspaces() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  return {
    workspaces,
    activeWorkspaceId,
  };
}
