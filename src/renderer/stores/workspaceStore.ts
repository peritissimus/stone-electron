import { create } from 'zustand'
import { Workspace } from '@shared/types'

interface WorkspaceState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  loading: boolean
  error: string | null
  setWorkspaces: (workspaces: Workspace[]) => void
  setActiveWorkspaceId: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspaceId: null,
  loading: false,
  error: null,

  setWorkspaces: (workspaces) =>
    set({
      workspaces,
      activeWorkspaceId:
        workspaces.find((workspace) => workspace.isActive)?.id ?? null,
    }),

  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}))
