/**
 * DatabaseManager - Core database connection and lifecycle management
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { app } from 'electron';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { nanoid } from 'nanoid';
import * as schema from './schema';
import { logger } from '../utils/logger';
import { getFileSystemService } from '../services/FileSystemService';
import { getMarkdownService } from '../services/MarkdownService';

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

      await this.seedDatabase();

      // Always sync with file system on startup
      await this.syncWorkspaceFiles();

      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Sync all workspaces with their file systems
   */
  private async syncWorkspaceFiles(): Promise<void> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      logger.info('🔄 Syncing workspaces with file system...');

      // Get all active workspaces
      const workspaces = await this.db.select().from(schema.workspaces);

      if (workspaces.length === 0) {
        logger.info('No workspaces found, skipping sync');
        return;
      }

      for (const workspace of workspaces) {
        logger.info(`Syncing workspace: ${workspace.name} (${workspace.folderPath})`);

        try {
          const { NoteRepository } = await import('../repositories/NoteRepository');
          const noteRepository = new NoteRepository();

          const syncResults = await noteRepository.syncWithFileSystem(workspace.id);

          logger.info(`Workspace "${workspace.name}" sync completed:`, {
            created: syncResults.created,
            updated: syncResults.updated,
            deleted: syncResults.deleted,
            errors: syncResults.errors.length,
          });

          if (syncResults.errors.length > 0) {
            logger.warn(`Sync errors for workspace "${workspace.name}":`, syncResults.errors);
          }
        } catch (error) {
          logger.error(`Failed to sync workspace "${workspace.name}":`, error);
        }
      }

      logger.info('✅ All workspaces synced');
    } catch (error) {
      logger.error('Failed to sync workspaces:', error);
      // Don't throw - allow app to continue even if sync fails
    }
  }

  private async seedDatabase(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const notebookCountResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.notebooks);

    const notebookCount = notebookCountResult[0]?.count ?? 0;

    if (notebookCount > 0) {
      logger.info('Database already contains data, skipping seed process');
      return;
    }

    const workspaceId = nanoid();
    const personalNotebookId = nanoid();
    const workNotebookId = nanoid();
    const welcomeNoteId = nanoid();
    const roadmapNoteId = nanoid();
    const ideasTagId = nanoid();
    const planningTagId = nanoid();

    const now = () => new Date();

    // Setup workspace folder path
    const workspaceFolderPath = path.join(os.homedir(), 'NoteBook');

    // Create workspace directory structure
    try {
      if (!fs.existsSync(workspaceFolderPath)) {
        fs.mkdirSync(workspaceFolderPath, { recursive: true });
        logger.info(`Created workspace directory: ${workspaceFolderPath}`);
      }

      // Create subdirectories for notebooks
      const personalPath = path.join(workspaceFolderPath, 'Personal');
      const workPath = path.join(workspaceFolderPath, 'Work');

      if (!fs.existsSync(personalPath)) {
        fs.mkdirSync(personalPath, { recursive: true });
      }
      if (!fs.existsSync(workPath)) {
        fs.mkdirSync(workPath, { recursive: true });
      }
    } catch (error) {
      logger.warn('Could not create workspace directories:', error);
    }

    // Workspace data
    const workspaceData = {
      id: workspaceId,
      name: 'My Notes',
      folderPath: workspaceFolderPath,
      isActive: true,
      createdAt: now(),
      lastAccessedAt: now(),
    };

    const notebooksData = [
      {
        id: personalNotebookId,
        name: 'Personal',
        parentId: null,
        workspaceId: workspaceId,
        folderPath: 'Personal',
        icon: '📝',
        color: '#ec4899',
        position: 0,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: workNotebookId,
        name: 'Work',
        parentId: null,
        workspaceId: workspaceId,
        folderPath: 'Work',
        icon: '💼',
        color: '#3b82f6',
        position: 1,
        createdAt: now(),
        updatedAt: now(),
      },
    ];

    const notesData = [
      {
        id: welcomeNoteId,
        title: 'Welcome to Stone',
        content: null, // Content will be stored in markdown file
        notebookId: personalNotebookId,
        workspaceId: workspaceId,
        filePath: 'Personal/Welcome to Stone.md',
        isFavorite: true,
        isPinned: true,
        isArchived: false,
        isDeleted: false,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: roadmapNoteId,
        title: 'Product Roadmap',
        content: null, // Content will be stored in markdown file
        notebookId: workNotebookId,
        workspaceId: workspaceId,
        filePath: 'Work/Product Roadmap.md',
        isFavorite: false,
        isPinned: false,
        isArchived: false,
        isDeleted: false,
        createdAt: now(),
        updatedAt: now(),
      },
    ];

    const tagsData = [
      {
        id: ideasTagId,
        name: 'ideas',
        color: '#22c55e',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: planningTagId,
        name: 'planning',
        color: '#f97316',
        createdAt: now(),
        updatedAt: now(),
      },
    ];

    const noteTagsData = [
      {
        noteId: welcomeNoteId,
        tagId: ideasTagId,
        createdAt: now(),
      },
      {
        noteId: roadmapNoteId,
        tagId: planningTagId,
        createdAt: now(),
      },
    ];

    // Insert workspace first
    await this.db.insert(schema.workspaces).values(workspaceData);

    await this.db.insert(schema.notebooks).values(notebooksData);
    await this.db.insert(schema.notes).values(notesData);
    await this.db.insert(schema.tags).values(tagsData);
    await this.db.insert(schema.noteTags).values(noteTagsData);

    // Create markdown files for seed notes (only if they don't exist)
    try {
      const fileSystemService = getFileSystemService();

      const welcomeFilePath = path.join(workspaceFolderPath, 'Personal', 'Welcome to Stone.md');
      const roadmapFilePath = path.join(workspaceFolderPath, 'Work', 'Product Roadmap.md');

      // Only create Welcome note if it doesn't exist
      if (!fs.existsSync(welcomeFilePath)) {
        const welcomeMarkdown = `# Welcome to Stone

This sample note shows how rich text content is stored.

- Create notebooks to organize topics.
- Add tags to group related ideas.
- Use the TipTap editor to capture your thoughts.`;

        await fileSystemService.writeMarkdownFile(
          welcomeFilePath,
          welcomeMarkdown,
          {
            tags: ['ideas'],
            favorite: true,
            pinned: true,
          }
        );
        logger.info('Created Welcome to Stone.md');
      } else {
        logger.info('Welcome to Stone.md already exists, skipping');
      }

      // Only create Product Roadmap if it doesn't exist
      if (!fs.existsSync(roadmapFilePath)) {
        const roadmapMarkdown = `# Quarterly Roadmap

Track the high-level initiatives planned for this quarter.

1. Ship the new editor experience.
2. Improve sync reliability.
3. Publish public beta announcement.`;

        await fileSystemService.writeMarkdownFile(
          roadmapFilePath,
          roadmapMarkdown,
          {
            tags: ['planning'],
            favorite: false,
            pinned: false,
          }
        );
        logger.info('Created Product Roadmap.md');
      } else {
        logger.info('Product Roadmap.md already exists, skipping');
      }

      logger.info('Seed markdown files processed successfully');
    } catch (error) {
      logger.warn('Could not create seed markdown files:', error);
    }

    logger.info('Database seed data inserted successfully');
    // Note: Workspace sync will be performed by syncWorkspaceFiles() after seed
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
