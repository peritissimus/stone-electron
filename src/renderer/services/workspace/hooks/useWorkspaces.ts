import { useWorkspaceStore } from '@renderer/services/workspace/model/workspaceStore';

export function useWorkspaces() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  return {
    workspaces,
    activeWorkspaceId,
  };
}
