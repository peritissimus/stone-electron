import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllTodos = vi.fn();
const getGraphData = vi.fn();

vi.mock('@renderer/api', () => ({
  noteAPI: {
    getAllTodos,
    getGraphData,
  },
}));

const { useWorkspaceStore } = await import('@renderer/services/workspace/model/workspaceStore');
const { useTaskStore } = await import('@renderer/features/tasks/model/taskStore');
const { useGraphStore } = await import('@renderer/features/graph/model/graphStore');
const { useViewStateStore } = await import('@renderer/services/view-state/model/viewStateStore');

describe('persistent workbench caches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({ activeWorkspaceId: 'workspace-a' });
    useTaskStore.setState({
      todos: [],
      workspaceId: null,
      loaded: false,
      loading: false,
      refreshing: false,
      error: null,
    });
    useGraphStore.setState({
      data: { nodes: [], links: [] },
      workspaceId: null,
      loaded: false,
      loading: false,
      refreshing: false,
      error: null,
    });
    useViewStateStore.setState({ scrollPositions: {} });
  });

  it('reuses task data when a view is reopened in the same workspace', async () => {
    getAllTodos.mockResolvedValue({ success: true, data: [] });

    await useTaskStore.getState().ensureLoaded();
    await useTaskStore.getState().ensureLoaded();

    expect(getAllTodos).toHaveBeenCalledTimes(1);
    expect(useTaskStore.getState()).toMatchObject({
      loaded: true,
      workspaceId: 'workspace-a',
    });
  });

  it('reloads graph data after the active workspace changes', async () => {
    getGraphData.mockResolvedValue({ success: true, data: { nodes: [], links: [] } });

    await useGraphStore.getState().ensureLoaded();
    useWorkspaceStore.setState({ activeWorkspaceId: 'workspace-b' });
    await useGraphStore.getState().ensureLoaded();

    expect(getGraphData).toHaveBeenCalledTimes(2);
    expect(useGraphStore.getState().workspaceId).toBe('workspace-b');
  });

  it('clears only scroll positions owned by the closed workspace', () => {
    const store = useViewStateStore.getState();
    store.setScrollPosition('workspace-a:tasks', 320);
    store.setScrollPosition('workspace-b:tasks', 140);

    useViewStateStore.getState().clearWorkspace('workspace-a');

    expect(useViewStateStore.getState().scrollPositions).toEqual({
      'workspace-b:tasks': 140,
    });
  });
});
