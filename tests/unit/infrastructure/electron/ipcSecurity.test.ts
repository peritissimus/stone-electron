import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent, WebContents } from 'electron';
import { EventEmitter } from 'node:events';

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    ipcMain: Object.assign(new EventEmitter(), { handle: vi.fn() }),
    shell: { openExternal: vi.fn() },
  };
});

beforeEach(() => vi.resetModules());

async function setup() {
  const { ipcMain } = await import('electron');
  ipcMain.removeAllListeners();
  ipcMain.emit = EventEmitter.prototype.emit;
  ipcMain.handle = vi.fn();
  const register = vi.mocked(ipcMain.handle);
  const { hardenWindowNavigation } =
    await import('../../../../src/main/infrastructure/electron/windowSecurity');
  const { installIpcSenderGuard } =
    await import('../../../../src/main/infrastructure/electron/ipcSecurity');
  const sender = {
    mainFrame: { url: 'file:///app/index.html' },
    isDestroyed: () => false,
    setWindowOpenHandler: vi.fn(),
    on: vi.fn(),
  } as unknown as WebContents;
  hardenWindowNavigation({ webContents: sender } as BrowserWindow, ['file:///app/index.html']);
  const event = { sender, senderFrame: sender.mainFrame } as IpcMainInvokeEvent;
  installIpcSenderGuard();
  installIpcSenderGuard();
  return { ipcMain, register, event };
}

describe('IPC sender guard', () => {
  it('rejects untrusted invokes before executing privileged handlers, including no-argument handlers', async () => {
    const { ipcMain, register, event } = await setup();
    const listener = vi.fn().mockResolvedValue('private notes');
    ipcMain.handle('notes:getAll', listener);
    const guarded = register.mock.calls[0][1];
    expect(() => guarded({ ...event, senderFrame: null })).toThrow('Untrusted IPC sender');
    expect(listener).not.toHaveBeenCalled();
    await expect(guarded(event)).resolves.toBe('private notes');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('guards send/sendSync dispatch without consuming once listeners or breaking removal', async () => {
    const { ipcMain, event } = await setup();
    const once = vi.fn();
    const removed = vi.fn();
    ipcMain.once('request', once);
    ipcMain.on('request', removed);
    ipcMain.removeListener('request', removed);
    const denied = { ...event, senderFrame: null, returnValue: undefined };
    expect(ipcMain.emit('request', denied)).toBe(false);
    expect(denied.returnValue).toBeNull();
    expect(once).not.toHaveBeenCalled();
    ipcMain.emit('request', event, 42);
    ipcMain.emit('request', event, 43);
    expect(once).toHaveBeenCalledExactlyOnceWith(event, 42);
    expect(removed).not.toHaveBeenCalled();
  });
});
