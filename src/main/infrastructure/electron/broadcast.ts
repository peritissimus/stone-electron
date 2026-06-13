/**
 * broadcastToRenderers — push an event to every live renderer window.
 *
 * The main → renderer counterpart to ipcMain.handle. Used for unsolicited,
 * high-frequency UI signals (recording levels, ML progress) that don't fit the
 * request/response or typed domain-event models.
 */

import { BrowserWindow } from 'electron';

export function broadcastToRenderers(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}
