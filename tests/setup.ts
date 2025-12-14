/**
 * Test Setup - Global test configuration
 */

import { beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

// Don't mock electron - the DatabaseManager has a built-in fallback for non-Electron environments
// that provides a proper fallback app object when require('electron') fails

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    transports: {
      file: { level: 'info' },
      console: { level: 'info' },
    },
  },
}))

// Create test directories
beforeAll(() => {
  const testDir = path.join(process.cwd(), 'tests', 'tmp')
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
})

// Note: Don't clean up tests/tmp in afterAll - individual tests clean up their own directories
// This prevents race conditions with tests running in parallel
