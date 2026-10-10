import { shell } from 'electron';
import type { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';
import { logger } from '../../shared/utils/logger';

// Only windows explicitly registered by the bootstrap may use the preload API.
const rendererLocations = new WeakMap<WebContents, readonly string[]>();

export function isAllowedRendererUrl(value: string, allowedLocations: readonly string[]): boolean {
  try {
    const candidate = new URL(value);
    if (candidate.username || candidate.password) return false;
    return allowedLocations.some((location) => {
      const allowed = new URL(location);
      if (allowed.protocol === 'file:') {
        // HashRouter changes only the fragment. Never grant every local file access.
        candidate.hash = '';
        allowed.hash = '';
        return candidate.href === allowed.href;
      }
      return (
        (allowed.protocol === 'http:' || allowed.protocol === 'https:') &&
        candidate.protocol === allowed.protocol &&
        candidate.origin === allowed.origin
      );
    });
  } catch {
    return false;
  }
}

export function isTrustedRenderer(
  event: Pick<IpcMainEvent | IpcMainInvokeEvent, 'sender' | 'senderFrame'>,
): boolean {
  const { sender, senderFrame } = event;
  const locations = rendererLocations.get(sender);
  return Boolean(
    locations &&
    !sender.isDestroyed() &&
    senderFrame &&
    senderFrame === sender.mainFrame &&
    isAllowedRendererUrl(senderFrame.url, locations),
  );
}

function openExternalLink(value: string): void {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return;
    void shell.openExternal(url.href).catch((error: unknown) => {
      logger.warn('[WindowSecurity] failed to open external link', { error });
    });
  } catch {
    // Invalid links never reach the OS shell.
  }
}

export function hardenWindowNavigation(
  win: BrowserWindow,
  allowedLocations: readonly string[],
): void {
  rendererLocations.set(win.webContents, [...allowedLocations]);

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalLink(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event) => {
    if (isAllowedRendererUrl(event.url, allowedLocations)) return;
    event.preventDefault();
    openExternalLink(event.url);
  });

  // Redirects and subframes have separate events; will-navigate alone misses them.
  win.webContents.on('will-frame-navigate', (event) => {
    // The main-frame will-navigate handler also opens user-clicked HTTPS links.
    // Cancelling its earlier frame event would prevent that handler from running.
    if (!event.isMainFrame) event.preventDefault();
  });
  win.webContents.on('will-redirect', (event) => {
    if (!event.isMainFrame || !isAllowedRendererUrl(event.url, allowedLocations)) {
      event.preventDefault();
    }
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
}
