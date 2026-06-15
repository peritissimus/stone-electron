/**
 * System tray (macOS menu bar / Windows tray / Linux notification area).
 *
 * Reflects the recorder's state in three places:
 *
 *   1. **Title** next to the icon — empty when idle, a live tabular-nums
 *      timer while recording ("00:42"), "Processing…" during the
 *      transcribe + summarise pipeline.
 *   2. **Menu items** — "New recording" while idle / done / error,
 *      "Stop and process" + "Cancel" while recording, just "Show Stone"
 *      while processing (so the user can't fire a fresh recording into
 *      a busy worker).
 *   3. **Icon** — the app's Stone glyph in every state.
 *
 * The renderer pushes its recorder phase to main via the
 * MEETING_CHANNELS.TRAY_SET_STATE channel; the tray tracks the
 * recording-started timestamp locally and runs its own 1Hz interval to
 * refresh the timer text. This keeps IPC traffic to phase transitions
 * only instead of streaming 5Hz timer updates over the bridge.
 */

import { Tray, Menu, nativeImage, app, type NativeImage } from 'electron';
import type { BrowserWindow } from 'electron';
import path from 'node:path';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../../shared/utils/logger';

export type TrayRecorderPhase =
  | 'idle'
  | 'preparing'
  | 'recording'
  | 'uploading'
  | 'finalizing'
  | 'done'
  | 'error';

let tray: Tray | null = null;

interface TrayState {
  phase: TrayRecorderPhase;
  /** Wall-clock ms at which the active recording started, set on the
   *  recording→active transition; null otherwise. */
  recordingStartedAt: number | null;
}

let state: TrayState = { phase: 'idle', recordingStartedAt: null };
let tickInterval: NodeJS.Timeout | null = null;

interface TrayDeps {
  /** Live accessor — main window may not exist yet at tray creation. */
  getMainWindow: () => BrowserWindow | null;
}

let deps: TrayDeps | null = null;

export function createTray(d: TrayDeps): void {
  if (tray) {
    logger.warn('[Tray] createTray called twice, ignoring');
    return;
  }
  deps = d;

  const icon = loadTrayIcon();
  if (!icon) {
    logger.warn('[Tray] could not load tray icon, skipping tray creation');
    return;
  }

  tray = new Tray(icon);
  tray.setToolTip('Stone');

  // Left-click on the tray icon shows the menu on macOS automatically;
  // on Windows/Linux we have to open it ourselves.
  tray.on('click', () => {
    if (process.platform !== 'darwin') tray?.popUpContextMenu();
  });

  applyState();
  logger.info('[Tray] menu bar icon created');
}

export function destroyTray(): void {
  stopTimerTick();
  if (!tray) return;
  tray.destroy();
  tray = null;
  deps = null;
}

/**
 * Renderer pushes its recorder phase here. We track the started-at
 * timestamp locally so the tray timer doesn't need 5Hz IPC traffic.
 */
export function updateTrayState(next: { phase: TrayRecorderPhase }): void {
  const previousPhase = state.phase;
  state = {
    phase: next.phase,
    recordingStartedAt:
      next.phase === 'recording'
        ? previousPhase === 'recording' && state.recordingStartedAt !== null
          ? state.recordingStartedAt
          : Date.now()
        : null,
  };

  if (next.phase === 'recording') {
    startTimerTick();
  } else {
    stopTimerTick();
  }

  applyState();
}

// ============================================================================
// Internal helpers
// ============================================================================

function focusMainWindow(): BrowserWindow | null {
  const win = deps?.getMainWindow() ?? null;
  if (!win || win.isDestroyed()) return null;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  return win;
}

function sendToRenderer(event: string): void {
  const win = focusMainWindow();
  if (!win) {
    logger.warn(`[Tray] no main window available to deliver ${event}`);
    return;
  }
  win.webContents.send(event);
}

function applyState(): void {
  if (!tray) return;
  tray.setTitle(formatTitle(state));
  tray.setContextMenu(buildMenu(state.phase));
  tray.setToolTip(formatTooltip(state));
}

function buildMenu(phase: TrayRecorderPhase): Menu {
  const items: Electron.MenuItemConstructorOptions[] = [];

  if (phase === 'recording') {
    items.push(
      {
        label: 'Stop and process',
        click: () => sendToRenderer(EVENTS.MEETING_STOP_REQUESTED),
      },
      {
        label: 'Cancel recording',
        click: () => sendToRenderer(EVENTS.MEETING_OPEN_DOCK_REQUESTED),
      },
      { type: 'separator' },
      { label: 'Show Stone', click: () => focusMainWindow() },
    );
  } else if (phase === 'preparing' || phase === 'uploading' || phase === 'finalizing') {
    items.push(
      { label: phaseLabel(phase), enabled: false },
      { type: 'separator' },
      { label: 'Show Stone', click: () => focusMainWindow() },
    );
  } else {
    // idle / done / error — same menu.
    items.push(
      {
        label: 'New recording',
        accelerator: 'CommandOrControl+Shift+R',
        click: () => sendToRenderer(EVENTS.MEETING_START_REQUESTED),
      },
      { type: 'separator' },
      { label: 'Show Stone', click: () => focusMainWindow() },
      { type: 'separator' },
      { label: 'Quit Stone', role: 'quit' },
    );
  }

  return Menu.buildFromTemplate(items);
}

function formatTitle(s: TrayState): string {
  if (s.phase === 'recording' && s.recordingStartedAt !== null) {
    return ` ● ${formatElapsed(Date.now() - s.recordingStartedAt)}`;
  }
  if (s.phase === 'preparing') return ' …';
  if (s.phase === 'uploading') return ' ↑';
  if (s.phase === 'finalizing') return ' ⟳';
  return '';
}

function formatTooltip(s: TrayState): string {
  switch (s.phase) {
    case 'recording':
      return s.recordingStartedAt !== null
        ? `Recording — ${formatElapsed(Date.now() - s.recordingStartedAt)}`
        : 'Recording';
    case 'preparing':
      return 'Stone — preparing recording';
    case 'uploading':
      return 'Stone — saving audio';
    case 'finalizing':
      return 'Stone — transcribing and summarising';
    case 'done':
      return 'Stone — recording finished';
    case 'error':
      return 'Stone — recording failed';
    default:
      return 'Stone';
  }
}

function phaseLabel(phase: TrayRecorderPhase): string {
  switch (phase) {
    case 'preparing':
      return 'Preparing…';
    case 'uploading':
      return 'Saving audio…';
    case 'finalizing':
      return 'Transcribing…';
    default:
      return '';
  }
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  if (hh > 0) return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  return `${pad(mm)}:${pad(ss)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function startTimerTick(): void {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    if (state.phase !== 'recording' || !tray) {
      stopTimerTick();
      return;
    }
    tray.setTitle(formatTitle(state));
  }, 1000);
}

function stopTimerTick(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

/**
 * Resolve the tray icon.
 *
 * Use the app icon as a normal raster icon. On macOS we intentionally do not
 * mark it as a template image: the Stone mark is line-heavy, so a template
 * mask becomes too faint in the menu bar without the white tile behind it.
 *
 * Packaged builds read electron-builder's Resources/icon.png; dev reads
 * straight from build/icon.png in the repo.
 */
function loadTrayIcon(): NativeImage | null {
  const candidates = [
    path.join(process.resourcesPath, 'icon.png'),
    path.join(app.getAppPath(), 'build', 'icon.png'),
  ];

  for (const candidate of candidates) {
    try {
      const image = nativeImage.createFromPath(candidate);
      if (image.isEmpty()) continue;
      if (process.platform === 'darwin') {
        const trayIcon = image.resize({ width: 18, height: 18, quality: 'best' });
        trayIcon.setTemplateImage(false);
        return trayIcon;
      }
      return image.resize({ width: 16, height: 16, quality: 'best' });
    } catch (error) {
      logger.debug(`[Tray] failed to load icon from ${candidate}`, error);
    }
  }
  return null;
}
