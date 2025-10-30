/**
 * Test Setup - Global test configuration
 */

import { beforeAll, afterAll, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// Mock Electron app module for tests
const mockApp = {
  getPath: (name: string) => {
    if (name === 'userData') {
      return path.join(process.cwd(), 'tests', 'tmp', 'userData')
    }
    return path.join(process.cwd(), 'tests', 'tmp')
  },
  isPackaged: false,
}

// Mock electron module
vi.mock('electron', () => ({
  app: mockApp,
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}))

// Create test directories
beforeAll(() => {
  const testDir = path.join(process.cwd(), 'tests', 'tmp')
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
})

// Clean up after all tests
afterAll(() => {
  const testDir = path.join(process.cwd(), 'tests', 'tmp')
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
})
