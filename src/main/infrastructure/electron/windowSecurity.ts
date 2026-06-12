/**
 * Window navigation hardening (Electron security checklist §12–§14).
 *
 * App windows must only ever display our own UI: the packaged renderer
 * (file:) or the Vite dev server. Anything else — a crafted link in
 * imported markdown, a window.open from a compromised dependency — is
 * denied, and plain https links are handed to the user's browser instead
 * of loading inside a window that carries our preload bridge.
 */

import { shell } from 'electron';
import type { BrowserWindow } from 'electron';
import { logger } from '../../shared/utils/logger';

export function hardenWindowNavigation(win: BrowserWindow, allowedOrigins: string[]): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    } else {
      logger.warn(`[WindowSecurity] blocked window.open to ${url}`);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (allowedOrigins.some((origin) => url.startsWith(origin))) return;
    event.preventDefault();
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    } else {
      logger.warn(`[WindowSecurity] blocked navigation to ${url}`);
    }
  });
}
