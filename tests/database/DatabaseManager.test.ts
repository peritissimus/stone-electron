/**
 * DatabaseManager Tests
 *
 * Tests the complete database initialization flow including migrations.
 *
 * Note: These tests use the DatabaseManager's built-in fallback for non-Electron
 * environments, which stores data in ~/.stone or uses DATABASE_URL env var.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';

// Set DATABASE_URL before importing DatabaseManager to control the database path
const testDbPath = path.join(process.cwd(), 'tests', 'tmp', 'db-manager-test');

describe('DatabaseManager', () => {
  let DatabaseManager: typeof import('../../src/main/database/DatabaseManager').DatabaseManager;
  let dbManager: InstanceType<typeof DatabaseManager>;

  beforeAll(() => {
    // Ensure tmp directory exists
    if (!fs.existsSync(testDbPath)) {
      fs.mkdirSync(testDbPath, { recursive: true });
    }
  });

  beforeEach(async () => {
    // Clean up test directory
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true });
    }
    fs.mkdirSync(testDbPath, { recursive: true });

    // Set env var before each test
    process.env.DATABASE_URL = path.join(testDbPath, 'test.db');

    // Dynamic import to respect env var
    const module = await import('../../src/main/database/DatabaseManager');
    DatabaseManager = module.DatabaseManager;
    dbManager = new DatabaseManager();
  });

  afterEach(async () => {
    try {
      await dbManager.close();
    } catch {
      // Ignore close errors
    }

    // Clean up test directory
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    delete process.env.DATABASE_URL;
  });

  describe('initialization', () => {
    it('should initialize database successfully', async () => {
      await dbManager.initialize();
      const drizzle = dbManager.getDrizzle();
      expect(drizzle).toBeDefined();
    });

    it('should create data directory if it does not exist', async () => {
      await dbManager.initialize();
      const dataPath = dbManager.getDataPath();
      expect(fs.existsSync(dataPath)).toBe(true);
    });

    it('should create database file', async () => {
      await dbManager.initialize();
      const dbPath = dbManager.getDbPath();
      expect(fs.existsSync(dbPath)).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return database status', async () => {
      await dbManager.initialize();
      const status = await dbManager.getStatus();

      expect(status).toHaveProperty('version');
      expect(status).toHaveProperty('noteCount');
      expect(status).toHaveProperty('notebookCount');
      expect(status).toHaveProperty('tagCount');
      expect(status).toHaveProperty('attachmentCount');
      expect(status).toHaveProperty('databaseSize');
      expect(status).toHaveProperty('integrityOk');
    });

    it('should return correct types', async () => {
      await dbManager.initialize();
      const status = await dbManager.getStatus();

      expect(typeof status.version).toBe('number');
      expect(typeof status.noteCount).toBe('number');
      expect(typeof status.notebookCount).toBe('number');
      expect(typeof status.tagCount).toBe('number');
      expect(typeof status.attachmentCount).toBe('number');
      expect(typeof status.databaseSize).toBe('number');
      expect(typeof status.integrityOk).toBe('boolean');
    });
  });

  describe('checkIntegrity', () => {
    it('should pass integrity check for new database', async () => {
      await dbManager.initialize();
      const result = await dbManager.checkIntegrity();

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('optimize', () => {
    it('should run VACUUM and PRAGMA optimize', async () => {
      await dbManager.initialize();

      // Should not throw
      await expect(dbManager.optimize()).resolves.not.toThrow();
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      await dbManager.initialize();
      await dbManager.close();

      // Trying to use database after close should throw
      expect(() => dbManager.getDrizzle()).toThrow('Database not initialized');
    });
  });

  describe('error handling', () => {
    it('should throw error if accessing Drizzle before initialization', () => {
      expect(() => dbManager.getDrizzle()).toThrow('Database not initialized');
    });
  });

  describe('paths', () => {
    it('should return correct data path', async () => {
      await dbManager.initialize();
      const dataPath = dbManager.getDataPath();
      expect(dataPath).toBe(testDbPath);
    });

    it('should return correct db path', async () => {
      await dbManager.initialize();
      const dbPath = dbManager.getDbPath();
      expect(dbPath).toBe(path.join(testDbPath, 'test.db'));
    });
  });
});
