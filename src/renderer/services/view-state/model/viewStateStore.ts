import { create } from 'zustand';

interface ViewState {
  scrollPositions: Record<string, number>;
  setScrollPosition: (key: string, position: number) => void;
  clearWorkspace: (workspaceId: string) => void;
}

export const useViewStateStore = create<ViewState>((set) => ({
  scrollPositions: {},
  setScrollPosition: (key, position) =>
    set((state) => ({
      scrollPositions: { ...state.scrollPositions, [key]: position },
    })),
  clearWorkspace: (workspaceId) =>
    set((state) => ({
      scrollPositions: Object.fromEntries(
        Object.entries(state.scrollPositions).filter(([key]) => !key.startsWith(`${workspaceId}:`)),
      ),
    })),
}));
