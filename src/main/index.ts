/**
 * Stone - Main Process Entry Point
 *
 * Minimal entry point that bootstraps the hex architecture.
 */

import 'dotenv/config';
import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import path from 'node:path';
import net from 'node:net';
import { lookup as dnsLookup } from 'node:dns';

// Import from main architecture
import { logger } from '@main/shared/utils/logger';
import { isDev } from '@main/infrastructure/utils/environment';
import { getDatabaseManager } from '@main/infrastructure/database';
import {
  initializeContainer,
  registerIPCHandlers,
  unregisterIPCHandlers,
  getContainer,
} from '@main/infrastructure/di/container';
import { PerformanceMonitor } from '@main/adapters/out/integrations/PerformanceMonitor';
import { EVENTS, MEETING_CHANNELS } from '@shared/constants/ipcChannels';
import {
  createTray,
  destroyTray,
  updateTrayState,
  type TrayRecorderPhase,
} from '@main/infrastructure/electron/tray';

// Create at module load so the constructor's performance.now() reading
// captures the earliest possible app start time. Passed into the DI
// container as a regular dep — no singleton accessor.
const perfMonitor = new PerformanceMonitor();

// Log startup
logger.info('='.repeat(60));
logger.info('Stone Application Starting...');
logger.info(`Platform: ${process.platform}`);
logger.info(`Electron: ${process.versions.electron}`);
logger.info(`Node: ${process.versions.node}`);
logger.info(`Chrome: ${process.versions.chrome}`);
logger.info(`isDev: ${isDev}`);
logger.info(`__dirname: ${__dirname}`);
logger.info('='.repeat(60));

let mainWindow: BrowserWindow | null = null;
let quickCaptureWindow: BrowserWindow | null = null;

async function isPortOpen(port: number, host = 'localhost'): Promise<boolean> {
  // Probe each address family Node resolves for the host. Node's `net.connect`
  // only hits one family at a time, and Vite often binds to IPv6 (`::1`) on
  // macOS — a hard-coded '127.0.0.1' probe would miss it and cause us to fall
  // through to the next candidate port, where an unrelated process (e.g. a
  // stray python http.server) can answer and poison module loads.
  const addresses = await new Promise<string[]>((resolve) => {
    dnsLookup(host, { all: true }, (err, found) => {
      if (err || !found?.length) {
        resolve([host]);
        return;
      }
      resolve(found.map((a) => a.address));
    });
  });

  for (const address of addresses) {
    const reachable = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ port, host: address });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });
    if (reachable) return true;
  }
  return false;
}

async function resolveDevServerUrl(): Promise<string> {
  const configuredPort = Number(process.env.VITE_PORT ?? '5173');
  const portCandidates = [configuredPort, configuredPort + 1, configuredPort + 2];

  for (const port of portCandidates) {
    if (await isPortOpen(port)) {
      return `http://localhost:${port}`;
    }
  }

  return `http://localhost:${configuredPort}`;
}

// --- "Open With" handling -----------------------------------------------
//
// When macOS/Windows launches Stone with a file (Finder → Open With, or a
// second click while Stone is already running), we route the path into the
// scratch editor. Three entry points:
//
//   1. macOS cold start: `open-file` fires BEFORE `ready`. We can't send IPC
//      yet (no window), so we buffer paths in `pendingOpenPaths` and drain
//      them after the window is ready.
//   2. macOS warm: `open-file` fires with mainWindow already alive.
//   3. Windows/Linux: no `open-file` event. The initial path arrives in
//      `process.argv`; subsequent clicks re-launch and collide with the
//      single-instance lock, triggering `second-instance` with the argv
//      of the new invocation. Parse that argv for the path.
//
// Single-instance lock: without it, clicking N files spawns N Stones. The
// lock causes subsequent launches to hand their argv to us and exit.

const pendingOpenPaths: string[] = [];

function queueOrDeliverScratchPath(filePath: string): void {
  if (!filePath) return;
  logger.info(`[OpenWith] Received file path: ${filePath}`);
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    // If the window is still loading, defer until it finishes so the
    // renderer's subscriber is mounted.
    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow?.webContents.send(EVENTS.SCRATCH_OPEN_PATH, filePath);
      });
    } else {
      mainWindow.webContents.send(EVENTS.SCRATCH_OPEN_PATH, filePath);
    }
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  pendingOpenPaths.push(filePath);
}

function drainPendingOpenPaths(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  while (pendingOpenPaths.length > 0) {
    const p = pendingOpenPaths.shift();
    if (p) mainWindow.webContents.send(EVENTS.SCRATCH_OPEN_PATH, p);
  }
}

function pickFilePathFromArgv(argv: string[]): string | null {
  // Skip argv[0] (electron binary) and argv[1] (app path on packaged
  // builds) — the interesting entry is typically the first argument
  // that looks like a .md file.
  for (const arg of argv.slice(1)) {
    if (!arg || arg.startsWith('-')) continue;
    const lower = arg.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      return path.resolve(arg);
    }
  }
  return null;
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  // Another Stone already owns the lock — our argv has been forwarded to
  // that instance via second-instance; quit quietly.
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = pickFilePathFromArgv(argv);
    if (filePath) queueOrDeliverScratchPath(filePath);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// macOS-only: fires when the user opens a file from Finder/Dock. May fire
// before `ready` on cold start — queue in that case.
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  queueOrDeliverScratchPath(filePath);
});

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

/**
 * Create the main application window
 */
async function createWindow() {
  try {
    logger.info('Creating BrowserWindow...');
    const preloadPath = path.join(__dirname, '../preload.cjs');
    logger.info(`Preload path: ${preloadPath}`);

    // Determine icon path based on platform
    let iconPath: string | undefined;
    if (process.platform === 'linux') {
      iconPath = path.join(__dirname, '../../build/icon.png');
    } else if (process.platform === 'darwin') {
      iconPath = path.join(__dirname, '../../build/icon.icns');
    } else if (process.platform === 'win32') {
      iconPath = path.join(__dirname, '../../build/icon.ico');
    }

    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      icon: iconPath,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      transparent: process.platform === 'darwin',
      backgroundColor: process.platform === 'darwin' ? undefined : '#ffffff',
      vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
      visualEffectState: 'active',
      trafficLightPosition: { x: 12, y: 8 },
    });

    logger.info('BrowserWindow created successfully');

    // Load the app
    if (isDev) {
      const devServerUrl = await resolveDevServerUrl();
      logger.info(`Loading dev server at ${devServerUrl}`);
      await mainWindow.loadURL(devServerUrl);
      mainWindow.webContents.openDevTools();
    } else {
      const htmlPath = path.join(__dirname, '../renderer/index.html');
      logger.info(`Loading production build from: ${htmlPath}`);
      await mainWindow.loadFile(htmlPath);
    }

    logger.info('Window loaded successfully');

    // Track when window is ready to show
    mainWindow.once('ready-to-show', () => {
      perfMonitor.markWindowReady();
    });

    mainWindow.on('closed', () => {
      logger.info('Window closed');
      mainWindow = null;
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      logger.error(`Failed to load: ${errorCode} - ${errorDescription}`);
    });
  } catch (error) {
    logger.error('Error creating window:', error);
    throw error;
  }
}

/**
 * Create the quick capture floating window
 */
function createQuickCaptureWindow() {
  if (quickCaptureWindow) {
    quickCaptureWindow.focus();
    return;
  }

  const preloadPath = path.join(__dirname, '../preload.cjs');

  quickCaptureWindow = new BrowserWindow({
    width: 500,
    height: 140,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    transparent: process.platform === 'darwin',
    backgroundColor: process.platform === 'darwin' ? undefined : '#ffffff',
    vibrancy: process.platform === 'darwin' ? 'popover' : undefined,
    visualEffectState: 'active',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load quick capture route
  if (isDev) {
    void resolveDevServerUrl().then((devServerUrl) => {
      void quickCaptureWindow?.loadURL(`${devServerUrl}/#/quick-capture`);
    });
  } else {
    const htmlPath = path.join(__dirname, '../renderer/index.html');
    quickCaptureWindow.loadFile(htmlPath, { hash: '/quick-capture' });
  }

  quickCaptureWindow.once('ready-to-show', () => {
    quickCaptureWindow?.show();
    quickCaptureWindow?.focus();
  });

  quickCaptureWindow.on('blur', () => {
    quickCaptureWindow?.close();
  });

  quickCaptureWindow.on('closed', () => {
    quickCaptureWindow = null;
  });

  logger.info('[QuickCapture] Window created');
}

/**
 * App ready event
 */
app.on('ready', async () => {
  try {
    // Initialize database
    logger.info('🔄 Initializing database...');
    const dbManager = getDatabaseManager();
    await dbManager.initialize();
    perfMonitor.markStartupPhase('dbInitTime');
    logger.info('✓ Database initialized');

    // Initialize hex DI container
    logger.info('🔄 Initializing hex DI container...');
    const container = initializeContainer({
      db: dbManager.getDrizzle(),
      dbManager: dbManager,
      perfMonitor,
    });
    perfMonitor.markStartupPhase('containerInitTime');
    logger.info('✓ Hex DI container initialized');

    // Register hex IPC handlers
    logger.info('🔄 Registering hex IPC handlers...');
    registerIPCHandlers();
    perfMonitor.markStartupPhase('ipcRegistrationTime');
    logger.info('✓ Hex IPC handlers registered');

    // Cross-window bridge: Quick Capture asks main window to open the
    // recording dock. Main window subscribes to MEETING_OPEN_DOCK_REQUESTED.
    ipcMain.handle(MEETING_CHANNELS.REQUEST_RECORDING, () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send(EVENTS.MEETING_OPEN_DOCK_REQUESTED);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    });

    // Renderer push: recorder phase changes → tray reflects them.
    ipcMain.handle(
      MEETING_CHANNELS.TRAY_SET_STATE,
      (_event, payload: { phase: TrayRecorderPhase }) => {
        updateTrayState({ phase: payload.phase });
      },
    );

    // Create window
    await createWindow();
    perfMonitor.markStartupPhase('windowCreationTime');
    logger.info('✓ Application window created');

    // Windows/Linux cold start: the path comes on argv, not via open-file.
    // On macOS this is a no-op — open-file already queued anything relevant.
    const coldStartPath = pickFilePathFromArgv(process.argv);
    if (coldStartPath) queueOrDeliverScratchPath(coldStartPath);

    // Drain any paths queued before the window existed. Wait for the
    // renderer to finish loading so the subscriber is guaranteed mounted.
    if (mainWindow) {
      const deliverPending = () => drainPendingOpenPaths();
      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', deliverPending);
      } else {
        deliverPending();
      }
    }

    // Register global shortcut for quick capture
    const quickCaptureShortcut = 'Alt+Space';
    const registered = globalShortcut.register(quickCaptureShortcut, () => {
      logger.info('[QuickCapture] Global shortcut triggered');
      createQuickCaptureWindow();
    });

    if (registered) {
      logger.info(`✓ Global shortcut registered: ${quickCaptureShortcut}`);
    } else {
      logger.warn(`✗ Failed to register global shortcut: ${quickCaptureShortcut}`);
    }

    // System tray (menu bar on macOS). One-click path to start a
    // recording from anywhere on the system.
    createTray({ getMainWindow: () => mainWindow });

    // Start file watcher for all workspaces
    try {
      await container.fileWatcher.start();
    } catch (e) {
      logger.error('Failed to start file watcher:', e);
    }

    // Mark startup complete and start continuous monitoring
    perfMonitor.markStartupComplete();
    perfMonitor.startMonitoring();
  } catch (error) {
    logger.error('Failed to start application:', error);
    app.quit();
  }
});

/**
 * Quit when all windows are closed
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Clean up before quitting
 */
app.on('before-quit', () => {
  logger.info('App quitting, cleaning up...');

  // Stop performance monitoring
  perfMonitor.stopMonitoring();

  // Tear down the tray so it stops listening + frees the menu bar slot
  destroyTray();

  // Unregister all global shortcuts
  globalShortcut.unregisterAll();

  // Unregister IPC handlers
  try {
    unregisterIPCHandlers();
  } catch {
    // Container may not be initialized yet
  }

  // Close database
  try {
    const dbManager = getDatabaseManager();
    dbManager.close();
  } catch {
    // May not be initialized
  }

  // Stop watchers
  try {
    const container = getContainer();
    container.fileWatcher.stopAll().catch(() => {});
  } catch {
    // Container may not be initialized yet
  }
});

/**
 * Re-create window when app is activated on macOS
 */
app.on('activate', async () => {
  if (mainWindow === null) {
    await createWindow();
  }
});
