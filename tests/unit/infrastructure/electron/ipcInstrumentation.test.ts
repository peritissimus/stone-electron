import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERFORMANCE_CHANNELS } from '../../../../src/shared/constants/ipcChannels';

interface IpcMainMock {
  handle: unknown;
}

async function loadWithIpc(ipcMain: IpcMainMock) {
  vi.resetModules();
  vi.doMock('electron', () => ({ ipcMain }));
  return import('../../../../src/main/infrastructure/electron/ipcInstrumentation');
}

describe('ipcInstrumentation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('electron');
  });

  it('wraps IPC handlers and records success from returned envelopes', async () => {
    const registered = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const ipcMain = {
      handle: vi.fn((channel: string, listener: (...args: unknown[]) => Promise<unknown>) => {
        registered.set(channel, listener);
      }),
    };
    const { instrumentIpcHandlers } = await loadWithIpc(ipcMain);
    const record = vi.fn();

    instrumentIpcHandlers(record);
    ipcMain.handle('notes:get', async () => ({ success: false }));

    await expect(registered.get('notes:get')?.({}, 'arg')).resolves.toEqual({ success: false });
    expect(record).toHaveBeenCalledWith('notes:get', expect.any(Number), false);
  });

  it('records thrown handler failures and rethrows', async () => {
    const registered = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const ipcMain = {
      handle: vi.fn((channel: string, listener: (...args: unknown[]) => Promise<unknown>) => {
        registered.set(channel, listener);
      }),
    };
    const { instrumentIpcHandlers } = await loadWithIpc(ipcMain);
    const record = vi.fn();

    instrumentIpcHandlers(record);
    ipcMain.handle('notes:boom', async () => {
      throw new Error('boom');
    });

    await expect(registered.get('notes:boom')?.({})).rejects.toThrow('boom');
    expect(record).toHaveBeenCalledWith('notes:boom', expect.any(Number), false);
  });

  it('does not wrap performance polling channels', async () => {
    const originalListener = vi.fn();
    const registered = new Map<string, unknown>();
    const ipcMain = {
      handle: vi.fn((channel: string, listener: unknown) => {
        registered.set(channel, listener);
      }),
    };
    const { instrumentIpcHandlers } = await loadWithIpc(ipcMain);

    instrumentIpcHandlers(vi.fn());
    ipcMain.handle(PERFORMANCE_CHANNELS.GET_SNAPSHOT, originalListener);

    expect(registered.get(PERFORMANCE_CHANNELS.GET_SNAPSHOT)).toBe(originalListener);
  });
});
