/**
 * System tray (macOS menu bar / Windows tray / Linux notification area).
 *
 * Phase 1: always-visible idle icon with a static menu —
 *   New recording · Show Stone · Quit
 *
 * "New recording" focuses the main window and asks the renderer to
 * open the dock + auto-start a capture, so it's a one-click path from
 * anywhere on the system.
 *
 * Phase 2 (later) will swap the icon + title + menu based on the
 * recorder's state. That needs the renderer to push state to main via
 * IPC; for now the tray is stateless.
 */

import { Tray, Menu, nativeImage, app, type NativeImage } from 'electron';
import type { BrowserWindow } from 'electron';
import path from 'node:path';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../../shared/utils/logger';

let tray: Tray | null = null;

interface TrayDeps {
  /** Live accessor — main window may not exist yet at tray creation. */
  getMainWindow: () => BrowserWindow | null;
}

export function createTray(deps: TrayDeps): void {
  if (tray) {
    logger.warn('[Tray] createTray called twice, ignoring');
    return;
  }

  const icon = loadTrayIcon();
  if (!icon) {
    logger.warn('[Tray] could not load tray icon, skipping tray creation');
    return;
  }

  tray = new Tray(icon);
  tray.setToolTip('Stone');

  const focusMainWindow = (): BrowserWindow | null => {
    const win = deps.getMainWindow();
    if (!win || win.isDestroyed()) return null;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return win;
  };

  const sendToRenderer = (event: string) => {
    const win = focusMainWindow();
    if (!win) {
      logger.warn(`[Tray] no main window available to deliver ${event}`);
      return;
    }
    win.webContents.send(event);
  };

  const rebuildMenu = () => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'New recording',
        accelerator: 'CommandOrControl+Shift+R',
        click: () => sendToRenderer(EVENTS.MEETING_START_REQUESTED),
      },
      { type: 'separator' },
      {
        label: 'Show Stone',
        click: () => focusMainWindow(),
      },
      { type: 'separator' },
      {
        label: 'Quit Stone',
        role: 'quit',
      },
    ]);
    tray?.setContextMenu(menu);
  };

  rebuildMenu();

  // Left-click on the tray icon shows the menu on macOS automatically;
  // on Windows/Linux we have to open it ourselves.
  tray.on('click', () => {
    if (process.platform !== 'darwin') {
      tray?.popUpContextMenu();
    }
  });

  logger.info('[Tray] menu bar icon created');
}

export function destroyTray(): void {
  if (!tray) return;
  tray.destroy();
  tray = null;
}

/**
 * Resolve the tray icon. macOS gets the app icon as a template image so
 * the menu bar themes it correctly in dark/light mode. Windows/Linux
 * get the same image without template treatment.
 *
 * Dev: build/icon.png in the repo root.
 * Packaged: app.asar.unpacked/build/icon.png (electron-builder rule
 * keeps build/ unpacked alongside the asar).
 */
function loadTrayIcon(): NativeImage | null {
  const candidates = [
    // Packaged build — app icon is copied into Contents/Resources.
    path.join(process.resourcesPath, 'build', 'icon.png'),
    path.join(process.resourcesPath, 'icon.png'),
    // Dev — read straight from the repo.
    path.join(app.getAppPath(), 'build', 'icon.png'),
    path.join(app.getAppPath(), '..', 'build', 'icon.png'),
  ];

  for (const candidate of candidates) {
    try {
      const image = nativeImage.createFromPath(candidate);
      if (image.isEmpty()) continue;
      // Tray icons must be small. macOS expects ~22pt (44px @2x for
      // retina); other platforms accept 16-20px. Resize to 16, the
      // existing icon is grayscale+alpha so it themes acceptably on macOS.
      const resized = image.resize({ width: 16, height: 16, quality: 'best' });
      if (process.platform === 'darwin') {
        resized.setTemplateImage(true);
      }
      return resized;
    } catch (error) {
      logger.debug(`[Tray] failed to load icon from ${candidate}`, error);
    }
  }
  return null;
}
