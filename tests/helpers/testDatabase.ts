/**
 * Test Database Helpers
 *
 * Provides utilities for setting up and tearing down test databases
 * using the actual DatabaseManager and Drizzle ORM.
 */

import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

// Store the test database path
let currentTestDbPath: string | null = null;

/**
 * Initialize a test database for repository tests
 * Sets DATABASE_URL env var and returns a cleanup function
 */
export async function setupTestDatabase(): Promise<{
  dbPath: string;
  cleanup: () => Promise<void>;
}> {
  // Ensure tmp directory exists
  const tmpDir = path.join(process.cwd(), 'tests', 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const testDbPath = path.join(tmpDir, `test-${nanoid()}.db`);
  currentTestDbPath = testDbPath;

  // Set DATABASE_URL before importing DatabaseManager
  process.env.DATABASE_URL = testDbPath;

  // Dynamically import to respect env var
  const { getDatabaseManager } = await import('../../src/main/database/DatabaseManager');
  const dbManager = getDatabaseManager();

  // Initialize the database (runs migrations)
  await dbManager.initialize();

  return {
    dbPath: testDbPath,
    cleanup: async () => {
      try {
        await dbManager.close();
      } catch {
        // Ignore close errors
      }

      // Clean up the database file
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }

      // Also clean up WAL and SHM files if they exist
      const walPath = `${testDbPath}-wal`;
      const shmPath = `${testDbPath}-shm`;
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

      currentTestDbPath = null;
      delete process.env.DATABASE_URL;
    },
  };
}

/**
 * Get the current test database path
 */
export function getTestDbPath(): string | null {
  return currentTestDbPath;
}

// Legacy exports removed - use setupTestDatabase instead
