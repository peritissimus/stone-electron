/**
 * Stone - Main Process Entry Point
 */

import 'dotenv/config';
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { isDev } from './utils/environment';
import { getDatabaseManager } from './database';
import { registerAllIpcHandlers } from './ipc';
import { logger } from './utils/logger';
import { getFileWatcherService } from './services/FileWatcherService';

let mainWindow: BrowserWindow | null = null;

/**
 * Create the main application window
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#ffffff',
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    trafficLightPosition: { x: 12, y: 8 },
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

    // Register IPC handlers
    logger.info('🔄 Registering IPC handlers...');
    registerAllIpcHandlers();
    logger.info('✓ IPC handlers registered');

    // Create window
    await createWindow();
    logger.info('✓ Application window created');

    // Start file watcher for all workspaces
    try {
      await getFileWatcherService().start();
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

  // Stop watchers
  getFileWatcherService()
    .stopAll()
    .catch(() => {});

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
