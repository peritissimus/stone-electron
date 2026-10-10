import { ipcMain } from 'electron';
import type { IpcMainEvent } from 'electron';
import { isTrustedRenderer } from './windowSecurity';

let installed = false;

/** Install before instrumentation and handler registration, including bootstrap handlers. */
export function installIpcSenderGuard(): void {
  if (installed) return;
  installed = true;

  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, listener) => {
    handle(channel, (event, ...args) => {
      if (!isTrustedRenderer(event)) throw new Error('Untrusted IPC sender');
      return listener(event, ...args);
    });
  };
  // Electron implements handleOnce via this.handle, so it receives the same guard.

  // Guard dispatch rather than wrapping on/once/addListener: this preserves listener
  // identity, removal, and once semantics, while covering send and sendSync alike.
  const emit = ipcMain.emit.bind(ipcMain);
  ipcMain.emit = (channel, ...args) => {
    const event = args[0] as IpcMainEvent | undefined;
    if (event && typeof event === 'object' && 'sender' in event && !isTrustedRenderer(event)) {
      // A denied synchronous request must still release the sending renderer.
      if ('returnValue' in event) event.returnValue = null;
      return false;
    }
    return emit(channel, ...args);
  };
}
