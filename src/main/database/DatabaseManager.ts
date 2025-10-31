/**
 * DatabaseManager - Core database connection and lifecycle management
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { logger } from '../utils/logger';

/**
 * Database Manager - Handles initialization, migrations, and lifecycle
 */
export class DatabaseManager {
  private sqlite: Database.Database | null = null;
  private db: ReturnType<typeof drizzle> | null = null;
  private dataPath: string;
  private dbPath: string;

  constructor() {
    // Use DATABASE_URL from .env or fall back to user data directory
    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl) {
      // If DATABASE_URL is relative, make it absolute from project root
      this.dbPath = path.isAbsolute(dbUrl) ? dbUrl : path.join(process.cwd(), dbUrl);
      this.dataPath = path.dirname(this.dbPath);
    } else {
      // Fall back to default user data directory
      this.dataPath = path.join(app.getPath('userData'), 'stone-data');
      this.dbPath = path.join(this.dataPath, 'notes.db');
    }

    // Ensure data directory exists
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`Database path: ${this.dbPath}`);

      // Open database
      this.sqlite = new Database(this.dbPath);

      // Enable foreign keys
      this.sqlite.pragma('foreign_keys = ON');

      // Create Drizzle instance
      this.db = drizzle(this.sqlite, { schema });

      // Run migrations
      await migrate(this.db, { migrationsFolder: path.join(process.cwd(), 'migrations') });

      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Get the Drizzle database instance
   */
  getDrizzle() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Get the raw SQLite database instance
   */
  getDatabase(): Database.Database {
    if (!this.sqlite) {
      throw new Error('Database not initialized');
    }
    return this.sqlite;
  }

  /**
   * Get the raw SQLite database instance (alias for getDatabase)
   */
  getDb(): Database.Database {
    return this.getDatabase();
  }

  /**
   * Execute a query
   */
  exec(sql: string): void {
    this.getDatabase().exec(sql);
  }

  /**
   * Prepare a statement
   */
  prepare(sql: string): Database.Statement {
    return this.getDatabase().prepare(sql);
  }

  /**
   * Run a transaction
   */
  transaction<T>(callback: () => T): T {
    const db = this.getDatabase();
    const transaction = db.transaction(callback);
    return transaction();
  }

  /**
   * Get database status
   */
  getStatus(): {
    version: number;
    noteCount: number;
    notebookCount: number;
    tagCount: number;
    attachmentCount: number;
    databaseSize: number;
    integrityOk: boolean;
  } {
    const db = this.getDatabase();

    // Get counts
    const noteCount = db
      .prepare('SELECT COUNT(*) as count FROM notes WHERE is_deleted = 0')
      .get() as { count: number };
    const notebookCount = db.prepare('SELECT COUNT(*) as count FROM notebooks').get() as {
      count: number;
    };
    const tagCount = db.prepare('SELECT COUNT(*) as count FROM tags').get() as { count: number };
    const attachmentCount = db.prepare('SELECT COUNT(*) as count FROM attachments').get() as {
      count: number;
    };

    // Get schema version (Drizzle uses __drizzle_migrations table)
    const schemaVersion = db
      .prepare('SELECT COUNT(*) as version FROM __drizzle_migrations')
      .get() as { version: number };

    // Get database file size
    const stats = fs.statSync(this.dbPath);
    const databaseSize = stats.size;

    return {
      version: schemaVersion.version || 0,
      noteCount: noteCount.count,
      notebookCount: notebookCount.count,
      tagCount: tagCount.count,
      attachmentCount: attachmentCount.count,
      databaseSize: databaseSize,
      integrityOk: true,
    };
  }

  /**
   * Check database integrity
   */
  checkIntegrity(): {
    ok: boolean;
    errors: string[];
  } {
    const db = this.getDatabase();

    try {
      const result = db.prepare('PRAGMA integrity_check').all() as Array<{
        integrity_check: string;
      }>;

      if (result.length === 1 && result[0].integrity_check === 'ok') {
        return { ok: true, errors: [] };
      }

      return {
        ok: false,
        errors: result.map((r) => r.integrity_check),
      };
    } catch (error) {
      return {
        ok: false,
        errors: [String(error)],
      };
    }
  }

  /**
   * Optimize database (VACUUM + ANALYZE)
   */
  optimize(): void {
    const db = this.getDatabase();
    db.exec('VACUUM');
    db.exec('PRAGMA optimize');
    logger.info('Database optimized');
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.sqlite) {
      this.sqlite.close();
      this.sqlite = null;
      this.db = null;
      logger.info('Database closed');
    }
  }

  /**
   * Get data path
   */
  getDataPath(): string {
    return this.dataPath;
  }

  /**
   * Get database path
   */
  getDbPath(): string {
    return this.dbPath;
  }
}

// Singleton instance
let instance: DatabaseManager | null = null;

/**
 * Get or create database manager instance
 */
export function getDatabaseManager(): DatabaseManager {
  if (!instance) {
    instance = new DatabaseManager();
  }
  return instance;
}
