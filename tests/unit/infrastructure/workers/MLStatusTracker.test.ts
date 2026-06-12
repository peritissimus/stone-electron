import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '../../../../src/shared/constants/ipcChannels';

const electronMock = vi.hoisted(() => ({
  send: vi.fn(),
  BrowserWindow: {
    getAllWindows: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  BrowserWindow: electronMock.BrowserWindow,
}));

describe('MLStatusTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.BrowserWindow.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: { send: electronMock.send } },
      { isDestroyed: () => true, webContents: { send: vi.fn() } },
    ]);
  });

  it('tracks service state and operation lifecycle while broadcasting renderer events', async () => {
    const { createMLStatusTracker } = await import('../../../../src/main/infrastructure/workers/MLStatusTracker');
    const tracker = createMLStatusTracker();

    tracker.setServiceStatus('ready', { model: { name: 'mini', dims: 384 } });
    const id = tracker.startOperation('model-loading', { totalItems: 2, message: 'Indexing' });
    tracker.updateProgress(id, 1, 2, 'Halfway');
    tracker.completeOperation(id, { embedded: 2 });
    tracker.broadcastModelDownloadProgress({
      file: 'model.onnx',
      model: 'embedding',
      loaded: 50,
      total: 100,
    });

    expect(tracker.getServiceState()).toEqual({
      status: 'ready',
      error: undefined,
      model: { name: 'mini', dims: 384 },
    });
    expect(tracker.getCurrentOperation()).toBeNull();
    expect(tracker.getRecentOperations()).toHaveLength(1);
    expect(electronMock.send).toHaveBeenCalledWith(
      EVENTS.ML_STATUS_CHANGED,
      expect.objectContaining({ status: 'ready' }),
    );
    expect(electronMock.send).toHaveBeenCalledWith(
      EVENTS.ML_OPERATION_PROGRESS,
      expect.objectContaining({ id, current: 1, total: 2 }),
    );
    expect(electronMock.send).toHaveBeenCalledWith(
      EVENTS.ML_OPERATION_COMPLETED,
      expect.objectContaining({ id, results: { embedded: 2 } }),
    );
    expect(electronMock.send).toHaveBeenCalledWith(
      EVENTS.ML_MODEL_DOWNLOAD_PROGRESS,
      expect.objectContaining({ model: 'embedding', file: 'model.onnx', loaded: 50, total: 100 }),
    );
  });

  it('ignores progress for stale operations and records failed operations', async () => {
    const { createMLStatusTracker } = await import('../../../../src/main/infrastructure/workers/MLStatusTracker');
    const tracker = createMLStatusTracker();
    const id = tracker.startOperation('classify-all');

    tracker.updateProgress('wrong-id', 99, 100);
    tracker.failOperation(id, 'bad model');

    expect(tracker.getCurrentOperation()).toBeNull();
    expect(tracker.getRecentOperations()[0]).toMatchObject({
      id,
      type: 'classify-all',
      status: 'error',
      error: 'bad model',
    });
    expect(electronMock.send).toHaveBeenCalledWith(
      EVENTS.ML_OPERATION_ERROR,
      expect.objectContaining({ id, error: 'bad model' }),
    );
  });
});
