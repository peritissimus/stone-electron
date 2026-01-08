/**
 * DatabaseManager - Core database connection and lifecycle management (libsql)
 *
 * Clean version for hexagonal architecture - sync logic handled by use cases.
 */

import { createClient } from '@libsql/client/sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Conditionally import electron
let app: any = null;
try {
  const electron = require('electron');
  if (typeof electron !== 'string' && electron.app) {
    app = electron.app;
  } else {
    throw new Error('Not running in Electron context');
  }
} catch {
  app = {
    getPath: (name: string) => {
      if (name === 'userData') {
        return path.join(os.homedir(), '.stone');
      }
      return os.tmpdir();
    },
    isPackaged: false,
  };
}

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { nanoid } from 'nanoid';
import * as schema from './schema';
import { logger } from '../utils/logger';

export class DatabaseManager {
  private client: any = null;
  private db: any = null;
  private readonly dataPath: string;
  private readonly dbPath: string;

  constructor() {
    const dbUrl = app.isPackaged ? undefined : process.env.DATABASE_URL;

    if (dbUrl) {
      this.dbPath = path.isAbsolute(dbUrl) ? dbUrl : path.join(process.cwd(), dbUrl);
      this.dataPath = path.dirname(this.dbPath);
    } else {
      this.dataPath = path.join(app.getPath('userData'), 'stone-data');
      this.dbPath = path.join(this.dataPath, 'notes.db');
    }

    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    try {
      logger.info(`Database path: ${this.dbPath}`);

      this.client = createClient({ url: `file:${this.dbPath}` });
      await this.client.execute('PRAGMA foreign_keys = ON');

      this.db = drizzle(this.client, { schema });

      const migrationsPath = app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar', 'migrations')
        : path.join(process.cwd(), 'migrations');

      logger.info(`Migrations path: ${migrationsPath}`);
      await migrate(this.db, { migrationsFolder: migrationsPath });

      await this.seedDatabase();

      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async seedDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Seed predefined topics
    const existingTopics = await this.db.select().from(schema.topics);
    if (existingTopics.length === 0) {
      const predefinedTopics = [
        { id: 'topic_work', name: 'Work', color: '#3b82f6', isPredefined: true },
        { id: 'topic_personal', name: 'Personal', color: '#22c55e', isPredefined: true },
        { id: 'topic_learning', name: 'Learning', color: '#a855f7', isPredefined: true },
        { id: 'topic_projects', name: 'Projects', color: '#f97316', isPredefined: true },
        { id: 'topic_ideas', name: 'Ideas', color: '#eab308', isPredefined: true },
      ];

      for (const topic of predefinedTopics) {
        await this.db.insert(schema.topics).values({
          ...topic,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      logger.info('Seeded predefined topics');
    }
  }

  getDrizzle() {
    if (!this.db) throw new Error('Database not initialized. Call initialize() first.');
    return this.db;
  }

  getClient() {
    return this.client;
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
      this.db = null;
      logger.info('Database connection closed');
    }
  }

  getDbPath(): string {
    return this.dbPath;
  }

  getDataPath(): string {
    return this.dataPath;
  }

  async vacuum(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.run(sql`VACUUM`);
    logger.info('Database vacuumed');
  }

  async getStatus(): Promise<{
    path: string;
    size: number;
    isOpen: boolean;
  }> {
    const stats = fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath) : null;
    return {
      path: this.dbPath,
      size: stats?.size ?? 0,
      isOpen: this.db !== null,
    };
  }

  async checkIntegrity(): Promise<{ ok: boolean; errors: string[] }> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.run(sql`PRAGMA integrity_check`);
    const isOk = result?.rows?.[0]?.integrity_check === 'ok';
    return {
      ok: isOk,
      errors: isOk ? [] : [result?.rows?.[0]?.integrity_check || 'Unknown error'],
    };
  }
}

// Singleton
let instance: DatabaseManager | null = null;

export function getDatabaseManager(): DatabaseManager {
  instance ??= new DatabaseManager();
  return instance;
}

export function createDatabaseManager(): DatabaseManager {
  return new DatabaseManager();
}
