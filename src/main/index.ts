/**
 * Stone - Main Process Entry Point
 *
 * Minimal entry point that bootstraps the hex architecture.
 */

import 'dotenv/config';
import { app, BrowserWindow, globalShortcut } from 'electron';
import path from 'node:path';

// Import from main architecture
import { logger } from './shared/utils/logger';
import { isDev } from './infrastructure/utils/environment';
import { getDatabaseManager } from './infrastructure/database';
import {
  initializeContainer,
  registerIPCHandlers,
  unregisterIPCHandlers,
  getContainer,
} from './infrastructure/di/container';

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
      logger.info('Loading dev server at http://localhost:5173');
      await mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      const htmlPath = path.join(__dirname, '../renderer/index.html');
      logger.info(`Loading production build from: ${htmlPath}`);
      await mainWindow.loadFile(htmlPath);
    }

    logger.info('Window loaded successfully');

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
    quickCaptureWindow.loadURL('http://localhost:5173/#/quick-capture');
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
    logger.info('✓ Database initialized');

    // Initialize hex DI container
    logger.info('🔄 Initializing hex DI container...');
    const container = initializeContainer({
      db: dbManager.getDrizzle(),
      dbManager: dbManager,
    });
    logger.info('✓ Hex DI container initialized');

    // Register hex IPC handlers
    logger.info('🔄 Registering hex IPC handlers...');
    registerIPCHandlers();
    logger.info('✓ Hex IPC handlers registered');

    // Create window
    await createWindow();
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
      await container.fileWatcherService.start();
    } catch (e) {
      logger.error('Failed to start file watcher:', e);
    }
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
    container.fileWatcherService.stopAll().catch(() => {});
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
