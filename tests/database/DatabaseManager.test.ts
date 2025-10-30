/**
 * DatabaseManager Tests
 *
 * Tests the complete database initialization flow including migrations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import { DatabaseManager } from '../../src/main/database/DatabaseManager';

// Mock electron app module
const mockUserDataPath = path.join(process.cwd(), 'tests', 'tmp', 'db-manager-test');

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: (name: string) => {
      if (name === 'userData') {
        return mockUserDataPath;
      }
      return mockUserDataPath;
    },
  },
}));

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(mockUserDataPath)) {
      fs.rmSync(mockUserDataPath, { recursive: true, force: true });
    }
    fs.mkdirSync(mockUserDataPath, { recursive: true });

    dbManager = new DatabaseManager();
  });

  afterEach(() => {
    dbManager.close();

    // Clean up test directory
    if (fs.existsSync(mockUserDataPath)) {
      fs.rmSync(mockUserDataPath, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize database successfully', async () => {
      await dbManager.initialize();

      const db = dbManager.getDatabase();
      expect(db).toBeDefined();
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

    it('should enable foreign keys', async () => {
      await dbManager.initialize();

      const db = dbManager.getDatabase();
      const result = db.pragma('foreign_keys', { simple: true });
      expect(result).toBe(1);
    });

    it('should run migrations on initialization', async () => {
      await dbManager.initialize();

      const db = dbManager.getDatabase();
      const migrations = db.prepare('SELECT COUNT(*) as count FROM __drizzle_migrations').get() as {
        count: number;
      };

      // Should have run at least the initial migration
      expect(migrations.count).toBeGreaterThan(0);
    });

    it('should create all tables from migrations', async () => {
      await dbManager.initialize();

      const db = dbManager.getDatabase();
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>;

      const tableNames = tables.map((t) => t.name);

      // Verify all expected tables exist
      expect(tableNames).toContain('notebooks');
      expect(tableNames).toContain('notes');
      expect(tableNames).toContain('tags');
      expect(tableNames).toContain('note_tags');
      expect(tableNames).toContain('attachments');
      expect(tableNames).toContain('note_versions');
      expect(tableNames).toContain('__drizzle_migrations');
    });

    it('should create Drizzle migrations table', async () => {
      await dbManager.initialize();

      const db = dbManager.getDatabase();
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>;

      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('__drizzle_migrations');
    });
  });

  describe('getStatus', () => {
    it('should return database status', async () => {
      await dbManager.initialize();

      const status = dbManager.getStatus();

      expect(status).toHaveProperty('version');
      expect(status).toHaveProperty('note_count');
      expect(status).toHaveProperty('notebook_count');
      expect(status).toHaveProperty('tag_count');
      expect(status).toHaveProperty('attachment_count');
      expect(status).toHaveProperty('database_size');
      expect(status).toHaveProperty('integrity_ok');
    });

    it('should return correct initial counts', async () => {
      await dbManager.initialize();

      const status = dbManager.getStatus();

      expect(status.note_count).toBe(0);
      expect(status.notebook_count).toBe(0);
      expect(status.tag_count).toBe(0);
      expect(status.attachment_count).toBe(0);
    });

    it('should return correct version', async () => {
      await dbManager.initialize();

      const status = dbManager.getStatus();
      const db = dbManager.getDatabase();
      const migrations = db
        .prepare('SELECT COUNT(*) as version FROM __drizzle_migrations')
        .get() as { version: number };

      expect(status.version).toBe(migrations.version);
    });
  });

  describe('checkIntegrity', () => {
    it('should pass integrity check for new database', async () => {
      await dbManager.initialize();

      const result = dbManager.checkIntegrity();

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('optimize', () => {
    it('should run VACUUM and PRAGMA optimize', async () => {
      await dbManager.initialize();

      // Should not throw
      expect(() => dbManager.optimize()).not.toThrow();
    });
  });

  describe('transaction', () => {
    it('should execute transactions successfully', async () => {
      await dbManager.initialize();

      const result = dbManager.transaction(() => {
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should rollback on error', async () => {
      await dbManager.initialize();

      const db = dbManager.getDatabase();

      // Insert initial data
      db.prepare(
        'INSERT INTO notebooks (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      ).run('nb1', 'Test', Date.now(), Date.now());

      // Try transaction that will fail
      try {
        dbManager.transaction(() => {
          db.prepare('DELETE FROM notebooks WHERE id = ?').run('nb1');
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected to throw
      }

      // Notebook should still exist (transaction rolled back)
      const notebook = db.prepare('SELECT * FROM notebooks WHERE id = ?').get('nb1');
      expect(notebook).toBeDefined();
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      await dbManager.initialize();

      dbManager.close();

      // Trying to use database after close should throw
      expect(() => dbManager.getDatabase()).toThrow('Database not initialized');
    });
  });

  describe('prepare and exec', () => {
    it('should prepare and execute statements', async () => {
      await dbManager.initialize();

      const stmt = dbManager.prepare('SELECT COUNT(*) as count FROM notebooks');
      const result = stmt.get() as { count: number };

      expect(result.count).toBe(0);
    });

    it('should execute SQL directly', async () => {
      await dbManager.initialize();

      expect(() => {
        dbManager.exec('CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY)');
      }).not.toThrow();
    });
  });

  describe('re-initialization', () => {
    it('should not re-run migrations on second initialization', async () => {
      // First initialization
      await dbManager.initialize();

      const db1 = dbManager.getDatabase();
      const migrationsAfterFirst = db1
        .prepare('SELECT COUNT(*) as count FROM __drizzle_migrations')
        .get() as { count: number };

      // Close and create new instance
      dbManager.close();

      const dbManager2 = new DatabaseManager();
      await dbManager2.initialize();

      const db2 = dbManager2.getDatabase();
      const migrationsAfterSecond = db2
        .prepare('SELECT COUNT(*) as count FROM __drizzle_migrations')
        .get() as { count: number };

      // Should have same migrations (no duplicates)
      expect(migrationsAfterSecond.count).toBe(migrationsAfterFirst.count);

      dbManager2.close();
    });
  });

  describe('error handling', () => {
    it('should throw error if accessing database before initialization', () => {
      expect(() => dbManager.getDatabase()).toThrow('Database not initialized');
    });

    it('should throw error if accessing Drizzle before initialization', () => {
      expect(() => dbManager.getDrizzle()).toThrow('Database not initialized');
    });
  });
});
