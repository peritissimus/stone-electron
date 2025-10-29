/**
 * Stone - Main Process Entry Point
 */

import { app, BrowserWindow } from 'electron'
import path from 'path'
import { isDev } from './utils/environment'
import { getDatabaseManager } from './database'

let mainWindow: BrowserWindow | null = null

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
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  })

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * App ready event
 */
app.on('ready', async () => {
  try {
    // Initialize database
    console.log('🔄 Initializing database...')
    const dbManager = getDatabaseManager()
    await dbManager.initialize()
    console.log('✓ Database initialized')

    // Create window
    await createWindow()
    console.log('✓ Application window created')
  } catch (error) {
    console.error('Failed to start application:', error)
    app.quit()
  }
})

/**
 * Quit when all windows are closed
 */
app.on('window-all-closed', () => {
  // Close database before quitting
  const dbManager = getDatabaseManager()
  dbManager.close()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/**
 * Re-create window when app is activated on macOS
 */
app.on('activate', async () => {
  if (mainWindow === null) {
    await createWindow()
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})
