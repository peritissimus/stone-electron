/**
 * DatabaseManager - Core database connection and lifecycle management (libsql)
 */

import { createClient } from '@libsql/client/sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Conditionally import electron
let app: any = null;
try {
  const electron = require('electron');
  // Outside Electron, require('electron') returns a string path to the binary
  // We need to check if we got the actual Electron module with the app API
  if (typeof electron !== 'string' && electron.app) {
    app = electron.app;
  } else {
    throw new Error('Not running in Electron context');
  }
} catch {
  // Electron not available, use fallback
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
import { getFileSystemService } from '../services/FileSystemService';

export class DatabaseManager {
  private client: any = null;
  private db: any = null;
  private readonly dataPath: string;
  private readonly dbPath: string;

  constructor() {
    // In packaged apps, always use userData directory, ignore DATABASE_URL
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

      // Enable foreign keys
      await this.client.execute('PRAGMA foreign_keys = ON');

      this.db = drizzle(this.client, { schema });

      // In packaged app, migrations are in app.asar or app.asar.unpacked
      const migrationsPath = app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar', 'migrations')
        : path.join(process.cwd(), 'migrations');

      logger.info(`Migrations path: ${migrationsPath}`);
      await migrate(this.db, { migrationsFolder: migrationsPath });

      await this.seedDatabase();
      await this.syncWorkspaceFiles();

      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async syncWorkspaceFiles(): Promise<void> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      logger.info('🔄 Syncing workspaces with file system...');

      const workspaces = await this.db.select().from(schema.workspaces);
      if (workspaces.length === 0) {
        logger.info('No workspaces found, skipping sync');
        return;
      }

      // Sync all workspaces in parallel (much faster than sequential)
      await Promise.all(
        workspaces.map(async (workspace: any) => {
          logger.info(`Syncing workspace: ${workspace.name} (${workspace.folderPath})`);
          try {
            const { NotebookRepository } = await import('../repositories/NotebookRepository');
            const { NoteRepository } = await import('../repositories/NoteRepository');
            const notebookRepository = new NotebookRepository();
            const noteRepository = new NoteRepository();

            // Sync notebooks and notes in parallel for this workspace
            const [notebookSyncResults, syncResults] = await Promise.all([
              notebookRepository.syncWithWorkspaceFolders(workspace.id),
              noteRepository.syncWithFileSystem(workspace.id),
            ]);

            logger.info(`Workspace "${workspace.name}" notebook sync:`, {
              created: notebookSyncResults.created,
              updated: notebookSyncResults.updated,
              errors: notebookSyncResults.errors.length,
            });
            if (notebookSyncResults.errors.length > 0) {
              logger.warn(
                `Notebook sync errors for workspace "${workspace.name}":`,
                notebookSyncResults.errors,
              );
            }

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
        })
      );

      logger.info('✅ All workspaces synced');
    } catch (error) {
      logger.error('Failed to sync workspaces:', error);
    }
  }

  private async seedDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

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

    const workspaceFolderPath = path.join(os.homedir(), 'NoteBook');

    try {
      if (!fs.existsSync(workspaceFolderPath)) {
        fs.mkdirSync(workspaceFolderPath, { recursive: true });
        logger.info(`Created workspace directory: ${workspaceFolderPath}`);
      }
      const personalPath = path.join(workspaceFolderPath, 'Personal');
      const workPath = path.join(workspaceFolderPath, 'Work');
      if (!fs.existsSync(personalPath)) fs.mkdirSync(personalPath, { recursive: true });
      if (!fs.existsSync(workPath)) fs.mkdirSync(workPath, { recursive: true });
    } catch (error) {
      logger.warn('Could not create workspace directories:', error);
    }

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
        parentId: null as any,
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
        parentId: null as any,
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
        content: null as any,
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
        content: null as any,
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
      { id: ideasTagId, name: 'ideas', color: '#22c55e', createdAt: now(), updatedAt: now() },
      { id: planningTagId, name: 'planning', color: '#f97316', createdAt: now(), updatedAt: now() },
    ];

    const noteTagsData = [
      { noteId: welcomeNoteId, tagId: ideasTagId, createdAt: now() },
      { noteId: roadmapNoteId, tagId: planningTagId, createdAt: now() },
    ];

    await this.db.insert(schema.workspaces).values(workspaceData);
    await this.db.insert(schema.notebooks).values(notebooksData);
    await this.db.insert(schema.notes).values(notesData);
    await this.db.insert(schema.tags).values(tagsData);
    await this.db.insert(schema.noteTags).values(noteTagsData);

    try {
      const fileSystemService = getFileSystemService();
      const welcomeFilePath = path.join(workspaceFolderPath, 'Personal', 'Welcome to Stone.md');
      const roadmapFilePath = path.join(workspaceFolderPath, 'Work', 'Product Roadmap.md');

      if (fs.existsSync(welcomeFilePath)) {
        logger.info('Welcome to Stone.md already exists, skipping');
      } else {
        const welcomeMarkdown = `# Welcome to Stone\n\nThis sample note shows how rich text content is stored.\n\n- Create notebooks to organize topics.\n- Add tags to group related ideas.\n- Use the TipTap editor to capture your thoughts.`;
        await fileSystemService.writeMarkdownFile(welcomeFilePath, welcomeMarkdown, {
          tags: ['ideas'],
          favorite: true,
          pinned: true,
        });
        logger.info('Created Welcome to Stone.md');
      }

      if (fs.existsSync(roadmapFilePath)) {
        logger.info('Product Roadmap.md already exists, skipping');
      } else {
        const roadmapMarkdown = `# Quarterly Roadmap\n\nTrack the high-level initiatives planned for this quarter.\n\n1. Ship the new editor experience.\n2. Improve sync reliability.\n3. Publish public beta announcement.`;
        await fileSystemService.writeMarkdownFile(roadmapFilePath, roadmapMarkdown, {
          tags: ['planning'],
          favorite: false,
          pinned: false,
        });
        logger.info('Created Product Roadmap.md');
      }

      logger.info('Seed markdown files processed successfully');
    } catch (error) {
      logger.warn('Could not create seed markdown files:', error);
    }

    logger.info('Database seed data inserted successfully');
  }

  getDrizzle() {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  async getStatus(): Promise<{
    version: number;
    noteCount: number;
    notebookCount: number;
    tagCount: number;
    attachmentCount: number;
    databaseSize: number;
    integrityOk: boolean;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const noteCount =
      (
        await this.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(schema.notes)
          .where(sql`is_deleted = 0`)
      )[0]?.count ?? 0;
    const notebookCount =
      (await this.db.select({ count: sql<number>`COUNT(*)` }).from(schema.notebooks))[0]?.count ??
      0;
    const tagCount =
      (await this.db.select({ count: sql<number>`COUNT(*)` }).from(schema.tags))[0]?.count ?? 0;
    const attachmentCount =
      (await this.db.select({ count: sql<number>`COUNT(*)` }).from(schema.attachments))[0]?.count ??
      0;
    const schemaVersion =
      (
        await this.db
          .select({ version: sql<number>`COUNT(*)` })
          .from(sql`__drizzle_migrations` as any)
      )[0]?.version ?? 0;
    const stats = fs.statSync(this.dbPath);

    return {
      version: schemaVersion,
      noteCount,
      notebookCount,
      tagCount,
      attachmentCount,
      databaseSize: stats.size,
      integrityOk: true,
    };
  }

  async checkIntegrity(): Promise<{ ok: boolean; errors: string[] }> {
    try {
      const res: any = this.db?.execute
        ? await this.db.execute('PRAGMA integrity_check')
        : await this.client.execute('PRAGMA integrity_check');
      const rows: any[] = res?.rows ?? res ?? [];
      if (rows.length >= 1) {
        const value = rows[0].integrity_check ?? rows[0][Object.keys(rows[0])[0]];
        if (value === 'ok') return { ok: true, errors: [] };
      }
      return { ok: false, errors: rows.map((r: any) => r.integrity_check ?? JSON.stringify(r)) };
    } catch (error) {
      return { ok: false, errors: [String(error)] };
    }
  }

  async optimize(): Promise<void> {
    if (!this.client) throw new Error('Database not initialized');
    await this.client.execute('VACUUM');
    await this.client.execute('PRAGMA optimize');
    logger.info('Database optimized');
  }

  async close(): Promise<void> {
    this.db = null;
    this.client = null;
    logger.info('Database closed');
  }

  getDataPath(): string {
    return this.dataPath;
  }

  getDbPath(): string {
    return this.dbPath;
  }
}

let instance: DatabaseManager | null = null;
export function getDatabaseManager(): DatabaseManager {
  instance ??= new DatabaseManager();
  return instance;
}
