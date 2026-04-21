/**
 * Stone - Main Process Entry Point
 *
 * Minimal entry point that bootstraps the hex architecture.
 */

import 'dotenv/config';
import { app, BrowserWindow, globalShortcut } from 'electron';
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
import { getPerformanceMonitor } from '@main/adapters/out/integrations/PerformanceMonitor';

// Initialize performance monitoring immediately
const perfMonitor = getPerformanceMonitor();

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
    });
    perfMonitor.markStartupPhase('containerInitTime');
    logger.info('✓ Hex DI container initialized');

    // Register hex IPC handlers
    logger.info('🔄 Registering hex IPC handlers...');
    registerIPCHandlers();
    perfMonitor.markStartupPhase('ipcRegistrationTime');
    logger.info('✓ Hex IPC handlers registered');

    // Create window
    await createWindow();
    perfMonitor.markStartupPhase('windowCreationTime');
    logger.info('✓ Application window created');

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
