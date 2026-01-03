/**
 * Stone - Main Process Entry Point
 */

import 'dotenv/config';
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { isDev } from './utils/environment';
import { getDatabaseManager } from './database';
import { registerAllIpcHandlers } from './ipc';
import { logger } from './utils/logger';
import { getContainer } from './api/container';

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

    // Determine icon path based on platform and environment
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
      // In development, load from Vite dev server
      await mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      const htmlPath = path.join(__dirname, '../renderer/index.html');
      logger.info(`Loading production build from: ${htmlPath}`);
      // In production, load from built files
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
 * App ready event
 */
app.on('ready', async () => {
  try {
    // Initialize database
    logger.info('🔄 Initializing database...');
    const dbManager = getDatabaseManager();
    await dbManager.initialize();
    logger.info('✓ Database initialized');

    // Initialize DI container
    logger.info('🔄 Initializing DI container...');
    const container = getContainer();
    logger.info('✓ DI container initialized');

    // Register IPC handlers
    logger.info('🔄 Registering IPC handlers...');
    registerAllIpcHandlers(container);
    logger.info('✓ IPC handlers registered');

    // Create window
    await createWindow();
    logger.info('✓ Application window created');

    // Start file watcher for all workspaces
    try {
      await container.cradle.fileWatcherService.start();
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
  // Close database before quitting
  const dbManager = getDatabaseManager();
  dbManager.close();

  // Stop watchers (use container if available)
  try {
    const container = getContainer();
    container.cradle.fileWatcherService
      .stopAll()
      .catch(() => {});
  } catch {
    // Container may not be initialized yet
  }

  if (process.platform !== 'darwin') {
    app.quit();
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});
